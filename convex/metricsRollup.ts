/**
 * Daily metric rollup.
 *
 * Banks a permanent snapshot of the app's cumulative usage counters once per
 * UTC day so that any reporting window (7d / 30d / yearly) is derivable
 * forever, independent of tables that prune or churn (e.g. requestLogs).
 *
 * The values snapshotted are the durable, monotonic counters:
 *   - pageviewsTotal   cumulative site pageviews (pageviewCounters "total")
 *   - uniquesToDate    sum of per-day unique-visitor counters (uvday:*)
 *   - apiRequestsTotal cumulative API calls, summed across all apiKeys
 *   - activeApiKeys    active API key count (point-in-time)
 *   - apiKeysTotal     total API key count (point-in-time)
 *
 * apiRequestsTotal is stored raw (cumulative), not as a delta: differencing two
 * snapshots gives per-day API volume, while the raw value stays reconstructable.
 */

import { internalMutation, internalQuery } from "./_generated/server";

/** UTC "YYYY-MM-DD" for an epoch ms value. */
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Internal: capture today's cumulative counters into metricSnapshots.
 * Idempotent per UTC date - patches the existing row for the date if present,
 * otherwise inserts a new one. Safe to run repeatedly within a day.
 */
export const snapshotDailyMetrics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const date = utcDay(now);

    // Cumulative site pageviews + sum of per-day unique-visitor counters.
    const counters = await ctx.db.query("pageviewCounters").collect();
    let pageviewsTotal = 0;
    let uniquesToDate = 0;
    for (const c of counters) {
      if (c.key === "total") pageviewsTotal = c.count;
      else if (c.key.startsWith("uvday:")) uniquesToDate += c.count;
    }

    // Cumulative API usage: requestCount is per-key lifetime cumulative, so the
    // sum across keys is total API calls to date.
    const keys = await ctx.db.query("apiKeys").collect();
    let apiRequestsTotal = 0;
    let activeApiKeys = 0;
    for (const k of keys) {
      apiRequestsTotal += k.requestCount || 0;
      if (k.isActive) activeApiKeys++;
    }

    const metrics: Record<string, number> = {
      pageviewsTotal,
      uniquesToDate,
      apiRequestsTotal,
      activeApiKeys,
      apiKeysTotal: keys.length,
    };

    const existing = await ctx.db
      .query("metricSnapshots")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { capturedAt: now, metrics });
      return { date, updated: true, metrics };
    }

    await ctx.db.insert("metricSnapshots", { date, capturedAt: now, metrics });
    return { date, updated: false, metrics };
  },
});

/**
 * Internal: the full snapshot series, ordered by date ascending.
 * Windowed views (7d / 30d / yearly) are derived by the caller from this series.
 */
export const getMetricSnapshots = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("metricSnapshots")
      .withIndex("by_date")
      .order("asc")
      .collect();
  },
});
