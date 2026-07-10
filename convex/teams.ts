/**
 * Team Queries
 * Team-specific queries and statistics
 */

import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get team by slug - helper to convert slug to team name
 */
export const getTeamBySlug = query({
  args: {
    slug: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
  },
  handler: async (ctx, args) => {
    // Get all players of this team type
    const players = await ctx.db
      .query("players")
      .filter((q) => q.eq(q.field("teamType"), args.teamType))
      .collect();

    // Find a player whose team name matches the slug
    const matchingPlayer = players.find((p) => {
      const teamSlug = p.team.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return teamSlug === args.slug;
    });

    if (!matchingPlayer) {
      return null;
    }

    return {
      name: matchingPlayer.team,
      slug: args.slug,
      teamType: args.teamType,
    };
  },
});

/**
 * The Board: every team of an era ranked by average roster rating, with the
 * best player attached. One row per team, slim payload.
 */
export const getBoard = query({
  args: {
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
  },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType))
      .collect();

    type Agg = {
      team: string;
      logo: string | null;
      count: number;
      sum: number;
      best: (typeof players)[number];
    };
    const byTeam = new Map<string, Agg>();
    for (const p of players) {
      let agg = byTeam.get(p.team);
      if (!agg) {
        agg = { team: p.team, logo: p.teamImg ?? null, count: 0, sum: 0, best: p };
        byTeam.set(p.team, agg);
      }
      agg.count++;
      agg.sum += p.overall;
      if (!agg.logo && p.teamImg) agg.logo = p.teamImg;
      if (p.overall > agg.best.overall) agg.best = p;
    }

    return [...byTeam.values()]
      .map((t) => ({
        team: t.team,
        slug: t.team.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        logo: t.logo,
        playerCount: t.count,
        avgRating: Math.round((t.sum / t.count) * 10) / 10,
        bestPlayer: {
          name: t.best.name,
          slug: t.best.slug,
          overall: t.best.overall,
          playerImage: t.best.playerImage ?? null,
        },
      }))
      .sort((a, b) => b.avgRating - a.avgRating || a.team.localeCompare(b.team));
  },
});

/**
 * Get detailed team statistics
 */
export const getTeamStats = query({
  args: {
    team: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
  },
  handler: async (ctx, args) => {
    // Get all players for this team
    const players = await ctx.db
      .query("players")
      .withIndex("by_team", (q) => q.eq("team", args.team))
      .filter((q) => q.eq(q.field("teamType"), args.teamType))
      .collect();

    if (players.length === 0) {
      return null;
    }

    // Calculate team statistics
    const totalOverall = players.reduce((sum, p) => sum + p.overall, 0);
    const avgOverall = Math.round(totalOverall / players.length);

    // Get highest rated player
    const topPlayer = players.reduce((max, p) => (p.overall > max.overall ? p : max));

    // Calculate position distribution
    const positionCounts: Record<string, number> = {};
    players.forEach((player) => {
      if (player.positions) {
        player.positions.forEach((pos) => {
          positionCounts[pos] = (positionCounts[pos] || 0) + 1;
        });
      }
    });

    // Calculate average attributes if available
    const attributeStats: Record<string, { sum: number; count: number; avg: number }> = {};
    players.forEach((player) => {
      if (player.attributes) {
        Object.entries(player.attributes).forEach(([category, attrs]: [string, any]) => {
          if (typeof attrs === "object" && attrs !== null) {
            Object.entries(attrs).forEach(([attrName, value]: [string, any]) => {
              if (typeof value === "number") {
                const key = `${category}.${attrName}`;
                if (!attributeStats[key]) {
                  attributeStats[key] = { sum: 0, count: 0, avg: 0 };
                }
                attributeStats[key].sum += value;
                attributeStats[key].count += 1;
              }
            });
          }
        });
      }
    });

    // Calculate averages
    Object.keys(attributeStats).forEach((key) => {
      const stat = attributeStats[key];
      stat.avg = Math.round(stat.sum / stat.count);
    });

    // Badge statistics
    const badgeCounts: Record<string, { HOF: number; Gold: number; Silver: number; Bronze: number }> = {};
    players.forEach((player) => {
      if (player.badges) {
        Object.entries(player.badges).forEach(([category, badges]: [string, any]) => {
          if (Array.isArray(badges)) {
            badges.forEach((badge: any) => {
              if (!badgeCounts[badge.name]) {
                badgeCounts[badge.name] = { HOF: 0, Gold: 0, Silver: 0, Bronze: 0 };
              }
              const tier = badge.tier.toUpperCase() === "HALL OF FAME" ? "HOF" : badge.tier;
              if (tier in badgeCounts[badge.name]) {
                badgeCounts[badge.name][tier as keyof typeof badgeCounts[string]]++;
              }
            });
          }
        });
      }
    });

    return {
      team: args.team,
      teamType: args.teamType,
      logo: players[0].teamImg || "",
      playerCount: players.length,
      avgOverall,
      topPlayer: {
        name: topPlayer.name,
        slug: topPlayer.slug,
        overall: topPlayer.overall,
        positions: topPlayer.positions,
        image: topPlayer.playerImage,
      },
      positionDistribution: positionCounts,
      attributeAverages: attributeStats,
      badgeStats: badgeCounts,
    };
  },
});

