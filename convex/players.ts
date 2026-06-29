/**
 * Player Mutations and Queries
 * CRUD operations for NBA 2K player data
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Insert a single player into the database
 * Internal only - not callable from client
 */
export const insertPlayer = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    playerUrl: v.optional(v.string()),
    team: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    overall: v.number(),
    positions: v.optional(v.array(v.string())),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    wingspan: v.optional(v.string()),
    archetype: v.optional(v.string()),
    build: v.optional(v.string()),
    college: v.optional(v.string()),
    playerImage: v.optional(v.string()),
    teamImg: v.optional(v.string()),
    attributes: v.optional(v.record(v.string(), v.number())),
    badges: v.optional(
      v.object({
        total: v.optional(v.number()),
        legendary: v.optional(v.number()),
        hallOfFame: v.optional(v.number()),
        gold: v.optional(v.number()),
        silver: v.optional(v.number()),
        bronze: v.optional(v.number()),
        list: v.optional(v.array(
          v.object({
            name: v.string(),
            tier: v.string(),
            category: v.optional(v.string()),
          })
        )),
      })
    ),
    lastUpdated: v.string(),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const playerId = await ctx.db.insert("players", args);
    return playerId;
  },
});

/**
 * Helper function to upsert a player
 */
async function upsertPlayerHelper(ctx: any, args: any) {
  // Check if player exists by slug and team type
  const existing = await ctx.db
    .query("players")
    .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
    .filter((q: any) => q.eq(q.field("teamType"), args.teamType))
    .filter((q: any) => q.eq(q.field("team"), args.team))
    .first();

  if (existing) {
    // Update existing player
    await ctx.db.patch(existing._id, {
      ...args,
      lastUpdated: new Date().toISOString(),
    });
    return { _id: existing._id, action: "updated" };
  } else {
    // Insert new player
    const playerId = await ctx.db.insert("players", {
      ...args,
      createdAt: args.createdAt || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });
    return { _id: playerId, action: "inserted" };
  }
}

/**
 * Upsert a player - update if exists (by slug), insert if new
 * Internal only - not callable from client
 */
export const upsertPlayer = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    playerUrl: v.optional(v.string()),
    team: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    overall: v.number(),
    positions: v.optional(v.array(v.string())),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    wingspan: v.optional(v.string()),
    archetype: v.optional(v.string()),
    build: v.optional(v.string()),
    college: v.optional(v.string()),
    playerImage: v.optional(v.string()),
    teamImg: v.optional(v.string()),
    attributes: v.optional(v.record(v.string(), v.number())),
    badges: v.optional(
      v.object({
        total: v.optional(v.number()),
        legendary: v.optional(v.number()),
        hallOfFame: v.optional(v.number()),
        gold: v.optional(v.number()),
        silver: v.optional(v.number()),
        bronze: v.optional(v.number()),
        list: v.optional(v.array(
          v.object({
            name: v.string(),
            tier: v.string(),
            category: v.optional(v.string()),
          })
        )),
      })
    ),
    lastUpdated: v.string(),
    createdAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await upsertPlayerHelper(ctx, args);
  },
});

/**
 * Bulk upsert players - efficient batch operation
 * Internal only - not callable from client
 */
export const bulkUpsertPlayers = internalMutation({
  args: {
    players: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
    };

    for (const player of args.players) {
      try {
        const result = await upsertPlayerHelper(ctx, player);
        if (result.action === "inserted") {
          results.inserted++;
        } else {
          results.updated++;
        }
      } catch (error) {
        console.error(`Failed to upsert player: ${player.name}`, error);
        results.errors++;
      }
    }

    return results;
  },
});

/**
 * Delete a player by ID
 * Internal only - not callable from client
 */
