/**
 * Maintenance Functions
 * Internal functions for cleanup and housekeeping
 */

import { internalMutation } from "./_generated/server";

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
