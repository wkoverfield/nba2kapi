import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

const CATEGORIES = ["app", "league-tool", "bot", "data-viz", "other"];

// Fields safe to expose publicly. submitterEmail is deliberately excluded.
function toPublic(p: Doc<"showcaseProjects">) {
  return {
    _id: p._id,
    name: p.name,
    url: p.url,
    description: p.description,
    category: p.category,
    featured: p.featured ?? false,
    createdAt: p.createdAt,
  };
}

/**
 * Public: approved projects only, featured first then newest.
 * Never returns submitter contact info.
 */
export const getApprovedProjects = query({
  args: {
    limit: v.optional(v.number()),
    featuredOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const approved = await ctx.db
      .query("showcaseProjects")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    let projects = approved;
    if (args.featuredOnly) {
      projects = projects.filter((p) => p.featured);
    }

    projects.sort((a, b) => {
      const af = a.featured ? 1 : 0;
      const bf = b.featured ? 1 : 0;
      if (bf !== af) return bf - af;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    if (args.limit !== undefined) {
      projects = projects.slice(0, args.limit);
    }

    return projects.map(toPublic);
  },
});

/**
 * Public: submit a project. Starts as "pending" and is invisible on the site
 * until an admin approves it (see the /api/admin/showcase endpoints).
 */
export const submitProject = mutation({
  args: {
    name: v.string(),
    url: v.string(),
    description: v.string(),
    category: v.string(),
    submitterName: v.optional(v.string()),
    submitterEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const url = args.url.trim();
    const description = args.description.trim();

    if (!name || name.length > 60) {
      throw new Error("Name must be 1-60 characters");
    }
    if (!/^https?:\/\/.+\..+/.test(url) || url.length > 300) {
      throw new Error("URL must be a valid http(s) link");
    }
    if (!description || description.length > 240) {
      throw new Error("Description must be 1-240 characters");
    }
    if (!CATEGORIES.includes(args.category)) {
      throw new Error("Invalid category");
    }

    const data: {
      name: string;
      url: string;
      description: string;
      category: string;
      status: string;
      featured: boolean;
      createdAt: string;
      submitterName?: string;
      submitterEmail?: string;
    } = {
      name,
      url,
      description,
      category: args.category,
      status: "pending",
      featured: false,
      createdAt: new Date().toISOString(),
    };

    if (args.submitterName?.trim()) data.submitterName = args.submitterName.trim();
    if (args.submitterEmail?.trim()) data.submitterEmail = args.submitterEmail.trim();

    await ctx.db.insert("showcaseProjects", data);

    return { success: true };
  },
});

/**
 * Admin (internal): list pending submissions for review, including submitter
 * contact info. Reached through the admin-key-gated HTTP endpoint.
 */
export const listPending = internalQuery({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("showcaseProjects")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  },
});

/**
 * Admin (internal): approve or reject a submission, and optionally toggle the
 * landing-strip feature flag.
 */
export const setStatus = internalMutation({
  args: {
    id: v.id("showcaseProjects"),
    status: v.union(v.literal("approved"), v.literal("rejected"), v.literal("pending")),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) throw new Error("Project not found");

    const patch: { status: string; approvedAt?: string; featured?: boolean } = {
      status: args.status,
    };
    if (args.status === "approved" && !project.approvedAt) {
      patch.approvedAt = new Date().toISOString();
    }
    if (args.featured !== undefined) {
      patch.featured = args.featured;
    }

    await ctx.db.patch(args.id, patch);
    return { success: true };
  },
});

/**
 * Admin (internal): idempotent seed for the first showcase entry
 * (blacktopblitz.com). Safe to run more than once.
 */
export const seedShowcase = internalMutation({
  args: {},
  handler: async (ctx) => {
    const url = "https://blacktopblitz.com";
    const existing = await ctx.db
      .query("showcaseProjects")
      .collect()
      .then((all) => all.find((p) => p.url === url));
    if (existing) return { seeded: false, id: existing._id };

    const id = await ctx.db.insert("showcaseProjects", {
      name: "Blacktop Blitz",
      url,
      description:
        "A random team generator for NBA 2K's Blacktop mode, pulling live player ratings and rosters from nba2kapi.",
      category: "app",
      status: "approved",
      featured: true,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    });
    return { seeded: true, id };
  },
});
