/**
 * Roster archive: past NBA 2K editions, served by /api/versions/:version/*.
 *
 * Tables: `rosterArchive` (one row per gameVersion + teamType + team + slug;
 * `team` is part of the key because classic eras repeat a slug across squads,
 * e.g. michael-jordan on several Bulls rosters) and `rosterVersions` (one doc
 * per archived edition). Both live beside the live `players` table and never
 * feed the current-version API: the current edition always reads live, an
 * archived edition always reads here.
 *
 * Writers:
 *   - adminImportBatch + finalizeVersion: external datasets, driven by
 *     scripts/import-roster-archive.mjs (batches of at most 200 rows, one
 *     `importedAt` stamp per run; finalizeVersion prunes rows of the edition
 *     that the run did not write).
 *   - freezeCurrentVersion: copies the live `players` table under a version
 *     label. Season rollover runbook: run it BEFORE bumping CURRENT_GAME_VERSION
 *     and before 2kratings starts publishing next-season reveals (mid-August):
 *       npx convex run --prod rosterArchive:freezeCurrentVersion
 *
 * Readers (public queries, no PII): listVersions, listVersionKeys, getVersion,
 * getVersionPlayers, getVersionPlayerBySlug, getVersionTeams.
 *
 * LANDMINE: every read of rosterArchive goes through a gameVersion index. The
 * table holds every archived edition, so an unindexed scan grows each season.
 */

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  ActionCtx,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { CURRENT_GAME_VERSION } from "./gameVersion";
import { constantTimeCompare } from "./apiKeys";

const teamTypeValidator = v.union(v.literal("curr"), v.literal("class"), v.literal("allt"));
type TeamType = "curr" | "class" | "allt";
const TEAM_TYPES: TeamType[] = ["curr", "class", "allt"];

/** Rows per adminImportBatch / archiveBatch call. */
export const IMPORT_BATCH_LIMIT = 200;
/** Live players read per page while freezing. */
const FREEZE_PAGE_SIZE = 100;

const VERSION_PATTERN = /^2K\d{2}$/;

type ArchiveRow = Omit<Doc<"rosterArchive">, "_id" | "_creationTime">;
type TeamTypeCounts = Record<TeamType, number>;
/** Untyped player object as received from a dataset or the live table. */
type RawPlayer = Record<string, unknown>;

/** Public projection of a rosterVersions doc (what /api/versions returns). */
type VersionSummary = {
  gameVersion: string;
  label: string;
  status: "archived";
  playerCount: number;
  teamTypeCounts: TeamTypeCounts;
  capturedAt: string;
  source: string;
  note?: string;
};

/** The synthesized entry for CURRENT_GAME_VERSION in listVersions. */
type CurrentSummary = {
  gameVersion: string;
  label: string;
  status: "current";
  playerCount: number;
  teamTypeCounts: TeamTypeCounts;
  /** Set when a standby snapshot of the current edition exists in the archive. */
  frozenAt?: string;
  frozenSource?: string;
};

type FreezeResult = VersionSummary & {
  liveRows: number;
  inserted: number;
  updated: number;
  pruned: number;
};

type FinalizeResult = VersionSummary & { pruned: number };

function assertGameVersion(gameVersion: string) {
  if (!VERSION_PATTERN.test(gameVersion)) {
    throw new Error(`Invalid gameVersion "${gameVersion}": expected the form 2K26`);
  }
}

function requireAdminKey(adminKey: string) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || !constantTimeCompare(adminKey, expected)) {
    throw new Error("Unauthorized: Invalid admin key");
  }
}

function versionLabel(gameVersion: string) {
  return `NBA ${gameVersion}`;
}

// ============================================================================
// ROW SHAPING
// ============================================================================

/**
 * Build an archive row from an untyped player object, keeping only the fields
 * the rosterArchive table stores. Anything else (Blacktop `cats`, live-table
 * bookkeeping such as `_id`, `lastUpdated`, `seasonMovement`, per-badge
 * `description`/`imageUrl`) is dropped here so both import paths share one
 * definition of "the archived record". Type errors surface at insert time
 * through the schema validator.
 */
