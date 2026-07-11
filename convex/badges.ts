/**
 * Badges Module
 * Normalized badge storage and player-badge relationships
 */

import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { CURRENT_GAME_VERSION } from "./gameVersion";
import { Id } from "./_generated/dataModel";

/**
 * Create URL-friendly slug from badge name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Upsert a badge - create or update badge reference
 */
export const upsertBadge = internalMutation({
  args: {
    name: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    gameVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slug = slugify(args.name);
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("badges")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      // Update existing badge
      await ctx.db.patch(existing._id, {
        category: args.category,
        description: args.description ?? existing.description,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        gameVersion: args.gameVersion ?? existing.gameVersion,
        lastUpdated: now,
      });
      return { _id: existing._id, action: "updated" as const };
    } else {
      // Create new badge - only include optional fields if they have values
      const newBadge: any = {
        name: args.name,
        slug,
        category: args.category,
        lastUpdated: now,
        createdAt: now,
      };
      if (args.description) newBadge.description = args.description;
      if (args.imageUrl) newBadge.imageUrl = args.imageUrl;
      if (args.gameVersion) newBadge.gameVersion = args.gameVersion;

      const id = await ctx.db.insert("badges", newBadge);
      return { _id: id, action: "inserted" as const };
    }
  },
});

/**
 * Bulk upsert badges from scraper
 */
export const bulkUpsertBadges = internalMutation({
  args: {
    badges: v.array(
      v.object({
        name: v.string(),
        category: v.string(),
        description: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        gameVersion: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;

    for (const badge of args.badges) {
      const slug = slugify(badge.name);

      const existing = await ctx.db
        .query("badges")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          category: badge.category,
          description: badge.description ?? existing.description,
          imageUrl: badge.imageUrl ?? existing.imageUrl,
          gameVersion: badge.gameVersion ?? existing.gameVersion,
          lastUpdated: now,
        });
        updated++;
      } else {
        // Only include optional fields if they have values
        const newBadge: any = {
          name: badge.name,
          slug,
          category: badge.category,
          lastUpdated: now,
          createdAt: now,
        };
        if (badge.description) newBadge.description = badge.description;
        if (badge.imageUrl) newBadge.imageUrl = badge.imageUrl;
        if (badge.gameVersion) newBadge.gameVersion = badge.gameVersion;

        await ctx.db.insert("badges", newBadge);
        inserted++;
      }
    }

    return { inserted, updated };
  },
});

/**
 * Set player badges - replaces existing badges for a player
 */
export const setPlayerBadges = internalMutation({
  args: {
    playerId: v.id("players"),
    badges: v.array(
      v.object({
        name: v.string(),
        tier: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete existing player badge links
    const existing = await ctx.db
      .query("playerBadges")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();

    for (const link of existing) {
      await ctx.db.delete(link._id);
    }

    // Insert new links
    let linked = 0;
    let notFound = 0;

    for (const badge of args.badges) {
      const slug = slugify(badge.name);
      const badgeDoc = await ctx.db
        .query("badges")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (badgeDoc) {
        await ctx.db.insert("playerBadges", {
          playerId: args.playerId,
          badgeId: badgeDoc._id,
          tier: badge.tier,
        });
        linked++;
      } else {
        notFound++;
      }
    }

    return { linked, notFound, removed: existing.length };
  },
});

/**
 * Get badges for a player (with full badge details)
 */
export const getPlayerBadges = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("playerBadges")
      .withIndex("by_playerId", (q) => q.eq("playerId", args.playerId))
      .collect();

    const badges = await Promise.all(
      links.map(async (link) => {
        const badge = await ctx.db.get(link.badgeId);
        return badge
          ? {
              _id: badge._id,
              name: badge.name,
              slug: badge.slug,
              category: badge.category,
              description: badge.description,
              imageUrl: badge.imageUrl,
              tier: link.tier,
            }
          : null;
      })
    );

    return badges.filter(Boolean);
  },
});

/**
 * Get all badges
 */
