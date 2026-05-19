/**
 * API Key Management
 * Mutations and queries for API key operations
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 * Takes the same amount of time regardless of where strings differ.
 * IMPORTANT: No early return on length mismatch - that would leak length info.
 */
function constantTimeCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Length difference contributes to result

  for (let i = 0; i < maxLen; i++) {
    const aChar = i < a.length ? a.charCodeAt(i) : 0;
    const bChar = i < b.length ? b.charCodeAt(i) : 0;
    result |= aChar ^ bChar;
  }

  return result === 0;
}

// Maximum number of active API keys allowed per email address
const MAX_KEYS_PER_EMAIL = 3;

/**
 * Generate a unique API key with 2k_ prefix
 * Uses cryptographically secure random generation with rejection sampling
 * to avoid modulo bias (256 % 36 != 0 would cause uneven distribution)
 */
function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charLen = chars.length; // 36
  const maxValid = Math.floor(256 / charLen) * charLen; // 252 - largest multiple of 36 <= 255

  const result: string[] = [];

  // Use rejection sampling to avoid modulo bias
  while (result.length < 32) {
    const array = new Uint8Array(32 - result.length);
    crypto.getRandomValues(array);

    for (const byte of array) {
      // Reject values >= 252 to ensure uniform distribution
      if (byte < maxValid && result.length < 32) {
        result.push(chars[byte % charLen]);
      }
    }
  }

  return `2k_${result.join('')}`;
}

/**
 * Create a new API key
 * Uses optimistic concurrency control to handle race conditions
 */
export const createApiKey = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(args.email)) {
      throw new Error("Invalid email format");
    }

    // Check existing active keys for this email (may be stale due to race conditions)
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (existingKeys.length >= MAX_KEYS_PER_EMAIL) {
      throw new Error(
        `Maximum ${MAX_KEYS_PER_EMAIL} active API keys per email. ` +
        `Please deactivate an existing key first.`
      );
    }

    // Generate unique API key
    const key = generateApiKey();

    // Create API key record
    const apiKeyId = await ctx.db.insert("apiKeys", {
      key,
      email: args.email,
      name: args.name,
      requestCount: 0,
      rateLimit: 500, // Default: 500 requests per hour
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    // Re-check after insert to handle race conditions (optimistic concurrency)
    // If two requests came in simultaneously, both passed the initial check,
    // but now we can see the true count after both inserts
    const finalCount = await ctx.db
      .query("apiKeys")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    if (finalCount.length > MAX_KEYS_PER_EMAIL) {
      // Race condition occurred - rollback by deleting our insert
      await ctx.db.delete(apiKeyId);
      throw new Error(
        `Maximum ${MAX_KEYS_PER_EMAIL} active API keys per email. ` +
        `Please deactivate an existing key first.`
      );
    }

    return {
      apiKey: key,
      id: apiKeyId,
      rateLimit: 500,
    };
  },
});

/**
 * Validate an API key
 * Uses constant-time comparison to prevent timing attacks
 */
export const validateApiKey = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    // Use constant-time comparison for the actual key verification
    // This prevents timing attacks that could leak key information
    if (!apiKey || !constantTimeCompare(apiKey.key, args.key)) {
      return { valid: false, reason: "API key not found" };
    }

    if (!apiKey.isActive) {
      return { valid: false, reason: "API key is inactive" };
    }

    return { valid: true, apiKey };
  },
});

/**
 * Check and consume rate limit (atomic - prevents race conditions)
 * This is a mutation because it increments the counter atomically
 */
export const checkRateLimit = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!apiKey) {
      return { allowed: false, reason: "API key not found" };
    }

    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const currentHourStr = currentHour.toISOString();

    // Check if we're in a new hour (reset counter)
    let currentRequests = apiKey.currentHourRequests || 0;
    const hourStart = apiKey.currentHourStart;

    if (!hourStart || hourStart !== currentHourStr) {
      // New hour - reset counter
      currentRequests = 0;
    }

    // Check if at limit BEFORE incrementing
    if (currentRequests >= apiKey.rateLimit) {
      const resetTime = new Date(currentHour);
      resetTime.setHours(resetTime.getHours() + 1);

      return {
        allowed: false,
        reason: "Rate limit exceeded",
        limit: apiKey.rateLimit,
        remaining: 0,
        reset: resetTime.toISOString(),
      };
    }

    // Atomically increment counter
    await ctx.db.patch(apiKey._id, {
      currentHourRequests: currentRequests + 1,
      currentHourStart: currentHourStr,
      requestCount: apiKey.requestCount + 1,
      lastRequest: now.toISOString(),
    });

    const resetTime = new Date(currentHour);
    resetTime.setHours(resetTime.getHours() + 1);
    const remaining = apiKey.rateLimit - (currentRequests + 1);

    return {
      allowed: true,
      apiKeyId: apiKey._id,
      limit: apiKey.rateLimit,
      remaining: Math.max(0, remaining),
      reset: resetTime.toISOString(),
    };
  },
});

