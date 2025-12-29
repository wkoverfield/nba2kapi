import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all feedback sorted by upvotes (highest first)
 */
export const getFeedback = query({
  args: {},
  handler: async (ctx) => {
    const feedback = await ctx.db.query("feedback").collect();
    // Sort by upvotes descending, then by createdAt descending
    return feedback.sort((a, b) => {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },
});

/**
 * Submit new feedback
 */
export const submitFeedback = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    description: v.string(),
    authorName: v.optional(v.string()),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate inputs
    if (!args.title.trim() || args.title.length > 100) {
      throw new Error("Title must be 1-100 characters");
    }
    if (!args.description.trim() || args.description.length > 500) {
      throw new Error("Description must be 1-500 characters");
    }
    if (!["feature", "bug", "improvement", "other"].includes(args.type)) {
      throw new Error("Invalid feedback type");
    }

    const feedbackData: {
      type: string;
      title: string;
      description: string;
      status: string;
      upvotes: number;
      upvoterIds: string[];
      createdAt: string;
      authorName?: string;
    } = {
      type: args.type,
      title: args.title.trim(),
      description: args.description.trim(),
      status: "pending",
      upvotes: 1, // Auto-upvote by creator
      upvoterIds: [args.visitorId],
      createdAt: new Date().toISOString(),
    };

    if (args.authorName?.trim()) {
      feedbackData.authorName = args.authorName.trim();
    }

    await ctx.db.insert("feedback", feedbackData);

    return { success: true };
  },
});

/**
 * Upvote feedback (one vote per visitor)
 */
export const upvoteFeedback = mutation({
  args: {
    feedbackId: v.id("feedback"),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // Check if already voted
    if (feedback.upvoterIds.includes(args.visitorId)) {
      return { success: false, message: "Already voted" };
    }

    // Add vote
    await ctx.db.patch(args.feedbackId, {
      upvotes: feedback.upvotes + 1,
      upvoterIds: [...feedback.upvoterIds, args.visitorId],
    });

    return { success: true };
  },
});

/**
 * Remove upvote (toggle)
 */
export const removeUpvote = mutation({
  args: {
    feedbackId: v.id("feedback"),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback) {
      throw new Error("Feedback not found");
    }

    // Check if has voted
    if (!feedback.upvoterIds.includes(args.visitorId)) {
      return { success: false, message: "Not voted" };
    }

    // Remove vote
    await ctx.db.patch(args.feedbackId, {
      upvotes: Math.max(0, feedback.upvotes - 1),
      upvoterIds: feedback.upvoterIds.filter((id) => id !== args.visitorId),
    });

    return { success: true };
  },
});
