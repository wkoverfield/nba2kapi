/**
 * Player History Module
 * Tracks rating changes over time within current game version
 */

import { mutation, query, internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Badge tier ranking for comparison
const TIER_RANK: Record<string, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  "Hall of Fame": 4,
  Legendary: 5,
};

/**
 * Detect changes between old and new player data
 */
function detectChanges(
  oldPlayer: any,
  newPlayer: any
): {
  hasChanges: boolean;
  overallDelta: number | undefined;
  attributeChanges: Record<string, { prev: number; new: number }>;
  badgeChanges: any;
} {
  const attributeChanges: Record<string, { prev: number; new: number }> = {};
  let hasChanges = false;

  // Check overall
  const overallDelta =
    oldPlayer.overall !== newPlayer.overall
      ? newPlayer.overall - oldPlayer.overall
      : undefined;

  if (overallDelta !== undefined) hasChanges = true;

  // Check attributes
  const oldAttrs = oldPlayer.attributes || {};
  const newAttrs = newPlayer.attributes || {};

  for (const [key, newValue] of Object.entries(newAttrs)) {
    const oldValue = oldAttrs[key];
    if (oldValue !== newValue && typeof newValue === "number") {
      attributeChanges[key] = {
        prev: typeof oldValue === "number" ? oldValue : 0,
        new: newValue as number,
      };
      hasChanges = true;
    }
  }

  // Check badges
  const badgeChanges = detectBadgeChanges(
    oldPlayer.badges?.list || [],
    newPlayer.badges?.list || []
  );

  if (
    badgeChanges &&
    (badgeChanges.added?.length ||
      badgeChanges.removed?.length ||
      badgeChanges.upgraded?.length ||
      badgeChanges.downgraded?.length)
  ) {
    hasChanges = true;
  }

  return { hasChanges, overallDelta, attributeChanges, badgeChanges };
}

/**
 * Detect badge changes between old and new badge lists
 */
function detectBadgeChanges(oldBadges: any[], newBadges: any[]) {
  const oldMap = new Map(oldBadges.map((b) => [b.name, b.tier]));
  const newMap = new Map(newBadges.map((b) => [b.name, b.tier]));

  const added: any[] = [];
  const removed: any[] = [];
  const upgraded: any[] = [];
  const downgraded: any[] = [];

  // Check new badges
  for (const [name, tier] of newMap) {
    const oldTier = oldMap.get(name);
    if (!oldTier) {
      added.push({ name, tier });
    } else if (oldTier !== tier) {
      if ((TIER_RANK[tier] || 0) > (TIER_RANK[oldTier] || 0)) {
        upgraded.push({ name, fromTier: oldTier, toTier: tier });
      } else {
        downgraded.push({ name, fromTier: oldTier, toTier: tier });
      }
    }
  }

  // Check removed badges
  for (const [name, tier] of oldMap) {
    if (!newMap.has(name)) {
      removed.push({ name, tier });
    }
  }

  return { added, removed, upgraded, downgraded };
}

/**
 * Helper function to upsert player with history tracking
 */