/**
 * Log an API request (for analytics only - counting is done in checkRateLimit)
 */
export const logRequest = mutation({
  args: {
    apiKeyId: v.id("apiKeys"),
    endpoint: v.string(),
    method: v.string(),
    statusCode: v.number(),
    responseTime: v.number(),
    queryParams: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create request log for analytics
    const logData: any = {
      apiKeyId: args.apiKeyId,
      endpoint: args.endpoint,
      method: args.method,
      statusCode: args.statusCode,
      responseTime: args.responseTime,
      timestamp: new Date().toISOString(),
    };

    // Don't log sensitive query params (like adminKey)
    if (args.queryParams !== undefined && !args.queryParams.includes("adminKey")) {
      logData.queryParams = args.queryParams;
    }

    await ctx.db.insert("requestLogs", logData);
    // Note: requestCount is now updated atomically in checkRateLimit
  },
});

/**
 * Deactivate an API key
 */
export const deactivateApiKey = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, {
      isActive: false,
    });

    return { success: true };
  },
});

/**
 * Regenerate an API key (creates new key, deactivates old one)
 */
export const regenerateApiKey = mutation({
  args: { oldKey: v.string() },
  handler: async (ctx, args) => {
    // Find existing API key
    const existingKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.oldKey))
      .first();

    if (!existingKey) {
      throw new Error("API key not found");
    }

    if (!existingKey.isActive) {
      throw new Error("API key is already inactive");
    }

    // Deactivate old key
    await ctx.db.patch(existingKey._id, {
      isActive: false,
    });

    // Generate new key with same user info
    const newKey = generateApiKey();
    const newApiKeyId = await ctx.db.insert("apiKeys", {
      key: newKey,
      email: existingKey.email,
      name: existingKey.name,
      requestCount: 0,
      rateLimit: existingKey.rateLimit,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    return {
      apiKey: newKey,
      id: newApiKeyId,
      rateLimit: existingKey.rateLimit,
    };
  },
});

/**
 * Get API key statistics for dashboard
 */
export const getApiKeyStats = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!apiKey) {
      throw new Error("API key not found");
    }

    // Use atomic counter for current hour requests
    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const currentHourStr = currentHour.toISOString();

    // Check if counter is for current hour
    let requestsThisHour = 0;
    if (apiKey.currentHourStart === currentHourStr) {
      requestsThisHour = apiKey.currentHourRequests || 0;
    }

    const remaining = Math.max(0, apiKey.rateLimit - requestsThisHour);

    // Get last 10 requests for display
    const allRequests = await ctx.db
      .query("requestLogs")
      .withIndex("by_apiKeyId", (q) => q.eq("apiKeyId", apiKey._id))
      .order("desc")
      .take(10);

    // Calculate reset time (next hour boundary)
    const resetTime = new Date(currentHour);
    resetTime.setHours(resetTime.getHours() + 1);

    return {
      apiKey: {
        email: apiKey.email,
        name: apiKey.name,
        createdAt: apiKey.createdAt,
        rateLimit: apiKey.rateLimit,
      },
      requestCount: requestsThisHour,
      totalRequests: apiKey.requestCount,
      lastRequest: apiKey.lastRequest,
      rateLimit: apiKey.rateLimit,
      requestsRemaining: remaining,
      resetAt: resetTime.toISOString(),
      recentRequests: allRequests.map((log) => ({
        endpoint: log.endpoint,
        method: log.method,
        statusCode: log.statusCode,
        responseTime: log.responseTime,
        timestamp: log.timestamp,
      })),
    };
  },
});

/**
 * Check registration rate limit (database-backed for serverless compatibility)
 * Limits API key registrations per IP address to prevent abuse
 */
export const checkRegistrationRateLimit = mutation({
  args: { ip: v.string() },
  handler: async (ctx, args) => {
    const LIMIT = 5; // Max registrations per window
    const WINDOW_MS = 3600000; // 1 hour in milliseconds
    const now = Date.now();

    // Look up existing record for this IP
    const existing = await ctx.db
      .query("registrationAttempts")
      .withIndex("by_ip", (q) => q.eq("ip", args.ip))
      .first();

    // No record or expired window - start fresh
    if (!existing || (now - existing.windowStart) > WINDOW_MS) {
      if (existing) {
        // Reset existing record
        await ctx.db.patch(existing._id, { count: 1, windowStart: now });
      } else {
        // Create new record
        await ctx.db.insert("registrationAttempts", {
          ip: args.ip,
          count: 1,
          windowStart: now,
        });
      }
      return { allowed: true, remaining: LIMIT - 1 };
    }

    // Within window - check if at limit
    if (existing.count >= LIMIT) {
      return { allowed: false, remaining: 0 };
    }

    // Increment counter
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return { allowed: true, remaining: LIMIT - existing.count - 1 };
  },
});
