/**
 * Maintenance Functions
 * Internal functions for cleanup and housekeeping
 */

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Clean up request logs older than the retention window.
 *
 * Retention is 90 days. It must stay above the widest reader of requestLogs:
 * admin.getUsageBreakdown scans a 35-day window to build its per-day API-call
 * series, so anything below ~40 days would silently truncate that report. The
 * durable long-term source of per-day API volume is metricSnapshots
 * (metricsRollup), which is independent of this table.
 *
 * Deletes one bounded batch per transaction and reschedules itself while a
 * full batch comes back, so a backlog of any size drains without one
 * transaction reaching Convex's per-transaction limits (32,000 documents
 * read, 16,000 written). The index range bounds the read to expired rows
 * only; filtering after an unbounded index scan reads the whole table.
 * Timestamps are UTC ISO strings, so string order is time order.
 */
const RETENTION_DAYS = 90;
const CLEANUP_BATCH_SIZE = 2000;

export const cleanupOldLogs = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    // Running total across the rescheduled batches of one cleanup pass.
    deletedSoFar: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ deleted: number; done: boolean }> => {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const batchSize = Math.max(1, Math.min(args.batchSize ?? CLEANUP_BATCH_SIZE, 4000));

    const batch = await ctx.db
      .query("requestLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
      .take(batchSize);

    for (const log of batch) {
      await ctx.db.delete(log._id);
    }

    const deleted = (args.deletedSoFar ?? 0) + batch.length;

    if (batch.length === batchSize) {
      await ctx.scheduler.runAfter(0, internal.maintenance.cleanupOldLogs, {
        batchSize,
        deletedSoFar: deleted,
      });
      return { deleted, done: false };
    }

    console.log(`Cleaned up ${deleted} old request logs`);
    return { deleted, done: true };
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