async function upsertWithHistoryHelper(
  ctx: MutationCtx,
  args: {
    name: string;
    slug: string;
    playerUrl?: string;
    team: string;
    teamType: "curr" | "class" | "allt";
    overall: number;
    positions?: string[];
    height?: string;
    weight?: string;
    wingspan?: string;
    archetype?: string;
    build?: string;
    college?: string;
    playerImage?: string;
    teamImg?: string;
    attributes?: Record<string, number>;
    badges?: any;
    hotZones?: any;
    ratingHistory?: any[];
    gameVersion?: string;
    scrapeJobId?: string;
    lastUpdated: string;
    createdAt?: string;
  }
) {
  const { scrapeJobId, ...playerData } = args;
  const now = new Date().toISOString();
  const gameVersion = args.gameVersion || "2K26";

  // Check if player exists by slug, teamType, and team
  const existing = await ctx.db
    .query("players")
    .withIndex("by_slug", (q) => q.eq("slug", args.slug))
    .filter((q) => q.eq(q.field("teamType"), args.teamType))
    .filter((q) => q.eq(q.field("team"), args.team))
    .first();

  if (existing) {
    // Detect changes
    const { hasChanges, overallDelta, attributeChanges, badgeChanges } =
      detectChanges(existing, playerData);

    if (hasChanges) {
      // Record the change in history - only include optional fields if they have values
      const historyEntry: any = {
        playerId: existing._id,
        scrapedAt: now,
        gameVersion,
        previousOverall: existing.overall,
        newOverall: args.overall,
        changeType: "update",
      };
      if (scrapeJobId) historyEntry.scrapeJobId = scrapeJobId;
      if (overallDelta !== undefined) historyEntry.overallDelta = overallDelta;
      if (Object.keys(attributeChanges).length > 0) {
        historyEntry.attributeChanges = attributeChanges;
      }
      if (badgeChanges && (badgeChanges.added?.length || badgeChanges.removed?.length ||
          badgeChanges.upgraded?.length || badgeChanges.downgraded?.length)) {
        historyEntry.badgeChanges = badgeChanges;
      }

      await ctx.db.insert("playerRatingHistory", historyEntry);

      // Update the player
      await ctx.db.patch(existing._id, {
        ...playerData,
        lastUpdated: now,
      });

      return { _id: existing._id, action: "updated" as const, hasChanges: true };
    } else {
      // No changes - just update timestamp
      await ctx.db.patch(existing._id, { lastUpdated: now });
      return { _id: existing._id, action: "no_change" as const, hasChanges: false };
    }
  } else {
    // New player - create initial history entry
    const playerId = await ctx.db.insert("players", {
      ...playerData,
      createdAt: args.createdAt || now,
      lastUpdated: now,
    });

    // Record initial state - only include optional fields if they have values
    const initialEntry: any = {
      playerId,
      scrapedAt: now,
      gameVersion,
      newOverall: args.overall,
      changeType: "initial",
    };
    if (scrapeJobId) initialEntry.scrapeJobId = scrapeJobId;
    if (args.attributes) initialEntry.fullAttributes = args.attributes;
    if (args.badges) initialEntry.fullBadges = args.badges;
    if (args.hotZones) initialEntry.hotZones = args.hotZones;

    await ctx.db.insert("playerRatingHistory", initialEntry);

    return { _id: playerId, action: "inserted" as const, hasChanges: true };
  }
}

/**
 * Admin-protected upsert with history tracking
 * For use by the scraper script
 */
export const adminUpsertPlayerWithHistory = mutation({
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
    badges: v.optional(v.any()),
    hotZones: v.optional(v.any()),
    ratingHistory: v.optional(v.array(v.any())),
    gameVersion: v.optional(v.string()),
    scrapeJobId: v.optional(v.string()),
    lastUpdated: v.string(),
    createdAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const envKey = process.env.ADMIN_API_KEY;
    console.log(`Admin key check: provided=${args.adminKey?.substring(0, 5)}..., env=${envKey?.substring(0, 5)}...`);

    if (args.adminKey !== envKey) {
      throw new Error(`Unauthorized: Invalid admin key. Provided starts with: ${args.adminKey?.substring(0, 5)}, Expected starts with: ${envKey?.substring(0, 5)}`);
    }

    const { adminKey, ...playerData } = args;
    return await upsertWithHistoryHelper(ctx, playerData);
  },
});

/**
 * Get rating history for a player
 */
