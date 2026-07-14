/**
 * Registered cron jobs.
 *
 * Convex only registers scheduled functions declared in the module named
 * `crons` (this file). Each day this banks a permanent snapshot of the app's
 * cumulative usage counters so any reporting window stays derivable forever.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "daily metric snapshot",
  { hourUTC: 8, minuteUTC: 10 },
  internal.metricsRollup.snapshotDailyMetrics
);

export default crons;