export const deletePlayer = internalMutation({
  args: { id: v.id("players") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Delete all players (use with caution!)
 * Internal only - not callable from client
 */
export const deleteAllPlayers = internalMutation({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    for (const player of players) {
      await ctx.db.delete(player._id);
    }
    return { deleted: players.length };
  },
});

/**
 * Reconcile a teamType's roster after a full scrape: remove "orphan" players
 * that were NOT seen in the latest scrape (i.e. players who left a roster).
 *
 * Why: the scraper upserts by slug+team+teamType but never deletes departed
 * players. With offseason roster churn this leaves stale duplicate rows — e.g.
 * a traded player keeps a row under their old team AND gets a fresh row under
 * the new one, so the API returns them twice on the wrong team.
 *
 * Orphans = players of `teamType` whose `lastUpdated` is older than the scrape
 * run's start (every player touched this run was patched to a newer timestamp).
 *
 * SAFETY: this deletes production data, so it refuses to run when a scrape looks
 * partial/broken — if it found nothing, or if pruning would remove more than
 * MAX_PRUNE_FRACTION of the teamType. A false delete is self-healing anyway: the
 * next scrape re-inserts anyone actually on a roster. Requires ADMIN_API_KEY.
 * Pass dryRun to preview without deleting.
 */
export const reconcileRoster = mutation({
  args: {
    adminKey: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    runStartedAt: v.string(), // ISO; players with lastUpdated < this weren't seen this run
    scrapedCount: v.number(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (args.adminKey !== process.env.ADMIN_API_KEY) {
      throw new Error("Unauthorized: Invalid admin key");
    }

    const MAX_PRUNE_FRACTION = 0.4; // never remove >40% of a teamType in one run

    const players = await ctx.db
      .query("players")
      .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType))
      .collect();
    const existingCount = players.length;

    // ISO 8601 strings sort lexicographically, so `<` is a valid time comparison.
    const orphans = players.filter(
      (p) => !p.lastUpdated || p.lastUpdated < args.runStartedAt
    );
    const orphanCount = orphans.length;

    const reasons: string[] = [];
    if (args.scrapedCount <= 0) reasons.push("scrapedCount<=0");
    if (
      existingCount > 0 &&
      orphanCount > Math.floor(existingCount * MAX_PRUNE_FRACTION)
    ) {
      reasons.push(
        `would prune ${orphanCount}/${existingCount} (${Math.round(
          (100 * orphanCount) / existingCount
        )}%) > ${MAX_PRUNE_FRACTION * 100}% cap`
      );
    }
    const aborted = reasons.length > 0;

    const sample = orphans
      .slice(0, 15)
      .map((p) => ({ name: p.name, team: p.team, lastUpdated: p.lastUpdated }));

    let deleted = 0;
    if (!aborted && !args.dryRun) {
      for (const o of orphans) {
        await ctx.db.delete(o._id);
        deleted++;
      }
    }

    const result = {
      teamType: args.teamType,
      existingCount,
      scrapedCount: args.scrapedCount,
      orphanCount,
      deleted,
      dryRun: !!args.dryRun,
      aborted,
      reasons,
      sample,
    };
    console.log("[reconcileRoster]", JSON.stringify(result));
    return result;
  },
});

/**
 * Update player positions array (for migration)
 * Internal only - not callable from client
 */
export const updatePlayerPositions = internalMutation({
  args: {
    playerId: v.id("players"),
    positions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      positions: args.positions,
    });
    return { success: true };
  },
});

/**
 * Update player attributes (for normalization migration)
 * Internal only - not callable from client
 */
export const updatePlayer = internalMutation({
  args: {
    id: v.id("players"),
    attributes: v.optional(v.record(v.string(), v.number())),
    badges: v.optional(
      v.object({
        total: v.optional(v.number()),
        legendary: v.optional(v.number()),
        hallOfFame: v.optional(v.number()),
        gold: v.optional(v.number()),
        silver: v.optional(v.number()),
        bronze: v.optional(v.number()),
        list: v.optional(v.array(
          v.object({
            name: v.string(),
            tier: v.string(),
            category: v.optional(v.string()),
          })
        )),
      })
    ),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      lastUpdated: new Date().toISOString(),
    };

    if (args.attributes !== undefined) {
      updates.attributes = args.attributes;
    }

    if (args.badges !== undefined) {
      updates.badges = args.badges;
    }

    await ctx.db.patch(args.id, updates);
    return { success: true };
  },
});