export const getPlayerHistory = query({
  args: {
    playerId: v.id("players"),
    limit: v.optional(v.number()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let history = await ctx.db
      .query("playerRatingHistory")
      .withIndex("by_playerId_and_scrapedAt", (q) => q.eq("playerId", args.playerId))
      .order("desc")
      .collect();

    // Filter by date range if provided
    if (args.startDate) {
      history = history.filter((h) => h.scrapedAt >= args.startDate!);
    }
    if (args.endDate) {
      history = history.filter((h) => h.scrapedAt <= args.endDate!);
    }

    // Apply limit
    if (args.limit) {
      history = history.slice(0, args.limit);
    }

    return history;
  },
});

/**
 * Get specific attribute history over time
 */
export const getAttributeHistory = query({
  args: {
    playerId: v.id("players"),
    attribute: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const history = await ctx.db
      .query("playerRatingHistory")
      .withIndex("by_playerId_and_scrapedAt", (q) => q.eq("playerId", args.playerId))
      .order("asc")
      .collect();

    const timeline: { date: string; value: number }[] = [];
    let currentValue: number | null = null;

    for (const entry of history) {
      if (entry.changeType === "initial" && entry.fullAttributes) {
        currentValue = entry.fullAttributes[args.attribute] ?? null;
        if (currentValue !== null) {
          timeline.push({ date: entry.scrapedAt, value: currentValue });
        }
      } else if (entry.attributeChanges?.[args.attribute]) {
        currentValue = entry.attributeChanges[args.attribute].new;
        timeline.push({ date: entry.scrapedAt, value: currentValue });
      }
    }

    // Apply limit if specified (return most recent data points)
    if (args.limit && timeline.length > args.limit) {
      return timeline.slice(-args.limit);
    }

    return timeline;
  },
});

/**
 * Get players with biggest rating changes (trending)
 */
export const getTopRatingChanges = query({
  args: {
    teamType: v.optional(v.union(v.literal("curr"), v.literal("class"), v.literal("allt"))),
    days: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - (args.days || 7));
    const cutoff = lookbackDate.toISOString();

    // Get recent changes
    const recentChanges = await ctx.db
      .query("playerRatingHistory")
      .withIndex("by_scrapedAt")
      .filter((q) =>
        q.and(
          q.gte(q.field("scrapedAt"), cutoff),
          q.eq(q.field("changeType"), "update")
        )
      )
      .collect();

    // Filter to only changes with overall delta
    const changesWithDelta = recentChanges.filter(
      (c) => c.overallDelta !== undefined && c.overallDelta !== 0
    );

    // Group by player and sum deltas
    const playerDeltas = new Map<
      string,
      { playerId: Id<"players">; totalDelta: number; changes: number }
    >();

    for (const change of changesWithDelta) {
      const key = change.playerId;
      const existing = playerDeltas.get(key) || {
        playerId: change.playerId,
        totalDelta: 0,
        changes: 0,
      };
      existing.totalDelta += change.overallDelta || 0;
      existing.changes++;
      playerDeltas.set(key, existing);
    }

    // Sort by absolute delta
    const sorted = Array.from(playerDeltas.values())
      .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta))
      .slice(0, args.limit || 10);

    // Enrich with player data
    const enriched = await Promise.all(
      sorted.map(async (item) => {
        const player = await ctx.db.get(item.playerId);
        return {
          ...item,
          player: player
            ? {
                name: player.name,
                team: player.team,
                teamType: player.teamType,
                overall: player.overall,
                playerImage: player.playerImage,
              }
            : null,
        };
      })
    );

    // Filter by teamType if specified
    if (args.teamType) {
      return enriched.filter((e) => e.player?.teamType === args.teamType);
    }

    return enriched;
  },
});

/**
 * Create weekly snapshots for all players (called by cron)
 */
export const createWeeklySnapshots = internalMutation({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    const snapshotDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const now = new Date().toISOString();

    let created = 0;
    let skipped = 0;

    for (const player of players) {
      // Check if snapshot already exists for this date
      const existing = await ctx.db
        .query("playerSnapshots")
        .withIndex("by_playerId_and_snapshotDate", (q) =>
          q.eq("playerId", player._id).eq("snapshotDate", snapshotDate)
        )
        .first();

      if (!existing && player.attributes) {
        await ctx.db.insert("playerSnapshots", {
          playerId: player._id,
          snapshotDate,
          gameVersion: player.gameVersion || "2K26",
          overall: player.overall,
          attributes: player.attributes,
          badges: player.badges,
          hotZones: player.hotZones,
          createdAt: now,
        });
        created++;
      } else {
        skipped++;
      }
    }

    return { snapshotsCreated: created, skipped, date: snapshotDate };
  },
});

