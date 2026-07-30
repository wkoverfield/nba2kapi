/**
 * Rebuild pipeline for the precomputed `cohortStats` and `teams` tables.
 *
 * These tables are derived views over `players`, refreshed after every scrape
 * (see .github/workflows/scrape.yml) and runnable standalone as a backfill:
 *
 *   npx convex run cohorts:rebuildAll            # all eras
 *   npx convex run cohorts:rebuildAll '{"teamType":"curr"}'
 *
 * The action paginates the players table (a whole era does not fit in one
 * mutation transaction) and accumulates in action memory, then writes one
 * small mutation per derived doc. All functions here are internal: the tables
 * are rebuilt only by the scrape pipeline or an operator, never by clients.
 *
 * Parity contract with dossier.getDossier: value arrays are built from the
 * same era-index document order the query's old era-scan used, sums are taken
 * in that order BEFORE sorting (float sums are order-dependent), and rounding
 * matches the query exactly. Violating any of these makes precomputed
 * percentiles drift from the live-scan fallback path.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { ATTRIBUTE_CATEGORIES, CATEGORY_KEYS, categoryScore } from "./attributeCategories";

const teamTypeValidator = v.union(v.literal("curr"), v.literal("class"), v.literal("allt"));
type TeamType = "curr" | "class" | "allt";

/** Team slug formula shared with teams.getBoard / sitemap URLs. */
function teamSlug(teamName: string): string {
  return teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Slim player projection the rebuild needs (fat fields stay in the DB). */
type SlimPlayer = {
  _id: Id<"players">;
  slug: string;
  name: string;
  team: string;
  overall: number;
  positions: string[] | null;
  attributes: Record<string, number> | null;
};

/**
 * One page of an era's players in by_teamType index order. Index order is
 * load-bearing: cohort arrays and rosters must match the order the dossier
 * fallback path sees from `.collect()` on the same index.
 */
export const playersPage = internalQuery({
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
      page: page.page.map(
        (p): SlimPlayer => ({
          _id: p._id,
          slug: p.slug,
          name: p.name,
          team: p.team,
          overall: p.overall,
          positions: p.positions ?? null,
          attributes: p.attributes ?? null,
        })
      ),
    };
  },
});

const cohortDocValidator = {
  teamType: teamTypeValidator,
  primaryPosition: v.union(v.string(), v.null()),
  attrs: v.record(v.string(), v.object({ values: v.array(v.number()), avg: v.number() })),
  categories: v.record(
    v.string(),
    v.object({ values: v.array(v.number()), avg: v.union(v.number(), v.null()) })
  ),
  overall: v.object({ values: v.array(v.number()), avg: v.union(v.number(), v.null()) }),
  roster: v.array(
    v.object({
      playerId: v.id("players"),
      slug: v.string(),
      name: v.string(),
      team: v.string(),
      overall: v.number(),
      catScores: v.array(v.union(v.number(), v.null())),
    })
  ),
};

/**
 * Upsert one cohortStats doc keyed by (teamType, primaryPosition).
 *
 * Size ceiling: the null-position (whole era) doc is the largest (~300KB at
 * ~770 players) and scales with era size against Convex's 1MB document limit.
 * If replace() ever throws on size, the old doc persists (stale, not missing),
 * so getDossier's missing-doc fallback will NOT fire; the signal is a failing
 * rebuild step in CI. Mitigation when rosters approach the limit: split the
 * per-attribute arrays across per-position docs and drop the era-wide doc's
 * roster field.
 */
export const writeCohortStatsDoc = internalMutation({
  args: cohortDocValidator,
  handler: async (ctx, args) => {
    const doc = { ...args, updatedAt: new Date().toISOString() };
    const existing = await ctx.db
      .query("cohortStats")
      .withIndex("by_teamType_and_position", (q) =>
        q.eq("teamType", args.teamType).eq("primaryPosition", args.primaryPosition)
      )
      .first();
    if (existing) {
      await ctx.db.replace(existing._id, doc);
      return { action: "replaced" as const };
    }
    await ctx.db.insert("cohortStats", doc);
    return { action: "inserted" as const };
  },
});

/**
 * Drop cohortStats docs for positions that no longer exist in the era
 * (e.g. a position group emptied out after a reconcile).
 */
export const pruneCohortStats = internalMutation({
  args: {
    teamType: teamTypeValidator,
    keepPositions: v.array(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const keep = new Set(args.keepPositions);
    const docs = await ctx.db
      .query("cohortStats")
      .withIndex("by_teamType_and_position", (q) => q.eq("teamType", args.teamType))
      .collect();
    let deleted = 0;
    for (const doc of docs) {
      if (!keep.has(doc.primaryPosition)) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
    }
    return { deleted };
  },
});

/**
 * Sync the `teams` table for one era to exactly the given (slug, name) set:
 * upserts current teams, deletes departed ones.
 */
export const replaceTeamsForEra = internalMutation({
  args: {
    teamType: teamTypeValidator,
    teams: v.array(v.object({ slug: v.string(), name: v.string() })),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("teams")
      .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType))
      .collect();
    const existingBySlug = new Map(existing.map((t) => [t.slug, t]));
    const wantedSlugs = new Set(args.teams.map((t) => t.slug));

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    for (const team of args.teams) {
      const current = existingBySlug.get(team.slug);
      if (!current) {
        await ctx.db.insert("teams", {
          slug: team.slug,
          teamType: args.teamType,
          name: team.name,
          updatedAt: now,
        });
        inserted++;
      } else if (current.name !== team.name) {
        await ctx.db.patch(current._id, { name: team.name, updatedAt: now });
        updated++;
      }
    }
    for (const doc of existing) {
      if (!wantedSlugs.has(doc.slug)) {
        await ctx.db.delete(doc._id);
        deleted++;
      }
    }
    return { inserted, updated, deleted };
  },
});

