/**
 * Player Dossier aggregate — everything the dossier page needs in one query:
 * the player, roster cycling neighbors, position-cohort percentiles, similar
 * players by attribute profile, rating history, and named badges.
 *
 * Cohort math reads ONE precomputed `cohortStats` doc (rebuilt at scrape time
 * by cohorts.ts) instead of scanning every player doc in the era. When the
 * doc is missing (fresh deploy before the backfill has run), the query falls
 * back to the original era scan so pages never break on deploy ordering.
 */

import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { ATTRIBUTE_CATEGORIES, CATEGORY_KEYS, categoryScore } from "./attributeCategories";

/** Midpoint percentile (0-100) of value within values. */
function percentile(values: number[], value: number): number {
  if (!values.length) return 50;
  let below = 0;
  let equal = 0;
  for (const n of values) {
    if (n < value) below++;
    else if (n === value) equal++;
  }
  return Math.round(((below + equal / 2) / values.length) * 100);
}

/** First index whose value is >= x in an ascending-sorted array. */
function lowerBound(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose value is > x in an ascending-sorted array. */
function upperBound(sorted: number[], x: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Same midpoint percentile as percentile(), via binary search on a sorted array. */
function percentileSorted(sorted: number[], value: number): number {
  if (!sorted.length) return 50;
  const below = lowerBound(sorted, value);
  const equal = upperBound(sorted, value) - below;
  return Math.round(((below + equal / 2) / sorted.length) * 100);
}

type CohortBlock = {
  cohortSize: number;
  attrStats: Record<string, { value: number; pct: number; avg: number }>;
  categories: {
    key: (typeof CATEGORY_KEYS)[number];
    score: number | null;
    avg: number | null;
    pct: number | null;
  }[];
  overallPct: number;
  overallAvg: number | null;
  similar: {
    name: string;
    slug: string;
    team: string;
    teamType: "curr" | "class" | "allt";
    positions: string[];
    overall: number;
    playerImage: string | null;
  }[];
};

/** Cohort math from one precomputed cohortStats doc (the fast path). */
async function cohortFromStats(
  ctx: QueryCtx,
  player: Doc<"players">,
  stats: Doc<"cohortStats">
): Promise<CohortBlock> {
  // Per-attribute percentile + cohort average (matrix hover + signature stats)
  const attrStats: Record<string, { value: number; pct: number; avg: number }> = {};
  if (player.attributes) {
    for (const [key, value] of Object.entries(player.attributes)) {
      if (typeof value !== "number") continue;
      const stat = stats.attrs[key];
      if (!stat || !stat.values.length) continue;
      attrStats[key] = {
        value,
        pct: percentileSorted(stat.values, value),
        avg: stat.avg,
      };
    }
  }

  // Category scores + percentiles (radar + percentile bars)
  const categories = CATEGORY_KEYS.map((cat) => {
    const score = categoryScore(player.attributes, ATTRIBUTE_CATEGORIES[cat]);
    const stat = stats.categories[cat];
    return {
      key: cat,
      score: score === null ? null : Math.round(score),
      avg: stat?.avg ?? null,
      pct: score === null ? null : percentileSorted(stat?.values ?? [], score),
    };
  });
  const overallAvg = stats.overall.avg;
  const overallPct = percentileSorted(stats.overall.values, player.overall);

  // Similar players: nearest by category-score profile within the cohort.
  // Distance uses the precomputed catScores; display fields come from the
  // live player docs (three point-reads) so images/positions never go stale.
  const playerProfile = CATEGORY_KEYS.map((cat) =>
    categoryScore(player.attributes, ATTRIBUTE_CATEGORIES[cat])
  );
  const nearest = stats.roster
    .filter((entry) => entry.slug !== player.slug && entry.name !== player.name)
    .map((entry) => {
      let dist = 0;
      let dims = 0;
      entry.catScores.forEach((b, i) => {
        const a = playerProfile[i];
        if (a !== null && b !== null && b !== undefined) {
          dist += (a - b) ** 2;
          dims++;
        }
      });
      dist += (player.overall - entry.overall) ** 2;
      dims++;
      return { entry, dist: dims ? dist / dims : Infinity };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3);
  const similarDocs = await Promise.all(nearest.map(({ entry }) => ctx.db.get(entry.playerId)));
  const similar = similarDocs
    .filter((p): p is Doc<"players"> => p !== null)
    .map((p) => ({
      name: p.name,
      slug: p.slug,
      team: p.team,
      teamType: p.teamType,
      positions: p.positions ?? [],
      overall: p.overall,
      playerImage: p.playerImage ?? null,
    }));

  return {
    cohortSize: stats.overall.values.length,
    attrStats,
    categories,
    overallPct,
    overallAvg,
    similar,
  };
}

/**
 * Original era-scan cohort math. Only runs when the cohortStats doc for the
 * player's (teamType, primaryPosition) is missing, i.e. before the first
 * cohorts:rebuildAll backfill on a deployment.
 */
async function cohortFromEraScan(
  ctx: QueryCtx,
  player: Doc<"players">,
  primaryPosition: string | null
): Promise<CohortBlock> {
  const eraDocs = await ctx.db
    .query("players")
    .withIndex("by_teamType", (q) => q.eq("teamType", player.teamType))
    .collect();
  const cohort = primaryPosition
    ? eraDocs.filter((p) => p.positions?.[0] === primaryPosition)
    : eraDocs;

  // Per-attribute percentile + cohort average (matrix hover + signature stats)
  const attrStats: Record<string, { value: number; pct: number; avg: number }> = {};
  if (player.attributes) {
    for (const [key, value] of Object.entries(player.attributes)) {
      if (typeof value !== "number") continue;
      const values = cohort
        .map((p) => p.attributes?.[key])
        .filter((n): n is number => typeof n === "number");
      if (!values.length) continue;
      attrStats[key] = {
        value,
        pct: percentile(values, value),
        avg: Math.round((values.reduce((s, n) => s + n, 0) / values.length) * 10) / 10,
      };
    }
  }

  // Category scores + percentiles (radar + percentile bars)
  const categories = CATEGORY_KEYS.map((cat) => {
    const keys = ATTRIBUTE_CATEGORIES[cat];
    const score = categoryScore(player.attributes, keys);
    const values = cohort
      .map((p) => categoryScore(p.attributes, keys))
      .filter((n): n is number => n !== null);
    return {
      key: cat,
      score: score === null ? null : Math.round(score),
      avg: values.length === 0 ? null : Math.round(values.reduce((sum, n) => sum + n, 0) / values.length),
      pct: score === null ? null : percentile(values, score),
    };
  });
  const overallAvg = cohort.length
    ? Math.round(cohort.reduce((sum, p) => sum + p.overall, 0) / cohort.length)
    : null;
  const overallPct = percentile(
    cohort.map((p) => p.overall),
    player.overall
  );

  // Similar players: nearest by category-score profile within the cohort
  const playerProfile = CATEGORY_KEYS.map((cat) =>
    categoryScore(player.attributes, ATTRIBUTE_CATEGORIES[cat])
  );
  const similar = cohort
    .filter((p) => p.slug !== player.slug && p.name !== player.name)
    .map((p) => {
      let dist = 0;
      let dims = 0;
      CATEGORY_KEYS.forEach((cat, i) => {
        const a = playerProfile[i];
        const b = categoryScore(p.attributes, ATTRIBUTE_CATEGORIES[cat]);
        if (a !== null && b !== null) {
          dist += (a - b) ** 2;
          dims++;
        }
      });
      dist += (player.overall - p.overall) ** 2;
      dims++;
      return { p, dist: dims ? dist / dims : Infinity };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map(({ p }) => ({
      name: p.name,
      slug: p.slug,
      team: p.team,
      teamType: p.teamType,
      positions: p.positions ?? [],
      overall: p.overall,
      playerImage: p.playerImage ?? null,
    }));

  return { cohortSize: cohort.length, attrStats, categories, overallPct, overallAvg, similar };
}

export const getDossier = query({
  args: {
    slug: v.string(),
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
    // Disambiguates classic players who share a slug across several team
    // versions ("2015-16 GSW" vs "2016-17 GSW" Curry).
    team: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const versions = await ctx.db
      .query("players")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .collect();
    if (versions.length === 0) return null;

    const eraOrder = { curr: 0, class: 1, allt: 2 } as const;
    const eraMatches = args.teamType
      ? versions.filter((p) => p.teamType === args.teamType)
      : [];
    const player =
      (args.team && eraMatches.find((p) => p.team === args.team)) ||
      (args.team && versions.find((p) => p.team === args.team)) ||
      // Multiple versions within one era: show the highest-rated
      [...eraMatches].sort((a, b) => b.overall - a.overall)[0] ||
      [...versions].sort(
        (a, b) => eraOrder[a.teamType] - eraOrder[b.teamType] || b.overall - a.overall
      )[0];

    // Roster (for prev/next cycling), best first
    const rosterDocs = await ctx.db
      .query("players")
      .withIndex("by_team_and_type", (q) =>
        q.eq("team", player.team).eq("teamType", player.teamType)
      )
      .collect();
    const roster = rosterDocs
      .sort((a, b) => b.overall - a.overall)
      .map((p) => ({
        name: p.name,
        slug: p.slug,
        overall: p.overall,
        positions: p.positions ?? [],
      }));

    // Cohort: same era, same primary position (era-wide when no position)
    const primaryPosition = player.positions?.[0] ?? null;
    const statsDoc = await ctx.db
      .query("cohortStats")
      .withIndex("by_teamType_and_position", (q) =>
        q.eq("teamType", player.teamType).eq("primaryPosition", primaryPosition)
      )
      .first();
    const { cohortSize, attrStats, categories, overallPct, overallAvg, similar } = statsDoc
      ? await cohortFromStats(ctx, player, statsDoc)
      : await cohortFromEraScan(ctx, player, primaryPosition);

    // In-season movement (milestones filled in over the season)
    const seasonMovement = player.seasonMovement ?? [];

    // Game-to-game rating history, exactly as 2kratings tracks it
    // (scraped onto the player doc; oldest game first for charting).
    const history = [...(player.ratingHistory ?? [])]
      .sort((a, b) => a.gameVersion.localeCompare(b.gameVersion))
      .map((h) => ({ gameVersion: h.gameVersion, overall: h.overall }));

    // Named badges by tier
    const badgeLinks = await ctx.db
      .query("playerBadges")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    const badgeDocs = await Promise.all(badgeLinks.map((l) => ctx.db.get(l.badgeId)));
    const normalizedBadges = badgeLinks
      .map((l, i) => {
        const b = badgeDocs[i];
        return b
          ? {
              name: b.name,
              slug: b.slug,
              tier: l.tier,
              imageUrl: b.imageUrl ?? null,
              description: b.description ?? null,
            }
          : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
    // The scraper's source of truth is the embedded badge list on each player.
    // Use it immediately when the normalized badge index has not been rebuilt
    // yet, so the dossier never lies with "0 badges" after a fresh scrape.
    const rawBadges = normalizedBadges.length
      ? normalizedBadges
      : (player.badges?.list ?? []).map((b) => ({
          name: b.name,
          slug: b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          tier: b.tier,
          imageUrl: b.imageUrl ?? null,
          description: b.description ?? null,
        }));
    const badges = [...new Map(rawBadges.map((b) => [`${b.slug}:${b.tier}`, b])).values()];

    return {
      player: {
        name: player.name,
        slug: player.slug,
        team: player.team,
        teamType: player.teamType,
        teamImg: player.teamImg ?? null,
        positions: player.positions ?? [],
        overall: player.overall,
        height: player.height ?? null,
        weight: player.weight ?? null,
        wingspan: player.wingspan ?? null,
        archetype: player.archetype ?? null,
        playerImage: player.playerImage ?? null,
        attributes: player.attributes ?? {},
        badgeCounts: player.badges ?? null,
      },
      primaryPosition,
      cohortSize,
      roster,
      attrStats,
      categories,
      overallPct,
      overallAvg,
      similar,
      history,
      seasonMovement,
      badges,
    };
  },
});