/**
 * Get player state at a specific point in time
 */
export const getPlayerAtDate = query({
  args: {
    playerId: v.id("players"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the most recent snapshot before or on this date
    const snapshots = await ctx.db
      .query("playerSnapshots")
      .withIndex("by_playerId_and_snapshotDate", (q) => q.eq("playerId", args.playerId))
      .collect();

    const snapshot = snapshots
      .filter((s) => s.snapshotDate <= args.date)
      .sort((a, b) => b.snapshotDate.localeCompare(a.snapshotDate))[0];

    if (!snapshot) {
      // No snapshot, reconstruct from initial + deltas
      const history = await ctx.db
        .query("playerRatingHistory")
        .withIndex("by_playerId_and_scrapedAt", (q) => q.eq("playerId", args.playerId))
        .filter((q) => q.lte(q.field("scrapedAt"), args.date))
        .order("asc")
        .collect();

      if (history.length === 0) return null;

      const initial = history.find((h) => h.changeType === "initial");
      if (!initial) return null;

      let attributes = { ...(initial.fullAttributes || {}) };
      let overall = initial.newOverall;

      for (const change of history) {
        if (change.changeType === "update" && change.attributeChanges) {
          for (const [key, delta] of Object.entries(change.attributeChanges)) {
            attributes[key] = delta.new;
          }
          overall = change.newOverall;
        }
      }

      return { overall, attributes, reconstructedFrom: "deltas" as const };
    }

    // Have snapshot, apply any deltas after it
    let attributes = { ...snapshot.attributes };
    let overall = snapshot.overall;

    const deltas = await ctx.db
      .query("playerRatingHistory")
      .withIndex("by_playerId_and_scrapedAt", (q) => q.eq("playerId", args.playerId))
      .filter((q) =>
        q.and(
          q.gt(q.field("scrapedAt"), snapshot.snapshotDate),
          q.lte(q.field("scrapedAt"), args.date)
        )
      )
      .collect();

    for (const change of deltas) {
      if (change.changeType === "update" && change.attributeChanges) {
        for (const [key, delta] of Object.entries(change.attributeChanges)) {
          attributes[key] = delta.new;
        }
        overall = change.newOverall;
      }
    }

    return { overall, attributes, snapshotDate: snapshot.snapshotDate };
  },
});

/**
 * Migration: Create initial history entries for existing players
 */
export const migrateExistingPlayersToHistory = internalMutation({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    const now = new Date().toISOString();

    let migrated = 0;
    let skipped = 0;

    for (const player of players) {
      // Check if already has history
      const existingHistory = await ctx.db
        .query("playerRatingHistory")
        .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
        .first();

      if (!existingHistory && player.attributes) {
        // Create initial history entry
        await ctx.db.insert("playerRatingHistory", {
          playerId: player._id,
          scrapedAt: player.createdAt || now,
          gameVersion: player.gameVersion || "2K26",
          newOverall: player.overall,
          changeType: "initial",
          fullAttributes: player.attributes,
          fullBadges: player.badges,
          hotZones: player.hotZones,
        });

        // Create current snapshot
        await ctx.db.insert("playerSnapshots", {
          playerId: player._id,
          snapshotDate: now.split("T")[0],
          gameVersion: player.gameVersion || "2K26",
          overall: player.overall,
          attributes: player.attributes,
          badges: player.badges,
          hotZones: player.hotZones,
          createdAt: now,
        });

        migrated++;
      } else {
        skipped++;
      }
    }

    return { migrated, skipped, total: players.length };
  },
});
