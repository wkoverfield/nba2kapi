/**
 * Maintenance Functions
 * Internal functions for cleanup and housekeeping
 */

import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Clean up request logs older than the retention window.
 *
 * Retention is 90 days. It must stay above the widest reader of requestLogs:
 * admin.getUsageBreakdown scans a 35-day window to build its per-day API-call
 * series, so anything below ~40 days would silently truncate that report. The
 * durable long-term source of per-day API volume is metricSnapshots
 * (metricsRollup), which is independent of this table.
 */
const RETENTION_DAYS = 90;

export const cleanupOldLogs = internalMutation({
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Find old logs
    const oldLogs = await ctx.db
      .query("requestLogs")
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .collect();

    // Delete them
    for (const log of oldLogs) {
      await ctx.db.delete(log._id);
    }

    console.log(`Cleaned up ${oldLogs.length} old request logs`);

    return { deleted: oldLogs.length };
  },
});

/**
 * Remove player rows whose `slug` disagrees with the slug in their `playerUrl`.
 *
 * Players are keyed by the last path segment of their 2kratings URL, which on
 * classic and all-time rosters carries the season and team
 * (`michael-jordan-1985-86-chicago-bulls`). An import that supplies no slug
 * falls back to slugifying the display name, which both drops that qualifier
 * and strips accented characters ("Hugo González" becomes `hugo-gonzlez`), so
 * every such row misses its existing counterpart and inserts a duplicate
 * instead of updating it.
 *
 * SAFETY: this deletes production data. `createdAfter` bounds it to rows
 * created by the offending import, so anything predating that import is left
 * alone whatever its slug looks like. Deletes cascade to dependent rows the
 * way reconcileRoster does, and `limit` keeps a call inside the mutation
 * budget — call until `remaining` reaches 0. Pass dryRun to preview.
 */
export const pruneSlugMismatchedPlayers = internalMutation({
  args: {
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    createdAfter: v.number(),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const slugFromUrl = (url?: string) => {
      if (!url) return null;
      const path = url.split("?")[0].replace(/\/+$/, "");
      return path.slice(path.lastIndexOf("/") + 1) || null;
    };

    const players = await ctx.db
      .query("players")
      .withIndex("by_teamType", (q) => q.eq("teamType", args.teamType))
      .collect();

    const targets = players.filter((p) => {
      if (p._creationTime < args.createdAfter) return false;
      const fromUrl = slugFromUrl(p.playerUrl);
      return fromUrl !== null && fromUrl !== p.slug;
    });

    const batch = targets.slice(0, args.limit ?? 150);
    let deleted = 0;
    let childrenDeleted = 0;

    if (!args.dryRun) {
      for (const p of batch) {
        const history = await ctx.db
          .query("playerRatingHistory")
          .withIndex("by_playerId", (q) => q.eq("playerId", p._id))
          .collect();
        for (const h of history) {
          await ctx.db.delete(h._id);
          childrenDeleted++;
        }
        const snapshots = await ctx.db
          .query("playerSnapshots")
          .withIndex("by_playerId", (q) => q.eq("playerId", p._id))
          .collect();
        for (const s of snapshots) {
          await ctx.db.delete(s._id);
          childrenDeleted++;
        }
        const links = await ctx.db
          .query("playerBadges")
          .withIndex("by_playerId", (q) => q.eq("playerId", p._id))
          .collect();
        for (const l of links) {
          await ctx.db.delete(l._id);
          childrenDeleted++;
        }

        await ctx.db.delete(p._id);
        deleted++;
      }
    }

    const result = {
      teamType: args.teamType,
      matched: targets.length,
      deleted,
      childrenDeleted,
      remaining: targets.length - deleted,
      dryRun: !!args.dryRun,
      sample: batch.slice(0, 5).map((p) => ({ name: p.name, slug: p.slug, team: p.team })),
    };
    console.log("[pruneSlugMismatchedPlayers]", JSON.stringify(result));
    return result;
  },
});
