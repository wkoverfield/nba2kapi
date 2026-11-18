/**
 * Run tracking for scheduled jobs.
 *
 * crons.ts schedules cronRuns.run with a job name instead of the job's
 * mutation. `run` is an action: it executes the job's mutations, then writes
 * one cronRuns row with the outcome. The row is written from outside the
 * job's transaction on purpose. A mutation that throws rolls back everything
 * it wrote, so a job cannot record its own failure.
 *
 * Jobs that work in batches are driven from here, one mutation per batch,
 * until the job reports it is done.
 */

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const RETENTION_DAYS = 180;
// Upper bound on batches per run, so a job that never reports done cannot
// loop until the action times out.
const MAX_BATCHES = 200;

type JobOutcome = { batches: number; result: Record<string, unknown> };

const JOBS = {
  "daily metric snapshot": async (ctx: ActionCtx): Promise<JobOutcome> => {
    const r = await ctx.runMutation(internal.metricsRollup.snapshotDailyMetrics, {});
    return { batches: 1, result: { date: r.date, updated: r.updated } };
  },

  "cleanup old logs": async (ctx: ActionCtx): Promise<JobOutcome> => {
    let batches = 0;
    let deleted = 0;
    let done = false;
    while (!done && batches < MAX_BATCHES) {
      const r: { deleted: number; done: boolean } = await ctx.runMutation(
        internal.maintenance.cleanupOldLogs,
        { deletedSoFar: deleted, reschedule: false }
      );
      batches++;
      deleted = r.deleted;
      done = r.done;
    }
    return { batches, result: { deleted, done } };
  },

  "create weekly snapshots": async (ctx: ActionCtx): Promise<JobOutcome> => {
    const snapshotDate = new Date().toISOString().split("T")[0];
    let batches = 0;
    let created = 0;
    let skipped = 0;
    let cursor: string | null = null;
    let done = false;
    while (!done && batches < MAX_BATCHES) {
      const r: {
        snapshotsCreated: number;
        skipped: number;
        cursor: string;
        done: boolean;
      } = await ctx.runMutation(internal.playerHistory.createWeeklySnapshots, {
        snapshotDate,
        cursor,
      });
      batches++;
      created += r.snapshotsCreated;
      skipped += r.skipped;
      cursor = r.cursor;
      done = r.done;
    }
    return { batches, result: { date: snapshotDate, created, skipped, done } };
  },

  "prune pageview visits": async (ctx: ActionCtx): Promise<JobOutcome> => {
    let batches = 0;
    let deleted = 0;
    let more = true;
    while (more && batches < MAX_BATCHES) {
      const r: { deleted: number; more: boolean } = await ctx.runMutation(
        internal.siteStats.pruneVisits,
        {}
      );
      batches++;
      deleted += r.deleted;
      more = r.more;
    }
    return { batches, result: { deleted, done: !more } };
  },
} as const;

export type CronJobName = keyof typeof JOBS;

const jobName = v.union(
  v.literal("daily metric snapshot"),
  v.literal("cleanup old logs"),
  v.literal("create weekly snapshots"),
  v.literal("prune pageview visits")
);

/**
 * Run one scheduled job and record the outcome. A failure is recorded and
 * then rethrown, so it also appears as a failed function in the Convex logs.
 */
export const run = internalAction({
  args: { job: jobName },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    try {
      const outcome = await JOBS[args.job](ctx);
      await ctx.runMutation(internal.cronRuns.record, {
        job: args.job,
        startedAt,
        finishedAt: Date.now(),
        ok: true,
        batches: outcome.batches,
        result: JSON.stringify(outcome.result),
      });
      return outcome;
    } catch (error) {
      await ctx.runMutation(internal.cronRuns.record, {
        job: args.job,
        startedAt,
        finishedAt: Date.now(),
        ok: false,
        batches: 0,
        error: (error instanceof Error ? error.message : String(error)).slice(0, 2000),
      });
      throw error;
    }
  },
});

export const record = internalMutation({
  args: {
    job: v.string(),
    startedAt: v.number(),
    finishedAt: v.number(),
    ok: v.boolean(),
    batches: v.number(),
    result: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("cronRuns", args);

    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const expired = await ctx.db
      .query("cronRuns")
      .withIndex("by_startedAt", (q) => q.lt("startedAt", cutoff))
      .take(50);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
  },
});

/**
 * Most recent runs, newest first. Optionally for one job.
 *
 *   npx convex run cronRuns:recent '{"limit": 20}'
 */
export const recent = internalQuery({
  args: { job: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 30, 200));
    const job = args.job;
    const rows = job
      ? await ctx.db
          .query("cronRuns")
          .withIndex("by_job_and_startedAt", (q) => q.eq("job", job))
          .order("desc")
          .take(limit)
      : await ctx.db.query("cronRuns").withIndex("by_startedAt").order("desc").take(limit);
    return rows.map((r) => ({
      job: r.job,
      startedAt: new Date(r.startedAt).toISOString(),
      seconds: Math.round((r.finishedAt - r.startedAt) / 100) / 10,
      ok: r.ok,
      batches: r.batches,
      result: r.result,
      error: r.error,
    }));
  },
});