/**
 * Get team roster with sorting options
 */
export const getTeamRoster = query({
  args: {
    team: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    sortBy: v.optional(v.union(v.literal("overall"), v.literal("name"), v.literal("position"))),
    position: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let players = await ctx.db
      .query("players")
      .withIndex("by_team", (q) => q.eq("team", args.team))
      .filter((q) => q.eq(q.field("teamType"), args.teamType))
      .collect();

    // Filter by position if specified
    if (args.position) {
      players = players.filter((p) =>
        p.positions?.some((pos) => pos === args.position)
      );
    }

    // Sort players
    const sortBy = args.sortBy || "overall";
    if (sortBy === "overall") {
      players.sort((a, b) => b.overall - a.overall);
    } else if (sortBy === "name") {
      players.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "position") {
      players.sort((a, b) => {
        const posA = a.positions?.[0] || "";
        const posB = b.positions?.[0] || "";
        return posA.localeCompare(posB);
      });
    }

    return players;
  },
});

/**
 * Get team comparison (compare multiple teams)
 */
export const compareTeams = query({
  args: {
    teams: v.array(v.object({
      name: v.string(),
      teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    })),
  },
  handler: async (ctx, args) => {
    const teamStats = await Promise.all(
      args.teams.map(async (team) => {
        const players = await ctx.db
          .query("players")
          .withIndex("by_team", (q) => q.eq("team", team.name))
          .filter((q) => q.eq(q.field("teamType"), team.teamType))
          .collect();

        if (players.length === 0) {
          return null;
        }

        const avgOverall = Math.round(
          players.reduce((sum, p) => sum + p.overall, 0) / players.length
        );

        const topPlayer = players.reduce((max, p) =>
          p.overall > max.overall ? p : max
        );

        return {
          team: team.name,
          teamType: team.teamType,
          playerCount: players.length,
          avgOverall,
          topPlayer: {
            name: topPlayer.name,
            overall: topPlayer.overall,
          },
          logo: players[0].teamImg || "",
        };
      })
    );

    return teamStats.filter((stat) => stat !== null);
  },
});

/**
 * Get all unique teams with metadata
 */
export const getAllTeams = query({
  args: {
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
  },
  handler: async (ctx, args) => {
    let players = await ctx.db.query("players").collect();

    // Filter by team type if specified
    if (args.teamType) {
      players = players.filter((p) => p.teamType === args.teamType);
    }

    // Group by team and teamType
    const teamsMap = new Map<string, {
      name: string;
      slug: string;
      type: string;
      playerCount: number;
      avgRating: number;
      logo: string;
      topPlayerOverall: number;
    }>();

    for (const player of players) {
      const key = `${player.team}-${player.teamType}`;
      if (!teamsMap.has(key)) {
        // Create slug from team name
        const slug = player.team.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        teamsMap.set(key, {
          name: player.team,
          slug,
          type: player.teamType,
          playerCount: 0,
          avgRating: 0,
          logo: player.teamImg || "",
          topPlayerOverall: 0,
        });
      }

      const team = teamsMap.get(key)!;
      team.playerCount++;
      team.avgRating += player.overall;
      team.topPlayerOverall = Math.max(team.topPlayerOverall, player.overall);
    }

    // Calculate average ratings and sort
    const teams = Array.from(teamsMap.values())
      .map((team) => ({
        ...team,
        avgRating: Math.round(team.avgRating / team.playerCount),
      }))
      .sort((a, b) => b.avgRating - a.avgRating);

    return teams;
  },
});