function toArchiveRow(
  raw: RawPlayer,
  meta: { gameVersion: string; source: string; capturedAt: string; importedAt: string }
): ArchiveRow {
  for (const field of ["name", "slug", "team", "teamType", "overall"]) {
    if (raw[field] === undefined || raw[field] === null) {
      throw new Error(
        `Archive row is missing required field "${field}" (slug: ${String(raw.slug ?? "unknown")})`
      );
    }
  }
  if (!TEAM_TYPES.includes(raw.teamType as TeamType)) {
    throw new Error(`Archive row ${String(raw.slug)} has unknown teamType "${String(raw.teamType)}"`);
  }

  const row: ArchiveRow = {
    gameVersion: meta.gameVersion,
    slug: raw.slug as string,
    name: raw.name as string,
    team: raw.team as string,
    teamType: raw.teamType as TeamType,
    overall: raw.overall as number,
    source: meta.source,
    capturedAt: meta.capturedAt,
    importedAt: meta.importedAt,
  };

  const present = (value: unknown): boolean => value !== undefined && value !== null;
  const optionalFields = [
    "positions",
    "height",
    "weight",
    "wingspan",
    "college",
    "archetype",
    "playerImage",
    "teamImg",
    "attributes",
    "hotZones",
  ] as const;
  for (const field of optionalFields) {
    if (present(raw[field])) (row as Record<string, unknown>)[field] = raw[field];
  }

  if (present(raw.badges) && typeof raw.badges === "object") {
    const b = raw.badges as Record<string, unknown>;
    const badges: NonNullable<ArchiveRow["badges"]> = {};
    for (const key of ["total", "legendary", "hallOfFame", "gold", "silver", "bronze"] as const) {
      if (present(b[key])) badges[key] = b[key] as number;
    }
    if (Array.isArray(b.list)) {
      badges.list = (b.list as RawPlayer[]).map((entry) => ({
        name: entry.name as string,
        tier: entry.tier as string,
        ...(present(entry.category) && { category: entry.category as string }),
      }));
    }
    if (Array.isArray(b.top)) {
      badges.top = (b.top as RawPlayer[]).map((entry) => ({
        name: entry.name as string,
        tier: entry.tier as string,
      }));
    }
    row.badges = badges;
  }

  if (Array.isArray(raw.ratingHistory)) {
    row.ratingHistory = (raw.ratingHistory as RawPlayer[]).map((entry) => ({
      gameVersion: entry.gameVersion as string,
      overall: entry.overall as number,
      ...(present(entry.delta) && { delta: entry.delta as number }),
    }));
  }

  return row;
}

// ============================================================================
// WRITE HELPERS
// ============================================================================

/**
 * Upsert keyed on (gameVersion, teamType, team, slug). Replaces the whole row.
 * `team` is part of the key because the live table carries the same slug on
 * several squads of one era (e.g. michael-jordan on three classic Bulls
 * rosters); keying on slug alone would collapse them.
 */
async function upsertArchiveRow(ctx: MutationCtx, row: ArchiveRow): Promise<"inserted" | "updated"> {
  const sameSlug = await ctx.db
    .query("rosterArchive")
    .withIndex("by_version_and_slug", (q) =>
      q.eq("gameVersion", row.gameVersion).eq("slug", row.slug)
    )
    .collect();
  const existing = sameSlug.find(
    (doc) => doc.teamType === row.teamType && doc.team === row.team
  );
  if (existing) {
    await ctx.db.replace(existing._id, row);
    return "updated";
  }
  await ctx.db.insert("rosterArchive", row);
  return "inserted";
}