// ============================================================================
// ADMIN-PROTECTED MUTATIONS (for scripts)
// ============================================================================

/**
 * Admin-protected update player mutation for scripts
 * Requires ADMIN_API_KEY for authorization
 */
export const adminUpdatePlayer = mutation({
  args: {
    adminKey: v.string(),
    id: v.id("players"),
    attributes: v.optional(v.record(v.string(), v.number())),
    badges: v.optional(
      v.object({
        total: v.optional(v.number()),
        legendary: v.optional(v.number()),
        hallOfFame: v.optional(v.number()),
        gold: v.optional(v.number()),
        silver: v.optional(v.number()),
        bronze: v.optional(v.number()),
        list: v.optional(v.array(
          v.object({
            name: v.string(),
            tier: v.string(),
            category: v.optional(v.string()),
          })
        )),
      })
    ),
  },
  handler: async (ctx, args) => {
    if (args.adminKey !== process.env.ADMIN_API_KEY) {
      throw new Error("Unauthorized: Invalid admin key");
    }

    const updates: any = {
      lastUpdated: new Date().toISOString(),
    };

    if (args.attributes !== undefined) {
      updates.attributes = args.attributes;
    }

    if (args.badges !== undefined) {
      updates.badges = args.badges;
    }

    await ctx.db.patch(args.id, updates);
    return { success: true };
  },
});

/**
 * Admin-protected upsert player mutation for scripts
 * Requires ADMIN_API_KEY for authorization
 */
export const adminUpsertPlayer = mutation({
  args: {
    adminKey: v.string(),
    name: v.string(),
    slug: v.string(),
    playerUrl: v.optional(v.string()),
    team: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    overall: v.number(),
    positions: v.optional(v.array(v.string())),
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    wingspan: v.optional(v.string()),
    archetype: v.optional(v.string()),
    build: v.optional(v.string()),
    college: v.optional(v.string()),
    playerImage: v.optional(v.string()),
    teamImg: v.optional(v.string()),
    attributes: v.optional(v.record(v.string(), v.number())),
    badges: v.optional(
      v.object({
        total: v.optional(v.number()),
        legendary: v.optional(v.number()),
        hallOfFame: v.optional(v.number()),
        gold: v.optional(v.number()),
        silver: v.optional(v.number()),
        bronze: v.optional(v.number()),
        list: v.optional(v.array(
          v.object({
            name: v.string(),
            tier: v.string(),
            category: v.optional(v.string()),
          })
        )),
      })
    ),
    lastUpdated: v.string(),
    createdAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.adminKey !== process.env.ADMIN_API_KEY) {
      throw new Error("Unauthorized: Invalid admin key");
    }

    // Remove adminKey from args before passing to helper
    const { adminKey, ...playerData } = args;
    return await upsertPlayerHelper(ctx, playerData);
  },
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all players with pagination
 */
export const getAllPlayers = query({
  args: {
    paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("players")
      .order("desc")
      .paginate(args.paginationOpts || { numItems: 50, cursor: null });

    return results;
  },
});

/**
 * Get player by ID
 */
export const getPlayerById = query({
  args: { id: v.id("players") },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.id);
    return player;
  },
});

/**
 * Get player by slug
 */
export const getPlayerBySlug = query({
  args: {
    slug: v.string(),
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
    team: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("players")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug));

    let players = await query.collect();

    // Filter by team type if specified
    if (args.teamType) {
      players = players.filter((p) => p.teamType === args.teamType);
    }

    // Filter by team if specified (for players on multiple teams like MJ on different Bulls squads)
    if (args.team) {
      players = players.filter((p) => p.team === args.team);
    }

    // Return first match
    return players.length > 0 ? players[0] : null;
  },
});

/**
 * Search players by name
 */