export const getAllBadges = query({
  args: {
    category: v.optional(v.string()),
    gameVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let badges;

    if (args.category) {
      badges = await ctx.db
        .query("badges")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    } else {
      badges = await ctx.db.query("badges").collect();
    }

    if (args.gameVersion) {
      badges = badges.filter((b) => b.gameVersion === args.gameVersion);
    }

    // Sort by category then name
    badges.sort((a, b) => {
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    });

    return badges;
  },
});

/**
 * Get badge by slug
 */
export const getBadgeBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("badges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Get players with a specific badge
 */
export const getPlayersWithBadge = query({
  args: {
    badgeSlug: v.string(),
    tier: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get badge by slug
    const badge = await ctx.db
      .query("badges")
      .withIndex("by_slug", (q) => q.eq("slug", args.badgeSlug))
      .first();

    if (!badge) return [];

    // Get all player-badge links for this badge
    let links = await ctx.db
      .query("playerBadges")
      .withIndex("by_badgeId", (q) => q.eq("badgeId", badge._id))
      .collect();

    // Filter by tier if specified
    if (args.tier) {
      links = links.filter((l) => l.tier === args.tier);
    }

    // Apply limit
    if (args.limit) {
      links = links.slice(0, args.limit);
    }

    // Get player details
    const players = await Promise.all(
      links.map(async (link) => {
        const player = await ctx.db.get(link.playerId);
        return player
          ? {
              _id: player._id,
              name: player.name,
              slug: player.slug,
              team: player.team,
              teamType: player.teamType,
              overall: player.overall,
              playerImage: player.playerImage,
              badgeTier: link.tier,
            }
          : null;
      })
    );

    return players.filter(Boolean);
  },
});

/**
 * Get badge categories with counts
 */
export const getBadgeCategories = query({
  handler: async (ctx) => {
    const badges = await ctx.db.query("badges").collect();

    const categoryCounts = new Map<string, number>();
    for (const badge of badges) {
      const count = categoryCounts.get(badge.category) || 0;
      categoryCounts.set(badge.category, count + 1);
    }

    return Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category));
  },
});

/** Badge almanac projection with real player and tier counts. */
export const getBadgeDirectory = query({
  args: {},
  handler: async (ctx) => {
    const [badges, links] = await Promise.all([
      ctx.db.query("badges").collect(),
      ctx.db.query("playerBadges").collect(),
    ]);
    const byBadge = new Map<string, { players: Set<string>; tiers: Record<string, number> }>();
    for (const link of links) {
      const key = String(link.badgeId);
      const aggregate = byBadge.get(key) ?? { players: new Set<string>(), tiers: {} };
      aggregate.players.add(String(link.playerId));
      aggregate.tiers[link.tier] = (aggregate.tiers[link.tier] ?? 0) + 1;
      byBadge.set(key, aggregate);
    }
    return badges
      .map((badge) => {
        const aggregate = byBadge.get(String(badge._id));
        return {
          name: badge.name,
          slug: badge.slug,
          category: badge.category,
          description: badge.description ?? null,
          imageUrl: badge.imageUrl ?? null,
          playerCount: aggregate?.players.size ?? 0,
          tierCounts: aggregate?.tiers ?? {},
        };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  },
});

/** One badge, its distribution, and the strongest player examples. */
export const getBadgeDetail = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const badge = await ctx.db
      .query("badges")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!badge) return null;
    const links = await ctx.db
      .query("playerBadges")
      .withIndex("by_badgeId", (q) => q.eq("badgeId", badge._id))
      .collect();
    const players = (
      await Promise.all(
        links.map(async (link) => {
          const player = await ctx.db.get(link.playerId);
          return player
            ? {
                name: player.name,
                slug: player.slug,
                team: player.team,
                teamType: player.teamType,
                overall: player.overall,
                positions: player.positions ?? [],
                playerImage: player.playerImage ?? null,
                tier: link.tier,
              }
            : null;
        })
      )
    ).filter((player) => player !== null);
    players.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
    const tierCounts: Record<string, number> = {};
    for (const player of players) tierCounts[player.tier] = (tierCounts[player.tier] ?? 0) + 1;
    return {
      badge: {
        name: badge.name,
        slug: badge.slug,
        category: badge.category,
        description: badge.description ?? null,
        imageUrl: badge.imageUrl ?? null,
      },
      playerCount: new Set(players.map((player) => `${player.slug}:${player.teamType}:${player.team}`)).size,
      tierCounts,
      players,
    };
  },
});