async function importRows(
  ctx: MutationCtx,
  args: {
    gameVersion: string;
    source: string;
    capturedAt: string;
    importedAt?: string;
    players: RawPlayer[];
  }
) {
  assertGameVersion(args.gameVersion);
  if (args.players.length > IMPORT_BATCH_LIMIT) {
    throw new Error(
      `Batch too large: ${args.players.length} players (max ${IMPORT_BATCH_LIMIT} per call)`
    );
  }
  const importedAt = args.importedAt ?? new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  for (const raw of args.players) {
    const row = toArchiveRow(raw, {
      gameVersion: args.gameVersion,
      source: args.source,
      capturedAt: args.capturedAt,
      importedAt,
    });
    const outcome = await upsertArchiveRow(ctx, row);
    if (outcome === "inserted") inserted++;
    else updated++;
  }
  return { inserted, updated };
}

async function countVersion(ctx: QueryCtx, gameVersion: string) {
  const teamTypeCounts: TeamTypeCounts = { curr: 0, class: 0, allt: 0 };
  let sample: Doc<"rosterArchive"> | null = null;
  for (const teamType of TEAM_TYPES) {
    const rows = await ctx.db
      .query("rosterArchive")
      .withIndex("by_version_and_type", (q) =>
        q.eq("gameVersion", gameVersion).eq("teamType", teamType)
      )
      .collect();
    teamTypeCounts[teamType] = rows.length;
    if (!sample && rows.length > 0) sample = rows[0];
  }
  const playerCount = teamTypeCounts.curr + teamTypeCounts.class + teamTypeCounts.allt;
  return { playerCount, teamTypeCounts, sample };
}

async function writeVersionDoc(
  ctx: MutationCtx,
  args: {
    gameVersion: string;
    label: string;
    playerCount: number;
    teamTypeCounts: TeamTypeCounts;
    capturedAt: string;
    source: string;
    note?: string;
  }
) {
  const updatedAt = new Date().toISOString();
  const existing = await ctx.db
    .query("rosterVersions")
    .withIndex("by_version", (q) => q.eq("gameVersion", args.gameVersion))
    .first();
  const fields = {
    label: args.label,
    playerCount: args.playerCount,
    teamTypeCounts: args.teamTypeCounts,
    capturedAt: args.capturedAt,
    source: args.source,
    ...(args.note !== undefined && { note: args.note }),
    updatedAt,
  };
  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return { ...existing, ...fields };
  }
  const doc = { gameVersion: args.gameVersion, status: "archived" as const, ...fields };
  const _id = await ctx.db.insert("rosterVersions", doc);
  return { _id, ...doc };
}

function publicVersion(doc: Doc<"rosterVersions">): VersionSummary {
  return {
    gameVersion: doc.gameVersion,
    label: doc.label,
    status: doc.status,
    playerCount: doc.playerCount,
    teamTypeCounts: doc.teamTypeCounts,
    capturedAt: doc.capturedAt,
    source: doc.source,
    ...(doc.note !== undefined && { note: doc.note }),
  };
}

// ============================================================================
// ADMIN MUTATIONS (scripts)
// ============================================================================

/**
 * Upsert up to IMPORT_BATCH_LIMIT players into one archived edition.
 * Requires ADMIN_API_KEY. Unknown fields on each player are dropped. Pass the
 * same `importedAt` stamp to every batch of one run so finalizeVersion can
 * prune rows the run did not write; omitted, each batch stamps itself.
 */
export const adminImportBatch = mutation({
  args: {
    adminKey: v.string(),
    gameVersion: v.string(),
    source: v.string(),
    capturedAt: v.string(),
    importedAt: v.optional(v.string()),
    players: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    requireAdminKey(args.adminKey);
    return await importRows(ctx, {
      gameVersion: args.gameVersion,
      source: args.source,
      capturedAt: args.capturedAt,
      ...(args.importedAt !== undefined && { importedAt: args.importedAt }),
      players: args.players,
    });
  },
});

