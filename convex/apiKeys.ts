/**
 * API Key Management
 * Mutations and queries for API key operations.
 *
 * Everything that creates keys, counts requests, or changes key state is
 * internal and reached through convex/http.ts. The public functions below
 * require the key itself as proof of ownership.
 */

import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 * Takes the same amount of time regardless of where strings differ.
 * IMPORTANT: No early return on length mismatch - that would leak length info.
 */
export function constantTimeCompare(a: string, b: string): boolean {
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

const MAX_PURPOSE_LENGTH = 500;

// Shared hourly bucket for the legacy createApiKey mutation (see below).
const LEGACY_CREATE_BUCKET = "legacy:createApiKey";
const LEGACY_CREATE_LIMIT = 10;

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

type KeyFields = { email: string; name: string; purpose?: string };

type IssueResult =
  | { ok: true; apiKey: string; id: Id<"apiKeys">; rateLimit: number }
  | { ok: false; code: "INVALID_EMAIL" | "KEY_LIMIT_EXCEEDED"; message: string };

const KEY_LIMIT_MESSAGE =
  `Maximum ${MAX_KEYS_PER_EMAIL} active API keys per email. ` +
  `Please deactivate an existing key first.`;

/**
 * Insert a new key for an email, enforcing MAX_KEYS_PER_EMAIL.
 * Uses optimistic concurrency control to handle race conditions.
 */
async function insertApiKey(ctx: MutationCtx, args: KeyFields): Promise<IssueResult> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(args.email)) {
    return { ok: false, code: "INVALID_EMAIL", message: "Invalid email format" };
  }

  // Check existing active keys for this email (may be stale due to race conditions)
  const existingKeys = await ctx.db
    .query("apiKeys")
    .withIndex("by_email", (q) => q.eq("email", args.email))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  if (existingKeys.length >= MAX_KEYS_PER_EMAIL) {
    return { ok: false, code: "KEY_LIMIT_EXCEEDED", message: KEY_LIMIT_MESSAGE };
  }

  const key = generateApiKey();
  const purpose = args.purpose?.trim().slice(0, MAX_PURPOSE_LENGTH);

  const apiKeyId = await ctx.db.insert("apiKeys", {
    key,
    email: args.email,
    name: args.name,
    ...(purpose ? { purpose } : {}),
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
    return { ok: false, code: "KEY_LIMIT_EXCEEDED", message: KEY_LIMIT_MESSAGE };
  }

  return { ok: true, apiKey: key, id: apiKeyId, rateLimit: 500 };
}

/**
 * Consume one slot from a fixed-window registration bucket.
 * Buckets are rows in registrationAttempts keyed by `ip` (a client IP, or a
 * shared bucket name for callers without one).
 */
async function consumeRegistrationSlot(
  ctx: MutationCtx,
  bucket: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const WINDOW_MS = 3600000; // 1 hour in milliseconds
  const now = Date.now();

  const existing = await ctx.db
    .query("registrationAttempts")
    .withIndex("by_ip", (q) => q.eq("ip", bucket))
    .first();

  // No record or expired window - start fresh
  if (!existing || (now - existing.windowStart) > WINDOW_MS) {
    if (existing) {
      await ctx.db.patch(existing._id, { count: 1, windowStart: now });
    } else {
      await ctx.db.insert("registrationAttempts", { ip: bucket, count: 1, windowStart: now });
    }
    return { allowed: true, remaining: limit - 1 };
  }

  // Within window - check if at limit
  if (existing.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
  return { allowed: true, remaining: limit - existing.count - 1 };
}

/**
 * Create a new API key. Internal: the only public path is POST /api/register,
 * which applies the per-IP registration limit before calling this.
 */
export const issueApiKey = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => insertApiKey(ctx, args),
});

/**
 * Legacy public entry point for key creation.
 *
 * Exists only for browser bundles loaded before key creation moved to
 * POST /api/register; removing it would break those open tabs. Mutations have
 * no client IP, so instead of the per-IP limit it draws from one shared hourly
 * bucket, on top of the per-email limit. Remove in the next release.
 */
export const createApiKey = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const slot = await consumeRegistrationSlot(ctx, LEGACY_CREATE_BUCKET, LEGACY_CREATE_LIMIT);
    if (!slot.allowed) {
      throw new ConvexError("This page is out of date. Reload the page and try again.");
    }

    const result = await insertApiKey(ctx, args);
    if (!result.ok) {
      throw new ConvexError(result.message);
    }
    return { apiKey: result.apiKey, id: result.id, rateLimit: result.rateLimit };
  },
});

/**
 * Validate an API key
 * Uses constant-time comparison to prevent timing attacks
 */
export const validateApiKey = internalQuery({
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
export const checkRateLimit = internalMutation({
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
export const logRequest = internalMutation({
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
 * Deactivate an API key by id (operator use, e.g. `npx convex run`).
 */
export const deactivateApiKey = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, {
      isActive: false,
    });

    return { success: true };
  },
});

/**
 * Regenerate an API key (creates new key, deactivates old one).
 * Public: the caller proves ownership by presenting the current key.
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
      ...(existingKey.purpose ? { purpose: existingKey.purpose } : {}),
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

    // Stale or regenerated-away keys return null (never throw): the dashboard
    // clears the browser copy and shows the signup state instead of crashing.
    if (!apiKey || !apiKey.isActive) {
      return null;
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
export const checkRegistrationRateLimit = internalMutation({
  args: { ip: v.string() },
  handler: async (ctx, args) => {
    return consumeRegistrationSlot(ctx, args.ip, 5); // Max 5 registrations per hour per IP
  },
});

/**
 * Per-IP rate limit for unauthenticated public endpoints (e.g. /api/public/players).
 * Window: 60 seconds. Limit: 60 requests/min/IP.
 * Returns { allowed, remaining, limit, resetAt } so the caller can set standard
 * X-RateLimit-* headers regardless of allow/deny.
 */
export const checkPublicApiRateLimit = internalMutation({
  args: { ip: v.string() },
  handler: async (ctx, args) => {
    const LIMIT = 60; // 60 requests per minute per IP
    const WINDOW_MS = 60_000; // 1 minute
    const now = Date.now();

    const existing = await ctx.db
      .query("publicApiRateLimits")
      .withIndex("by_ip", (q) => q.eq("ip", args.ip))
      .first();

    // No record or window expired - start fresh
    if (!existing || (now - existing.windowStart) > WINDOW_MS) {
      if (existing) {
        await ctx.db.patch(existing._id, { count: 1, windowStart: now });
      } else {
        await ctx.db.insert("publicApiRateLimits", {
          ip: args.ip,
          count: 1,
          windowStart: now,
        });
      }
      return {
        allowed: true,
        remaining: LIMIT - 1,
        limit: LIMIT,
        resetAt: new Date(now + WINDOW_MS).toISOString(),
      };
    }

    const resetAt = new Date(existing.windowStart + WINDOW_MS).toISOString();

    if (existing.count >= LIMIT) {
      return { allowed: false, remaining: 0, limit: LIMIT, resetAt };
    }

    await ctx.db.patch(existing._id, { count: existing.count + 1 });
    return {
      allowed: true,
      remaining: LIMIT - existing.count - 1,
      limit: LIMIT,
      resetAt,
    };
  },
});