/**
 * Build one cohortStats doc from the cohort's players (already in era-index
 * order). Averages replicate dossier.getDossier's exact rounding; sums run in
 * cohort order before sorting so float results match the live-scan path.
 */
function buildCohortDoc(
  cohort: SlimPlayer[],
  teamType: TeamType,
  primaryPosition: string | null
) {
  // Per-attribute sorted values + avg (avg rounded to 0.1 like the query)
  const attrKeys = new Set<string>();
  for (const p of cohort) {
    if (p.attributes) for (const key of Object.keys(p.attributes)) attrKeys.add(key);
  }
  const attrs: Record<string, { values: number[]; avg: number }> = {};
  for (const key of attrKeys) {
    const values: number[] = [];
    for (const p of cohort) {
      const n = p.attributes?.[key];
      if (typeof n === "number") values.push(n);
    }
    if (!values.length) continue;
    const avg = Math.round((values.reduce((s, n) => s + n, 0) / values.length) * 10) / 10;
    values.sort((a, b) => a - b);
    attrs[key] = { values, avg };
  }

  // Per-category sorted score arrays + integer-rounded avg
  const catScoresByPlayer = cohort.map((p) =>
    CATEGORY_KEYS.map((cat) => categoryScore(p.attributes ?? undefined, ATTRIBUTE_CATEGORIES[cat]))
  );
  const categories: Record<string, { values: number[]; avg: number | null }> = {};
  CATEGORY_KEYS.forEach((cat, i) => {
    const values = catScoresByPlayer
      .map((scores) => scores[i])
      .filter((n): n is number => n !== null);
    const avg =
      values.length === 0
        ? null
        : Math.round(values.reduce((sum, n) => sum + n, 0) / values.length);
    values.sort((a, b) => a - b);
    categories[cat] = { values, avg };
  });

  // Overall sorted array + integer-rounded avg
  const overallValues = cohort.map((p) => p.overall);
  const overallAvg = overallValues.length
    ? Math.round(overallValues.reduce((sum, n) => sum + n, 0) / overallValues.length)
    : null;
  const overall = { values: [...overallValues].sort((a, b) => a - b), avg: overallAvg };

  // Compact roster in cohort order (similar-players candidates)
  const roster = cohort.map((p, idx) => ({
    playerId: p._id,
    slug: p.slug,
    name: p.name,
    team: p.team,
    overall: p.overall,
    catScores: catScoresByPlayer[idx],
  }));

  return { teamType, primaryPosition, attrs, categories, overall, roster };
}

type EraRebuildSummary = {
  teamType: TeamType;
  players: number;
  cohortDocs: number;
  positions: string[];
  teams: number;
  teamsResult: { inserted: number; updated: number; deleted: number };
};

/**
 * Rebuild cohortStats + teams from the players table. Pass teamType to limit
 * to one era; omit it to rebuild all three.
 */
export const rebuildAll = internalAction({
  args: { teamType: v.optional(teamTypeValidator) },
  handler: async (ctx, args): Promise<EraRebuildSummary[]> => {
    const eras: TeamType[] = args.teamType ? [args.teamType] : ["curr", "class", "allt"];
    const summary: EraRebuildSummary[] = [];

    for (const teamType of eras) {
      // Collect the era in pages (whole eras exceed one transaction's limits)
      const players: SlimPlayer[] = [];
      let cursor: string | null = null;
      for (;;) {
        const res: {
          isDone: boolean;
          continueCursor: string;
          page: SlimPlayer[];
        } = await ctx.runQuery(internal.cohorts.playersPage, {
          teamType,
          paginationOpts: { numItems: 100, cursor },
        });
        players.push(...res.page);
        if (res.isDone) break;
        cursor = res.continueCursor;
      }

      // Position cohorts + the era-wide fallback cohort (primaryPosition null
      // covers players without positions, whose cohort is the whole era)
      const byPosition = new Map<string, SlimPlayer[]>();
      for (const p of players) {
        const pos = p.positions?.[0];
        if (!pos) continue;
        const group = byPosition.get(pos);
        if (group) group.push(p);
        else byPosition.set(pos, [p]);
      }
      const docs = [...byPosition.entries()].map(([pos, members]) =>
        buildCohortDoc(members, teamType, pos)
      );
      docs.push(buildCohortDoc(players, teamType, null));

      for (const doc of docs) {
        await ctx.runMutation(internal.cohorts.writeCohortStatsDoc, doc);
      }
      await ctx.runMutation(internal.cohorts.pruneCohortStats, {
        teamType,
        keepPositions: docs.map((d) => d.primaryPosition),
      });

      // Teams table for the era
      const teamsBySlug = new Map<string, string>();
      for (const p of players) {
        const slug = teamSlug(p.team);
        if (!teamsBySlug.has(slug)) teamsBySlug.set(slug, p.team);
      }
      const teamsResult: EraRebuildSummary["teamsResult"] = await ctx.runMutation(internal.cohorts.replaceTeamsForEra, {
        teamType,
        teams: [...teamsBySlug.entries()].map(([slug, name]) => ({ slug, name })),
      });

      summary.push({
        teamType,
        players: players.length,
        cohortDocs: docs.length,
        positions: [...byPosition.keys()].sort(),
        teams: teamsBySlug.size,
        teamsResult,
      });
    }

    console.log("[cohorts.rebuildAll]", JSON.stringify(summary));
    return summary;
  },
});