/** Recount an edition and write (or refresh) its rosterVersions doc. */
export const writeVersionSummary = internalMutation({
  args: {
    gameVersion: v.string(),
    label: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VersionSummary> => {
    assertGameVersion(args.gameVersion);
    const { playerCount, teamTypeCounts, sample } = await countVersion(ctx, args.gameVersion);
    if (!sample) {
      throw new Error(
        `No archived players found for ${args.gameVersion}; import players before finalizing`
      );
    }
    const doc = await writeVersionDoc(ctx, {
      gameVersion: args.gameVersion,
      label: args.label ?? versionLabel(args.gameVersion),
      playerCount,
      teamTypeCounts,
      capturedAt: sample.capturedAt,
      source: sample.source,
      ...(args.note !== undefined && { note: args.note }),
    });
    return publicVersion(doc as Doc<"rosterVersions">);
  },
});

/**
 * Finish an import: when `importedAt` is given, prune rows of the edition
 * that do not carry that stamp (a corrected dataset that dropped players),
 * then recount and write (or refresh) the rosterVersions doc. Requires
 * ADMIN_API_KEY. Run after the last adminImportBatch of a run.
 */
export const finalizeVersion = action({
  args: {
    adminKey: v.string(),
    gameVersion: v.string(),
    importedAt: v.optional(v.string()),
    label: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<FinalizeResult> => {
    requireAdminKey(args.adminKey);
    assertGameVersion(args.gameVersion);
    let pruned = 0;
    if (args.importedAt !== undefined) {
      pruned = (await pruneVersion(ctx, args.gameVersion, args.importedAt)).pruned;
    }
    const version: VersionSummary = await ctx.runMutation(
      internal.rosterArchive.writeVersionSummary,
      {
        gameVersion: args.gameVersion,
        ...(args.label !== undefined && { label: args.label }),
        ...(args.note !== undefined && { note: args.note }),
      }
    );
    return { ...version, pruned };
  },
});

// ============================================================================
// FREEZE (season rollover)
// ============================================================================

/** One page of the live players table for an era, shaped for the archive. */
export const livePlayersPage = internalQuery({
  args: {
    teamType: teamTypeValidator,
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("players")
      .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType))
      .paginate(args.paginationOpts);
    return {
      isDone: page.isDone,
      continueCursor: page.continueCursor,
      page: page.page.map((p) => ({
        name: p.name,
        slug: p.slug,
        team: p.team,
        teamType: p.teamType,
        overall: p.overall,
        positions: p.positions,
        height: p.height,
        weight: p.weight,
        wingspan: p.wingspan,
        college: p.college,
        archetype: p.archetype,
        playerImage: p.playerImage,
        teamImg: p.teamImg,
        attributes: p.attributes,
        badges: p.badges,
        hotZones: p.hotZones,
        ratingHistory: p.ratingHistory,
      })),
    };
  },
});

export const archiveBatch = internalMutation({
  args: {
    gameVersion: v.string(),
    source: v.string(),
    capturedAt: v.string(),
    importedAt: v.string(),
    players: v.array(v.any()),
  },
  handler: async (ctx, args) => await importRows(ctx, args),
});

/**
 * One page of an archived era: deletes rows not written by the run stamped
 * `keepImportedAt` (players that left the live table since an earlier freeze)
 * and counts the rows that remain. Paginated so a whole era never has to fit
 * in one transaction.
 */
export const reconcileVersionPage = internalMutation({
  args: {
    gameVersion: v.string(),
    teamType: teamTypeValidator,
    keepImportedAt: v.string(),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("rosterArchive")
      .withIndex("by_version_and_type", (q) =>
        q.eq("gameVersion", args.gameVersion).eq("teamType", args.teamType)
      )
      .paginate(args.paginationOpts);
    let kept = 0;
    let pruned = 0;
    for (const row of page.page) {
      if (row.importedAt === args.keepImportedAt) {
        kept++;
      } else {
        await ctx.db.delete(row._id);
        pruned++;
      }
    }
    return { isDone: page.isDone, continueCursor: page.continueCursor, kept, pruned };
  },
});

