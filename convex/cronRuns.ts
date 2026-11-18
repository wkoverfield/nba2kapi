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
// loop until the action times out. A run that stops here is recorded as
// failed.
const MAX_BATCHES = 200;

/**
 * Mutable per-run state. Jobs update it as each batch commits, so a run that
 * throws part way still reports the batches that landed.
 */
type Progress = { batches: number; complete: boolean; result: Record<string, unknown> };

const JOBS = {
  "daily metric snapshot": async (ctx: ActionCtx, p: Progress) => {
    const r = await ctx.runMutation(internal.metricsRollup.snapshotDailyMetrics, {});
    p.batches = 1;
    p.result = { date: r.date, updated: r.updated };
    p.complete = true;
  },

  "cleanup old logs": async (ctx: ActionCtx, p: Progress) => {
    let deleted = 0;
    while (!p.complete && p.batches < MAX_BATCHES) {
      const r: { deleted: number; done: boolean } = await ctx.runMutation(
        internal.maintenance.cleanupOldLogs,
        { deletedSoFar: deleted, reschedule: false }
      );
      deleted = r.deleted;
      p.batches++;
      p.result = { deleted };
      p.complete = r.done;
    }
  },

  "create weekly snapshots": async (ctx: ActionCtx, p: Progress) => {
    const snapshotDate = new Date().toISOString().split("T")[0];
    let created = 0;
    let skipped = 0;
    let cursor: string | null = null;
    while (!p.complete && p.batches < MAX_BATCHES) {
      const r: {
        snapshotsCreated: number;
        skipped: number;
        cursor: string;
        done: boolean;
      } = await ctx.runMutation(internal.playerHistory.createWeeklySnapshots, {
        snapshotDate,
        cursor,
      });
      created += r.snapshotsCreated;
      skipped += r.skipped;
      cursor = r.cursor;
      p.batches++;
      p.result = { date: snapshotDate, created, skipped };
      p.complete = r.done;
    }
  },

  "prune pageview visits": async (ctx: ActionCtx, p: Progress) => {
    let deleted = 0;
    while (!p.complete && p.batches < MAX_BATCHES) {
      const r: { deleted: number; more: boolean } = await ctx.runMutation(
        internal.siteStats.pruneVisits,
        {}
      );
      deleted += r.deleted;
      p.batches++;
      p.result = { deleted };
      p.complete = !r.more;
    }
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
 * Run one scheduled job and record the outcome.
 *
 * A run is recorded as failed when the job throws or when it stops at
 * MAX_BATCHES before finishing; the row keeps the batches that committed
 * and the partial result. A thrown error is rethrown after recording, so it
 * also appears as a failed function in the Convex logs.
 */
export const run = internalAction({
  args: { job: jobName },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const progress: Progress = { batches: 0, complete: false, result: {} };

    let thrown: unknown;
    try {
      await JOBS[args.job](ctx, progress);
    } catch (error) {
      thrown = error;
    }

    const error =
      thrown !== undefined
        ? (thrown instanceof Error ? thrown.message : String(thrown)).slice(0, 2000)
        : !progress.complete
          ? `Stopped after ${MAX_BATCHES} batches before the job finished`
          : undefined;

    await ctx.runMutation(internal.cronRuns.record, {
      job: args.job,
      startedAt,
      finishedAt: Date.now(),
      ok: error === undefined,
      batches: progress.batches,
      result: JSON.stringify(progress.result),
      ...(error !== undefined ? { error } : {}),
    });

    if (thrown !== undefined) throw thrown;
    return { ok: error === undefined, batches: progress.batches, result: progress.result };
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