export const searchPlayers = query({
  args: {
    query: v.string(),
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
  },
  handler: async (ctx, args) => {
    // Use index if teamType is provided for better performance
    let players;
    if (args.teamType !== undefined) {
      players = await ctx.db
        .query("players")
        .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType!))
        .collect();
    } else {
      players = await ctx.db.query("players").collect();
    }

    // Search by name (case-insensitive)
    const searchQuery = args.query.toLowerCase();
    players = players.filter((p) =>
      p.name.toLowerCase().includes(searchQuery)
    );

    // Limit results to 50 (matching documentation)
    return players.slice(0, 50);
  },
});

/**
 * Get players by team
 */
export const getPlayersByTeam = query({
  args: {
    team: v.string(),
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
  },
  handler: async (ctx, args) => {
    let players;

    // Use compound index if teamType is provided for better performance
    if (args.teamType !== undefined) {
      players = await ctx.db
        .query("players")
        .withIndex("by_team_and_type", (q) =>
          q.eq("team", args.team).eq("teamType", args.teamType!)
        )
        .collect();
    } else {
      players = await ctx.db
        .query("players")
        .withIndex("by_team", (q) => q.eq("team", args.team))
        .collect();
    }

    // Sort by overall rating (descending)
    players.sort((a, b) => b.overall - a.overall);

    return players;
  },
});

/**
 * Get players by team type
 */
export const getPlayersByType = query({
  args: {
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    minRating: v.optional(v.number()),
    maxRating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let players = await ctx.db
      .query("players")
      .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType))
      .collect();

    // Filter by rating range if specified
    if (args.minRating !== undefined) {
      players = players.filter((p) => p.overall >= args.minRating!);
    }
    if (args.maxRating !== undefined) {
      players = players.filter((p) => p.overall <= args.maxRating!);
    }

    return players;
  },
});

/**
 * Get all teams (unique team names with player counts)
 */
export const getTeams = query({
  args: {
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
  },
  handler: async (ctx, args) => {
    let players = await ctx.db.query("players").collect();

    // Filter by team type if specified
    if (args.teamType) {
      players = players.filter((p) => p.teamType === args.teamType);
    }

    // Group by team
    const teamsMap = new Map<string, { teamName: string; teamType: string; playerCount: number; averageRating: number; logo: string }>();

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

    // Calculate average ratings
    const teams = Array.from(teamsMap.values()).map((team) => ({
      ...team,
      averageRating: Math.round(team.averageRating / team.playerCount),
    }));

    // Sort by team name
    teams.sort((a, b) => a.teamName.localeCompare(b.teamName));

    return teams;
  },
});

/**
 * Get database statistics
 */
export const getStats = query({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();

    const stats = {
      totalPlayers: players.length,
      byType: {
        curr: players.filter((p) => p.teamType === "curr").length,
        class: players.filter((p) => p.teamType === "class").length,
        allt: players.filter((p) => p.teamType === "allt").length,
      },
      uniqueTeams: new Set(players.map((p) => p.team)).size,
      avgOverall: players.length > 0
        ? Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length)
        : 0,
      lastUpdated: players.length > 0
        ? players.reduce((latest, p) => (p.lastUpdated > latest ? p.lastUpdated : latest), players[0].lastUpdated)
        : null,
    };

    return stats;
  },
});

/**
 * Get all players with comprehensive filtering options
 */