export const upsertVersionDoc = internalMutation({
  args: {
    gameVersion: v.string(),
    label: v.string(),
    playerCount: v.number(),
    teamTypeCounts: v.object({ curr: v.number(), class: v.number(), allt: v.number() }),
    capturedAt: v.string(),
    source: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertGameVersion(args.gameVersion);
    const doc = await writeVersionDoc(ctx, args);
    return publicVersion(doc as Doc<"rosterVersions">);
  },
});

/**
 * Delete every row of an edition not stamped `keepImportedAt`, one page per
 * transaction, and count what remains per era.
 */
async function pruneVersion(ctx: ActionCtx, gameVersion: string, keepImportedAt: string) {
  const teamTypeCounts: TeamTypeCounts = { curr: 0, class: 0, allt: 0 };
  let pruned = 0;
  for (const teamType of TEAM_TYPES) {
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const res: {
        isDone: boolean;
        continueCursor: string;
        kept: number;
        pruned: number;
      } = await ctx.runMutation(internal.rosterArchive.reconcileVersionPage, {
        gameVersion,
        teamType,
        keepImportedAt,
        paginationOpts: { numItems: FREEZE_PAGE_SIZE, cursor },
      });
      teamTypeCounts[teamType] += res.kept;
      pruned += res.pruned;
      isDone = res.isDone;
      cursor = res.continueCursor;
    }
  }
  return { teamTypeCounts, pruned };
}

/**
 * Copy the live `players` table into the archive under a version label
 * (default CURRENT_GAME_VERSION) with source "freeze". Refuses when that
 * version already has a rosterVersions doc unless `overwrite` is true.
 * Idempotent: rerunning with overwrite replaces rows in place and prunes
 * rows the rerun did not write.
 *
 *   npx convex run --prod rosterArchive:freezeCurrentVersion
 *   npx convex run --prod rosterArchive:freezeCurrentVersion '{"overwrite": true}'
 */
export const freezeCurrentVersion = internalAction({
  args: {
    gameVersion: v.optional(v.string()),
    overwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<FreezeResult> => {
    const gameVersion = args.gameVersion ?? CURRENT_GAME_VERSION;
    assertGameVersion(gameVersion);

    const existing: VersionSummary | null = await ctx.runQuery(api.rosterArchive.getVersion, {
      gameVersion,
    });
    if (existing && !args.overwrite) {
      throw new Error(
        `${gameVersion} is already archived (${existing.playerCount} players, captured ${existing.capturedAt}). ` +
          `Pass {"overwrite": true} to replace it.`
      );
    }

    // One stamp for the whole run: rows carrying it were written by this
    // freeze; anything else under the version is pruned afterwards.
    const capturedAt = new Date().toISOString();
    const importedAt = capturedAt;
    let liveRows = 0;
    let inserted = 0;
    let updated = 0;

    for (const teamType of TEAM_TYPES) {
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const res: {
          isDone: boolean;
          continueCursor: string;
          page: RawPlayer[];
        } = await ctx.runQuery(internal.rosterArchive.livePlayersPage, {
          teamType,
          paginationOpts: { numItems: FREEZE_PAGE_SIZE, cursor },
        });
        if (res.page.length > 0) {
          const result: { inserted: number; updated: number } = await ctx.runMutation(
            internal.rosterArchive.archiveBatch,
            { gameVersion, source: "freeze", capturedAt, importedAt, players: res.page }
          );
          inserted += result.inserted;
          updated += result.updated;
          liveRows += res.page.length;
        }
        isDone = res.isDone;
        cursor = res.continueCursor;
      }
    }

    if (liveRows === 0) {
      throw new Error("The live players table is empty; nothing to freeze");
    }

    // Reconcile: drop rows an earlier freeze wrote that this run did not
    // touch, and count what the archive actually holds per era.
    const { teamTypeCounts, pruned } = await pruneVersion(ctx, gameVersion, importedAt);
    const playerCount = teamTypeCounts.curr + teamTypeCounts.class + teamTypeCounts.allt;

    const version: VersionSummary = await ctx.runMutation(internal.rosterArchive.upsertVersionDoc, {
      gameVersion,
      label: versionLabel(gameVersion),
      playerCount,
      teamTypeCounts,
      capturedAt,
      source: "freeze",
      note: `Frozen from the live players table at ${capturedAt}`,
    });

    console.log(
      `freezeCurrentVersion: ${gameVersion} archived ${playerCount} players from ${liveRows} live rows ` +
        `(curr ${teamTypeCounts.curr}, class ${teamTypeCounts.class}, allt ${teamTypeCounts.allt}; ` +
        `${inserted} inserted, ${updated} updated, ${pruned} pruned)`
    );
    return { ...version, liveRows, inserted, updated, pruned };
  },
});

