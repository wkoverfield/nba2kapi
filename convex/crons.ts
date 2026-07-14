/**
 * Registered cron jobs.
 *
 * Convex ONLY registers scheduled functions declared in the module named
 * exactly `crons` (this file). A sibling `cron.ts` (singular) is never picked
 * up, so any job defined there silently never runs. All scheduled work must
 * live here.
 *
 * Jobs:
 *   - daily metric snapshot   bank cumulative usage counters once per UTC day
 *                             so any reporting window stays derivable forever
 *   - cleanup old logs        bound requestLogs table growth
 *   - create weekly snapshots point-in-time player history
 *   - prune pageview visits   bound the per-day unique-visitor dedup table
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Bank a permanent snapshot of the app's cumulative usage counters once per UTC
 * day so any reporting window (7d / 30d / yearly) is derivable forever,
 * independent of tables that prune or churn.
 * Runs daily at 8:10 AM UTC.
 */
crons.daily(
  "daily metric snapshot",
  { hourUTC: 8, minuteUTC: 10 },
  internal.metricsRollup.snapshotDailyMetrics
);

/**
 * Clean up old request logs.
 * Runs daily at 2 AM UTC.
 *
 * Retention floor: admin.getUsageBreakdown reads a 35-day window of requestLogs
 * to build its per-day API-call series, so this MUST retain at least 35 days.
 * We keep 90 for headroom; the durable long-term source of per-day API volume
 * is metricSnapshots (metricsRollup), not this table. Do not lower below ~40
 * without widening or retiring that reader first.
 */
crons.daily(
  "cleanup old logs",
  { hourUTC: 2, minuteUTC: 0 },
  internal.maintenance.cleanupOldLogs
);

/**
 * Create weekly player snapshots.
 * Runs every Sunday at midnight UTC.
 * Additive and idempotent per date; enables point-in-time historical queries.
 */
crons.weekly(
  "create weekly snapshots",
  { dayOfWeek: "sunday", hourUTC: 0, minuteUTC: 0 },
  internal.playerHistory.createWeeklySnapshots
);

/**
 * Prune per-day unique-visitor dedup rows older than 120 days.
 * Runs daily at 4:30 AM UTC.
 *
 * Only same-day rows are read (to dedup a returning visitor); durable unique
 * counts live in pageviewCounters (uvday:*) and are never touched here, so
 * pruning old dedup rows is safe.
 */
crons.daily(
  "prune pageview visits",
  { hourUTC: 4, minuteUTC: 30 },
  internal.siteStats.pruneVisits
);

export default crons;