/**
 * Sync badges from player data (for migration)
 * Extracts unique badges from all players and creates badge records
 */
export const syncBadgesFromPlayers = internalMutation({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();
    const now = new Date().toISOString();

    const seenBadges = new Map<
      string,
      { name: string; category: string; description?: string; imageUrl?: string }
    >();

    // Collect unique badges from all players
    for (const player of players) {
      const badgeList = player.badges?.list || [];
      for (const badge of badgeList) {
        const slug = slugify(badge.name);
        if (!seenBadges.has(slug)) {
          const badgeRecord: { name: string; category: string; description?: string; imageUrl?: string } = {
            name: badge.name,
            category: badge.category || "Unknown",
          };
          if (badge.description) badgeRecord.description = badge.description;
          if (badge.imageUrl) badgeRecord.imageUrl = badge.imageUrl;
          seenBadges.set(slug, badgeRecord);
        }
      }
    }

    // Upsert badges
    let inserted = 0;
    let updated = 0;

    for (const [slug, badge] of seenBadges) {
      const existing = await ctx.db
        .query("badges")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          category: badge.category,
          description: badge.description ?? existing.description,
          imageUrl: badge.imageUrl ?? existing.imageUrl,
          gameVersion: CURRENT_GAME_VERSION,
          lastUpdated: now,
        });
        updated++;
      } else {
        const newBadge = {
          name: badge.name,
          slug,
          category: badge.category,
          gameVersion: CURRENT_GAME_VERSION,
          lastUpdated: now,
          createdAt: now,
          ...(badge.description ? { description: badge.description } : {}),
          ...(badge.imageUrl ? { imageUrl: badge.imageUrl } : {}),
        };
        await ctx.db.insert("badges", newBadge);
        inserted++;
      }
    }

    return { inserted, updated, totalBadges: seenBadges.size };
  },
});

/**
 * Create player-badge links from existing player data (for migration)
 */
export const linkPlayerBadgesFromData = internalMutation({
  handler: async (ctx) => {
    const players = await ctx.db.query("players").collect();

    let totalLinks = 0;
    let playersProcessed = 0;

    for (const player of players) {
      const badgeList = player.badges?.list || [];
      if (badgeList.length === 0) continue;

      // Delete existing links
      const existing = await ctx.db
        .query("playerBadges")
        .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
        .collect();

      for (const link of existing) {
        await ctx.db.delete(link._id);
      }

      // Create new links
      for (const badge of badgeList) {
        const slug = slugify(badge.name);
        const badgeDoc = await ctx.db
          .query("badges")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();

        if (badgeDoc) {
          await ctx.db.insert("playerBadges", {
            playerId: player._id,
            badgeId: badgeDoc._id,
            tier: badge.tier,
          });
          totalLinks++;
        }
      }

      playersProcessed++;
    }

    return { playersProcessed, totalLinks };
  },
});

/**
 * Bounded version of linkPlayerBadgesFromData for production maintenance.
 * The full-table mutation can exceed Convex's one-second mutation limit once
 * the dataset grows past ~1,700 players. Call repeatedly with continueCursor
 * until isDone is true.
 */
export const linkPlayerBadgesBatch = internalMutation({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("players").paginate(args.paginationOpts);
    let totalLinks = 0;
    let playersProcessed = 0;

    for (const player of page.page) {
      const badgeList = player.badges?.list ?? [];
      if (badgeList.length === 0) continue;

      const existing = await ctx.db
        .query("playerBadges")
        .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
        .collect();
      for (const link of existing) await ctx.db.delete(link._id);

      const seen = new Set<string>();
      for (const badge of badgeList) {
        const slug = slugify(badge.name);
        const key = `${slug}:${badge.tier}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const badgeDoc = await ctx.db
          .query("badges")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .first();
        if (!badgeDoc) continue;
        await ctx.db.insert("playerBadges", {
          playerId: player._id,
          badgeId: badgeDoc._id,
          tier: badge.tier,
        });
        totalLinks++;
      }
      playersProcessed++;
    }

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      playersProcessed,
      totalLinks,
    };
  },
});