// ============================================================================
// READ QUERIES
// ============================================================================

/** The rosterVersions doc for one edition, or null when it is not archived. */
export const getVersion = query({
  args: { gameVersion: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("rosterVersions")
      .withIndex("by_version", (q) => q.eq("gameVersion", args.gameVersion))
      .first();
    return doc ? publicVersion(doc) : null;
  },
});

/**
 * Every edition the API serves: the current edition first (synthesized from
 * CURRENT_GAME_VERSION with live counts, because the versioned routes always
 * serve the current edition from the live tables), then archived editions
 * newest first. A rosterVersions doc for the current edition is a standby
 * snapshot: it is not listed as a second row, but the current entry carries
 * its `frozenAt` / `frozenSource` so operators can see it exists.
 */
export const listVersions = query({
  args: {},
  handler: async (ctx): Promise<Array<CurrentSummary | VersionSummary>> => {
    const archived = await ctx.db.query("rosterVersions").collect();
    const currentArchive = archived.find((doc) => doc.gameVersion === CURRENT_GAME_VERSION);

    const teamTypeCounts: TeamTypeCounts = { curr: 0, class: 0, allt: 0 };
    for (const teamType of TEAM_TYPES) {
      const rows = await ctx.db
        .query("players")
        .withIndex("by_teamType", (q) => q.eq("teamType", teamType))
        .collect();
      teamTypeCounts[teamType] = rows.length;
    }
    const current: CurrentSummary = {
      gameVersion: CURRENT_GAME_VERSION,
      label: versionLabel(CURRENT_GAME_VERSION),
      status: "current",
      playerCount: teamTypeCounts.curr + teamTypeCounts.class + teamTypeCounts.allt,
      teamTypeCounts,
      ...(currentArchive && {
        frozenAt: currentArchive.capturedAt,
        frozenSource: currentArchive.source,
      }),
    };

    const rest = archived
      .filter((doc) => doc.gameVersion !== CURRENT_GAME_VERSION)
      .sort((a, b) => b.gameVersion.localeCompare(a.gameVersion))
      .map(publicVersion);

    return [current, ...rest];
  },
});

/**
 * Edition keys the versioned routes accept: the current edition first, then
 * archived editions newest first. Reads only rosterVersions (the 404 path of
 * every versioned route calls this).
 */
export const listVersionKeys = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const archived = await ctx.db.query("rosterVersions").collect();
    const rest = archived
      .map((doc) => doc.gameVersion)
      .filter((key) => key !== CURRENT_GAME_VERSION)
      .sort((a, b) => b.localeCompare(a));
    return [CURRENT_GAME_VERSION, ...rest];
  },
});

/**
 * Filtered, offset-paginated players of one archived edition. Mirrors the
 * args of players.getAllFiltered that the versioned routes expose. Sorted by
 * overall desc, then name.
 */
