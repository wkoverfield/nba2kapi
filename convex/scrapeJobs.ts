/**
 * Scrape Jobs Management
 * Query and mutation functions for tracking scraping operations
 */

import { mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create or update scrape job record
 */
export const upsertJob = mutation({
  args: {
    jobId: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    playersScraped: v.number(),
    playersUpdated: v.number(),
    playersAdded: v.number(),
    teamsScraped: v.number(),
    errors: v.array(v.string()),
    startTime: v.string(),
    endTime: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if job already exists
    const existingJob = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    if (existingJob) {
      // Update existing job
      await ctx.db.patch(existingJob._id, args);
      return { action: "updated", jobId: args.jobId };
    } else {
      // Insert new job
      await ctx.db.insert("scrapeJobs", args);
      return { action: "inserted", jobId: args.jobId };
    }
  },
});

/**
 * Get job status by ID
 * internalQuery: only reached via the admin-key-gated /api/admin/scrape/:jobId
 * HTTP route. A public query would be callable directly via the deployment URL,
 * bypassing that gate.
 */
export const getJobStatus = internalQuery({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .first();

    return job;
  },
});

/**
 * Get recent scrape jobs
 * internalQuery: only reached via the admin-key-gated /api/admin/scrape/jobs
 * HTTP route. See getJobStatus above.
 */
export const getRecentJobs = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("scrapeJobs")
      .withIndex("by_startTime")
      .order("desc")
      .take(args.limit || 10);

    return jobs;
  },
});
