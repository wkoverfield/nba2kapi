/**
 * Scheduled Functions (Cron Jobs)
 * Automated tasks that run on a schedule
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * NOTE: Automated scraping cannot be done from Convex due to Cloudflare protection
 * on 2kratings.com requiring a full browser (Playwright).
 *
 * To scrape bi-weekly (1st and 15th):
 * - Set up external cron job (GitHub Actions, cron server, etc.)
 * - Run: CONVEX_URL=<url> node scripts/runScraper.js curr
 *
 * Example GitHub Actions schedule:
 * - cron: '0 3 1,15 * *'  # 3 AM UTC on 1st and 15th
 */

/**
 * Clean up old request logs (older than 30 days)
 * Runs daily at 2 AM UTC
 */
crons.daily(
  "cleanup old logs",
  { hourUTC: 2, minuteUTC: 0 },
  internal.maintenance.cleanupOldLogs
);

/**
 * Create weekly player snapshots
 * Runs every Sunday at midnight UTC
 * Enables efficient point-in-time historical queries
 */
crons.weekly(
  "create weekly snapshots",
  { dayOfWeek: "sunday", hourUTC: 0, minuteUTC: 0 },
  internal.playerHistory.createWeeklySnapshots
);

export default crons;