export const getVersionPlayers = query({
  args: {
    gameVersion: v.string(),
    teamType: v.optional(teamTypeValidator),
    teams: v.optional(v.array(v.string())),
    positions: v.optional(v.array(v.string())),
    minOverall: v.optional(v.number()),
    maxOverall: v.optional(v.number()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let players: Doc<"rosterArchive">[];
    const gameVersion = args.gameVersion;
    if (args.teams && args.teams.length === 1 && args.teamType !== undefined) {
      players = await ctx.db
        .query("rosterArchive")
        .withIndex("by_version_team_type", (q) =>
          q.eq("gameVersion", gameVersion).eq("team", args.teams![0]).eq("teamType", args.teamType!)
        )
        .collect();
    } else if (args.teamType !== undefined) {
      players = await ctx.db
        .query("rosterArchive")
        .withIndex("by_version_and_type", (q) =>
          q.eq("gameVersion", gameVersion).eq("teamType", args.teamType!)
        )
        .collect();
    } else {
      players = await ctx.db
        .query("rosterArchive")
        .withIndex("by_version", (q) => q.eq("gameVersion", gameVersion))
        .collect();
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      players = players.filter((p) => p.name.toLowerCase().includes(searchLower));
    }
    if (args.teams && !(args.teams.length === 1 && args.teamType !== undefined)) {
      const wanted = new Set(args.teams);
      players = players.filter((p) => wanted.has(p.team));
    }
    if (args.positions && args.positions.length > 0) {
      players = players.filter((p) => p.positions?.some((pos) => args.positions!.includes(pos)));
    }
    if (args.minOverall !== undefined) {
      players = players.filter((p) => p.overall >= args.minOverall!);
    }
    if (args.maxOverall !== undefined) {
      players = players.filter((p) => p.overall <= args.maxOverall!);
    }

    players.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));

    const totalCount = players.length;
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;
    return {
      players: players.slice(offset, offset + limit),
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  },
});

/**
 * Every archived row for a slug in one edition (one per roster the player
 * appears on), ordered curr, class, allt. Empty when the slug is unknown.
 */
export const getVersionPlayerBySlug = query({
  args: {
    gameVersion: v.string(),
    slug: v.string(),
    teamType: v.optional(teamTypeValidator),
  },
  handler: async (ctx, args) => {
    let players = await ctx.db
      .query("rosterArchive")
      .withIndex("by_version_and_slug", (q) =>
        q.eq("gameVersion", args.gameVersion).eq("slug", args.slug)
      )
      .collect();
    if (args.teamType) {
      players = players.filter((p) => p.teamType === args.teamType);
    }
    return players.sort(
      (a, b) => TEAM_TYPES.indexOf(a.teamType) - TEAM_TYPES.indexOf(b.teamType)
    );
  },
});

/**
 * Teams of one archived edition, grouped and shaped exactly like
 * players.getTeams (the query behind GET /api/teams): teamName, teamType,
 * playerCount, averageRating, logo; sorted by team name.
 */
export const getVersionTeams = query({
  args: {
    gameVersion: v.string(),
    teamType: v.optional(teamTypeValidator),
  },
  handler: async (ctx, args) => {
    const gameVersion = args.gameVersion;
    const players = args.teamType
      ? await ctx.db
          .query("rosterArchive")
          .withIndex("by_version_and_type", (q) =>
            q.eq("gameVersion", gameVersion).eq("teamType", args.teamType!)
          )
          .collect()
      : await ctx.db
          .query("rosterArchive")
          .withIndex("by_version", (q) => q.eq("gameVersion", gameVersion))
          .collect();

    const teamsMap = new Map<
      string,
      { teamName: string; teamType: string; playerCount: number; averageRating: number; logo: string }
    >();
    for (const player of players) {
      const key = `${player.team}-${player.teamType}`;
      if (!teamsMap.has(key)) {
        teamsMap.set(key, {
          teamName: player.team,
          teamType: player.teamType,
          playerCount: 0,
          averageRating: 0,
          logo: player.teamImg || "",
        });
      }
      const team = teamsMap.get(key)!;
      team.playerCount++;
      team.averageRating += player.overall;
    }

    return Array.from(teamsMap.values())
      .map((team) => ({
        ...team,
        averageRating: Math.round(team.averageRating / team.playerCount),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  },
});
