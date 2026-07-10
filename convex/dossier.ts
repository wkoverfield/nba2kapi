/**
 * Player Dossier aggregate — everything the dossier page needs in one query:
 * the player, roster cycling neighbors, position-cohort percentiles, similar
 * players by attribute profile, rating history, and named badges.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { ATTRIBUTE_CATEGORIES } from "./attributeCategories";

const CATEGORY_KEYS = [
  "outsideScoring",
  "insideScoring",
  "playmaking",
  "athleticism",
  "defending",
  "rebounding",
] as const;

type Attrs = Record<string, number> | undefined;

function categoryScore(attrs: Attrs, keys: readonly string[]): number | null {
  if (!attrs) return null;
  const vals = keys.map((k) => attrs[k]).filter((n): n is number => typeof n === "number");
  if (!vals.length) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

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
      .map((p) => ({ name: p.name, slug: p.slug, overall: p.overall }));

    // Cohort: same era, same primary position
    const primaryPosition = player.positions?.[0] ?? null;
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
        pct: score === null ? null : percentile(values, score),
      };
    });
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

    // Weekly rating history from snapshots
    const snaps = await ctx.db
      .query("playerSnapshots")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    const history = snaps
      .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
      .map((s) => ({ date: s.snapshotDate, overall: s.overall }))
      .slice(-20);

    // Named badges by tier
    const badgeLinks = await ctx.db
      .query("playerBadges")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .collect();
    const badgeDocs = await Promise.all(badgeLinks.map((l) => ctx.db.get(l.badgeId)));
    const badges = badgeLinks
      .map((l, i) => {
        const b = badgeDocs[i];
        return b ? { name: b.name, slug: b.slug, tier: l.tier } : null;
      })
      .filter((b): b is { name: string; slug: string; tier: string } => b !== null);

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
      cohortSize: cohort.length,
      roster,
      attrStats,
      categories,
      overallPct,
      similar,
      history,
      badges,
    };
  },
});