export const getAllFiltered = query({
  args: {
    search: v.optional(v.string()),
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
    teams: v.optional(v.array(v.string())),
    positions: v.optional(v.array(v.string())),
    minOverall: v.optional(v.number()),
    maxOverall: v.optional(v.number()),
    sortBy: v.optional(v.union(
      v.literal("overall-desc"),
      v.literal("overall-asc"),
      v.literal("name-asc"),
      v.literal("name-desc")
    )),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use database indexes for better performance when possible
    let players;

    // Optimize query based on available filters
    if (args.teams && args.teams.length === 1 && args.teamType !== undefined) {
      // Use compound index for single team + teamType
      players = await ctx.db
        .query("players")
        .withIndex("by_team_and_type", (q) =>
          q.eq("team", args.teams![0]).eq("teamType", args.teamType!)
        )
        .collect();
    } else if (args.teamType !== undefined) {
      // Use teamType index
      players = await ctx.db
        .query("players")
        .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType!))
        .collect();
    } else if (args.teams && args.teams.length === 1) {
      // Use team index for single team
      players = await ctx.db
        .query("players")
        .withIndex("by_team", (q) => q.eq("team", args.teams![0]))
        .collect();
    } else {
      // Fallback to full scan only when necessary
      players = await ctx.db.query("players").collect();
    }

    // Filter by search query (name)
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      players = players.filter((p) =>
        p.name.toLowerCase().includes(searchLower)
      );
    }

    // Filter by multiple teams if provided and not already filtered by index
    if (args.teams && args.teams.length > 1) {
      players = players.filter((p) => args.teams!.includes(p.team));
    }

    // Filter by positions
    if (args.positions && args.positions.length > 0) {
      players = players.filter((p) =>
        p.positions?.some((pos) => args.positions!.includes(pos))
      );
    }

    // Filter by overall rating range
    if (args.minOverall !== undefined) {
      players = players.filter((p) => p.overall >= args.minOverall!);
    }
    if (args.maxOverall !== undefined) {
      players = players.filter((p) => p.overall <= args.maxOverall!);
    }

    // Sort players
    const sortBy = args.sortBy || "overall-desc";
    if (sortBy === "overall-desc") {
      players.sort((a, b) => b.overall - a.overall);
    } else if (sortBy === "overall-asc") {
      players.sort((a, b) => a.overall - b.overall);
    } else if (sortBy === "name-asc") {
      players.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      players.sort((a, b) => b.name.localeCompare(a.name));
    }

    // Get total count before pagination
    const totalCount = players.length;

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 50;
    players = players.slice(offset, offset + limit);

    return {
      players,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  },
});

/**
 * Get multiple players by their slugs (for lineup builder)
 */
export const getPlayersBySlugs = query({
  args: {
    slugs: v.array(v.string()),
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
  },
  handler: async (ctx, args) => {
    if (args.slugs.length === 0) return [];

    const players = [];

    for (const slug of args.slugs) {
      let query = ctx.db
        .query("players")
        .withIndex("by_slug", (q) => q.eq("slug", slug));

      let results = await query.collect();

      // Filter by team type if specified
      if (args.teamType) {
        results = results.filter((p) => p.teamType === args.teamType);
      }

      // Add ALL matches for this slug (not just first) to support multiple versions
      players.push(...results);
    }

    return players;
  },
});

/**
 * Get position-based average statistics
 * Calculates averages across all team types for a given position
 */
export const getPositionAverages = query({
  args: {
    position: v.string(), // "PG", "SG", "SF", "PF", "C"
  },
  handler: async (ctx, args) => {
    // Get all players
    let players = await ctx.db.query("players").collect();

    // Filter by position (players can have multiple positions)
    players = players.filter((p) => p.positions?.includes(args.position));

    if (players.length === 0) {
      return {
        position: args.position,
        playerCount: 0,
        avgOverall: 0,
        attributes: {},
      };
    }

    // Calculate average overall rating
    const avgOverall = Math.round(
      players.reduce((sum, p) => sum + p.overall, 0) / players.length
    );

    // Calculate averages for all attributes
    const attributeAverages: Record<string, number> = {};
    const attributeCounts: Record<string, number> = {};

    players.forEach((player) => {
      if (player.attributes) {
        Object.entries(player.attributes).forEach(([key, value]) => {
          if (typeof value === "number") {
            attributeAverages[key] = (attributeAverages[key] || 0) + value;
            attributeCounts[key] = (attributeCounts[key] || 0) + 1;
          }
        });
      }
    });

    // Calculate final averages and round to whole numbers
    const averages: Record<string, number> = {};
    Object.keys(attributeAverages).forEach((key) => {
      averages[key] = Math.round(attributeAverages[key] / attributeCounts[key]);
    });

    return {
      position: args.position,
      playerCount: players.length,
      avgOverall,
      attributes: averages,
    };
  },
});
