import { query } from "./_generated/server";

/** Lean canonical inventory for XML sitemaps. */
export const getIndexableEntities = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    const eraRank = { curr: 0, class: 1, allt: 2 } as const;

    const playerBySlug = new Map<string, (typeof players)[number]>();
    for (const player of players) {
      const current = playerBySlug.get(player.slug);
      if (
        !current ||
        eraRank[player.teamType] < eraRank[current.teamType] ||
        (player.teamType === current.teamType && player.overall > current.overall)
      ) {
        playerBySlug.set(player.slug, player);
      }
    }

    const teamByKey = new Map<string, { slug: string; teamType: "curr" | "class" | "allt"; lastUpdated: string }>();
    for (const player of players) {
      const slug = player.team.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const key = `${player.teamType}:${slug}`;
      const current = teamByKey.get(key);
      if (!current || player.lastUpdated > current.lastUpdated) {
        teamByKey.set(key, { slug, teamType: player.teamType, lastUpdated: player.lastUpdated });
      }
    }

    return {
      players: [...playerBySlug.values()]
        .map((player) => ({ slug: player.slug, lastUpdated: player.lastUpdated }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
      teams: [...teamByKey.values()].sort(
        (a, b) => a.teamType.localeCompare(b.teamType) || a.slug.localeCompare(b.slug)
      ),
      badges: (await ctx.db.query("badges").collect())
        .map((badge) => ({ slug: badge.slug }))
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    };
  },
});
