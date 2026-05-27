/**
 * HTTP API Routes
 * REST API endpoints for NBA 2K player data
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { HonoWithConvex, HttpRouterWithHono } from "convex-helpers/server/hono";
import { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  detectUnknownParams,
  formatUnknownParamsError,
  VALID_PARAMS_BY_ENDPOINT,
} from "./_validation";

const app: HonoWithConvex<ActionCtx> = new Hono();

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Constant-time string comparison to prevent timing attacks.
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

/**
 * Validate admin API key from X-Admin-Key header
 * Uses constant-time comparison to prevent timing attacks
 * SECURITY: Fails if ADMIN_API_KEY is not properly configured
 */
function validateAdminKey(c: any): { valid: boolean; error?: Response } {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = process.env.ADMIN_API_KEY;

  // CRITICAL: Fail if admin key not properly configured
  if (!expectedKey || expectedKey.length < 32) {
    console.error("❌ ADMIN_API_KEY not configured or too short (min 32 chars)!");
    return {
      valid: false,
      error: c.json(errorResponse("Service misconfigured", "SERVER_ERROR"), 503)
    };
  }

  if (!adminKey) {
    return {
      valid: false,
      error: c.json(errorResponse("Unauthorized", "MISSING_ADMIN_KEY", {
        message: "Admin key required. Provide it in the X-Admin-Key header."
      }), 401)
    };
  }

  if (!constantTimeCompare(adminKey, expectedKey)) {
    return {
      valid: false,
      error: c.json(errorResponse("Unauthorized", "INVALID_ADMIN_KEY"), 401)
    };
  }

  return { valid: true };
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Logger middleware (only in development)
if (process.env.NODE_ENV === "development") {
  app.use("*", logger());
}

// ============================================================================
// ETAG / CONDITIONAL GET (custom — replaces hono/etag)
// ============================================================================
//
// Why custom instead of hono/etag:
// Cloudflare (which sits in front of api.nba2kapi.com) appends a transport
// encoding suffix like `-gzip` to ETag values when it compresses responses,
// and the mutated tag is what clients hold onto and send back as
// If-None-Match. hono/etag does byte-equal comparison after stripping only
// `W/`, so a client-echoed `W/"abc-gzip"` never matches a server-computed
// `W/"abc"` and the conditional GET silently degrades to a full 200. The
// browser-visible effect is that 304s never happen and every page view
// re-downloads the full payload.
//
// This middleware:
//   - computes ETag from the response body (SHA-1, same as hono/etag)
//   - normalizes BOTH the incoming If-None-Match and the server tag before
//     comparison: strips `W/`, surrounding quotes, and any
//     `-(gzip|br|deflate|zstd)` suffix added by upstream proxies
//   - supports `*` and comma-separated lists (RFC 7232)
//   - preserves all original response headers on the 304 (critically: CORS
//     headers; browsers enforce CORS on every response including 304)

async function sha1Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeEtag(tag: string): string {
  let t = tag.trim();
  if (t.startsWith("W/")) t = t.slice(2);
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    t = t.slice(1, -1);
  }
  return t.replace(/-(gzip|br|deflate|zstd)$/i, "");
}

function ifNoneMatchSatisfied(
  ifNoneMatch: string | null | undefined,
  etag: string,
): boolean {
  if (!ifNoneMatch) return false;
  const trimmed = ifNoneMatch.trim();
  if (trimmed === "*") return true;
  const normalizedEtag = normalizeEtag(etag);
  return trimmed
    .split(",")
    .some((candidate) => normalizeEtag(candidate) === normalizedEtag);
}

async function smartEtagMiddleware(c: any, next: any) {
  await next();

  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD") return;

  const res = c.res as Response | undefined;
  if (!res || res.status !== 200) return;

  let bodyText: string;
  try {
    bodyText = await res.clone().text();
  } catch {
    return; // streaming or non-text body — skip
  }
  if (!bodyText) return;

  const etag = `W/"${await sha1Hex(bodyText)}"`;

  if (ifNoneMatchSatisfied(c.req.header("If-None-Match"), etag)) {
    // 304 must keep CORS / Cache-Control / X-RateLimit-* headers so the
    // browser doesn't surface a CORS error in place of a successful revalidate.
    const headers = new Headers(res.headers);
    headers.set("ETag", etag);
    headers.delete("Content-Length");
    headers.delete("Content-Encoding");
    headers.delete("Content-Type");
    c.res = new Response(null, { status: 304, headers });
    return;
  }

  // Attach ETag to the outgoing 200 and forward the body unchanged.
  const headers = new Headers(res.headers);
  headers.set("ETag", etag);
  c.res = new Response(bodyText, { status: res.status, headers });
}

app.use("*", smartEtagMiddleware);

// CORS configuration: allowlist of origins permitted to call the API from browsers.
//
// Default allowlist always includes the production frontend and local dev. Additional
// origins can be added via the CORS_ALLOWED_ORIGINS env var (comma-separated). The
// legacy CLIENT_ORIGIN env var is still honored as a single additional entry so we
// don't break existing prod config.
//
// `origin: (originHeader) => string | null` echoes the request Origin back as
// Access-Control-Allow-Origin when it matches the allowlist, on both preflight
// (OPTIONS) and actual responses. Returning null suppresses the header (browser
// blocks the response). `credentials: false` so wildcard subdomains aren't needed.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://nba2kapi.com",
  "https://www.nba2kapi.com",
  "https://blacktopblitz.com",
  "https://www.blacktopblitz.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

const extraOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const legacyClientOrigin = process.env.CLIENT_ORIGIN?.trim();

const ALLOWED_ORIGINS = new Set<string>([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...extraOrigins,
  ...(legacyClientOrigin ? [legacyClientOrigin] : []),
]);

app.use("/api/*", cors({
  origin: (originHeader) => {
    if (!originHeader) return null; // non-browser request (curl, server-to-server)
    return ALLOWED_ORIGINS.has(originHeader) ? originHeader : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Admin-Key", "If-None-Match"],
  credentials: false, // Not needed for header-based auth
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "ETag", "Cache-Control"],
  maxAge: 86400, // Cache preflight for 24h
}));

/**
 * Extract the client's real IP from request headers.
 * Cloudflare sets CF-Connecting-IP; standard proxies set X-Forwarded-For.
 */
function getClientIp(c: any): string {
  return (
    c.req.header("CF-Connecting-IP") ||
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    c.req.header("X-Real-IP") ||
    "unknown"
  );
}

/**
 * IP-based rate-limit middleware for unauthenticated public endpoints.
 * Sets standard X-RateLimit-* headers and returns 429 when exceeded.
 * 60 requests / minute / IP — see checkPublicApiRateLimit in apiKeys.ts.
 */
async function publicIpRateLimitMiddleware(c: any, next: any) {
  const ip = getClientIp(c);
  const result = await c.env.runMutation(api.apiKeys.checkPublicApiRateLimit, { ip });

  c.header("X-RateLimit-Limit", result.limit.toString());
  c.header("X-RateLimit-Remaining", result.remaining.toString());
  c.header("X-RateLimit-Reset", result.resetAt);

  if (!result.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000),
    );
    c.header("Retry-After", retryAfter.toString());
    return c.json(errorResponse(
      "Rate limit exceeded for public API",
      "RATE_LIMIT_EXCEEDED",
      {
        limit: result.limit,
        reset: result.resetAt,
        retryAfter,
        message: `Public API limit is ${result.limit} requests/minute per IP. Try again in ${retryAfter}s, or get an API key at https://nba2kapi.com for higher limits.`,
      },
    ), 429);
  }

  await next();
}

// API Key authentication middleware (apply to protected routes)
async function authMiddleware(c: any, next: any) {
  const apiKey = c.req.header("X-API-Key");

  if (!apiKey) {
    return c.json(errorResponse(
      "API key required",
      "MISSING_API_KEY",
      { message: "Please provide an API key in the X-API-Key header" }
    ), 401);
  }

  // Validate API key
  const validation = await c.env.runQuery(api.apiKeys.validateApiKey, { key: apiKey });

  if (!validation.valid) {
    return c.json(errorResponse(
      "Invalid or inactive API key",
      "INVALID_API_KEY",
      { reason: validation.reason }
    ), 401);
  }

  // Check rate limit (atomic - increments counter)
  const startTime = Date.now();
  const rateLimit = await c.env.runMutation(api.apiKeys.checkRateLimit, { key: apiKey });

  if (!rateLimit.allowed) {
    c.header("X-RateLimit-Limit", rateLimit.limit?.toString() || "100");
    c.header("X-RateLimit-Remaining", "0");
    c.header("X-RateLimit-Reset", rateLimit.reset || "");

    // Calculate retryAfter in seconds
    const resetTime = rateLimit.reset ? new Date(rateLimit.reset).getTime() : Date.now() + 60000;
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

    return c.json(errorResponse(
      "Rate limit exceeded",
      "RATE_LIMIT_EXCEEDED",
      {
        limit: rateLimit.limit,
        reset: rateLimit.reset,
        retryAfter: retryAfter,
        message: `You have exceeded your rate limit. Please try again in ${retryAfter} seconds`
      }
    ), 429);
  }

  // Add rate limit headers
  c.header("X-RateLimit-Limit", rateLimit.limit.toString());
  c.header("X-RateLimit-Remaining", rateLimit.remaining.toString());
  c.header("X-RateLimit-Reset", rateLimit.reset);

  // Capture status code using Hono context storage
  c.set("capturedStatusCode", 200);
  const originalJson = c.json.bind(c);

  c.json = function(body: any, status?: number | ResponseInit) {
    let code = 200;
    if (typeof status === "number") {
      code = status;
    } else if (status && typeof status === "object" && "status" in status) {
      code = status.status as number;
    }
    c.set("capturedStatusCode", code);
    return originalJson(body, status);
  };

  await next();

  // Log request after response
  const responseTime = Date.now() - startTime;
  const responseStatus = c.get("capturedStatusCode") || 200;
  
  // Log request - await mutation to ensure it completes
  try {
    await c.env.runMutation(api.apiKeys.logRequest, {
      apiKeyId: rateLimit.apiKeyId as Id<"apiKeys">,
      endpoint: c.req.path,
      method: c.req.method,
      statusCode: responseStatus,
      responseTime,
      queryParams: c.req.url.includes("?") ? c.req.url.split("?")[1] : undefined,
    });
  } catch (error: unknown) {
    console.error("Failed to log request:", error);
  }
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function successResponse<T>(data: T, meta?: any) {
  // IMPORTANT: do not inject `new Date().toISOString()` into the response body.
  // The Hono etag() middleware hashes the body; a fresh timestamp per request
  // would invalidate the ETag every time and defeat If-None-Match / 304 handling.
  // Clients that need server time should read the standard HTTP `Date` header.
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

function errorResponse(message: string, code = "UNKNOWN_ERROR", details?: any) {
  return {
    success: false,
    error: {
      message,
      code,
      ...(details && { details }),
      timestamp: new Date().toISOString(),
    },
  };
}

// ============================================================================
// STRICT QUERY VALIDATION
// ============================================================================

/**
 * Creates a middleware that rejects unknown query parameters with helpful errors.
 * Use this BEFORE zValidator to catch invalid params before Zod validation runs.
 */
function rejectUnknownParams(endpoint: string) {
  const validParams = VALID_PARAMS_BY_ENDPOINT[endpoint] || new Set<string>();

  return async (c: any, next: any) => {
    const url = new URL(c.req.url);
    const actualParams: Record<string, string> = {};

    url.searchParams.forEach((value, key) => {
      actualParams[key] = value;
    });

    // Check for unknown parameters
    const unknownErrors = detectUnknownParams(actualParams, validParams);

    if (unknownErrors.length > 0) {
      const errorDetails = formatUnknownParamsError(unknownErrors, endpoint);
      return c.json(errorResponse(
        errorDetails.message,
        errorDetails.code,
        errorDetails.details
      ), 400);
    }

    return next();
  };
}

// ============================================================================
// ROUTES: ROOT & HEALTH
// ============================================================================

// GET / - Root endpoint - welcome message with helpful links
app.get("/", (c) => {
  return c.json({
    service: "NBA2KAPI",
    version: "1.0.0",
    message: "Welcome to the NBA 2K Ratings API",
    links: {
      documentation: "https://nba2kapi.com/docs",
      getApiKey: "https://nba2kapi.com/dashboard",
      health: "/api/health",
      stats: "/api/stats"
    },
    note: "To get an API key, visit https://nba2kapi.com"
  });
});

// GET /api/health - Health check endpoint (no auth required)
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "NBA2KAPI",
    version: "1.0.0",
  });
});

// ============================================================================
// ROUTES: REGISTRATION & DASHBOARD
// ============================================================================

// POST /api/register - Register for API key (no auth required, but rate limited)
app.post("/api/register",
  zValidator("json", z.object({
    email: z.string().email(),
    name: z.string().min(1),
    purpose: z.string().optional(),
  })),
  async (c) => {
    try {
      // Rate limit by IP to prevent abuse (database-backed for serverless compatibility)
      const clientIp = getClientIp(c);

      const rateCheck = await c.env.runMutation(api.apiKeys.checkRegistrationRateLimit, {
        ip: clientIp,
      });
      if (!rateCheck.allowed) {
        return c.json(errorResponse(
          "Too many registration attempts. Try again later.",
          "REGISTRATION_RATE_LIMIT",
          { retryAfter: "1 hour", remaining: rateCheck.remaining }
        ), 429);
      }

      const { email, name, purpose } = c.req.valid("json");

      const createKeyArgs: any = { email, name };
      if (purpose !== undefined) {
        createKeyArgs.purpose = purpose;
      }

      const result = await c.env.runMutation(api.apiKeys.createApiKey, createKeyArgs);

      return c.json(successResponse({
        apiKey: result.apiKey,
        rateLimit: result.rateLimit,
        message: "API key created successfully. Keep this key secure!",
      }), 201);
    } catch (error: any) {
      console.error("Registration error:", error);

      // Check if it's the per-email limit error
      if (error.message?.includes("Maximum") && error.message?.includes("active API keys")) {
        return c.json(errorResponse(
          error.message,
          "KEY_LIMIT_EXCEEDED"
        ), 400);
      }

      return c.json(errorResponse(
        "Failed to create API key",
        "REGISTRATION_ERROR"
      ), 500);
    }
  }
);

// GET /api/dashboard/usage - Get usage stats (requires auth)
app.get("/api/dashboard/usage", authMiddleware, async (c) => {
  try {
    const apiKey = c.req.header("X-API-Key");

    if (!apiKey) {
      return c.json(errorResponse(
        "API key required",
        "MISSING_API_KEY"
      ), 401);
    }

    const stats = await c.env.runQuery(api.apiKeys.getApiKeyStats, {
      key: apiKey,
    });

    // Dashboard data is user-specific, should not be cached
    c.header("Cache-Control", "private, no-cache");

    return c.json(successResponse(stats));
  } catch (error: any) {
    console.error("Dashboard error:", error);
    return c.json(errorResponse(
      "Failed to fetch usage stats",
      "DASHBOARD_ERROR"
    ), 500);
  }
});

// ============================================================================
// ROUTES: ADMIN (Scraping)
// ============================================================================

// POST /api/admin/scrape - Manually trigger scraping (requires admin key in header)
app.post("/api/admin/scrape",
  zValidator("json", z.object({
    teamType: z.enum(["curr", "class", "allt"]),
    teams: z.array(z.string()).optional(),
  })),
  async (c) => {
    // Verify admin key from header (not body)
    const auth = validateAdminKey(c);
    if (!auth.valid) return auth.error;

    try {
      const { teamType, teams } = c.req.valid("json");

      // Create job ID
      const jobId = `scrape_${teamType}_${Date.now()}`;

      // Note: Actual scraping must be done externally via scripts/runScraper.js
      // due to Cloudflare protection on 2kratings.com requiring Playwright browser
      // This endpoint returns the job ID that the external scraper should use

      return c.json(successResponse({
        jobId,
        status: "pending",
        message: "Scrape job ID created. Run externally: node scripts/runScraper.js " + teamType + (teams ? " " + teams.join(',') : ""),
        command: `CONVEX_URL=${process.env.CONVEX_DEPLOYMENT_URL} node scripts/runScraper.js ${teamType}${teams ? ' ' + teams.join(',') : ''}`,
      }), 202);

    } catch (error: any) {
      console.error("Scrape trigger error:", error);
      return c.json(errorResponse(
        "Failed to start scraping job",
        "SCRAPE_ERROR"
      ), 500);
    }
  }
);

// GET /api/admin/stats - Aggregate usage stats (requires admin key in header).
// Returns API key counts, request volume across rolling windows, top endpoints,
// top users, public-endpoint IP traffic, and DB size. Intended for ad-hoc curl.
app.get("/api/admin/stats", async (c) => {
  const auth = validateAdminKey(c);
  if (!auth.valid) return auth.error;

  try {
    const stats = await c.env.runQuery(api.admin.getAdminStats, {});
    // No caching — stats should reflect current state on every call.
    c.header("Cache-Control", "no-store");
    return c.json(successResponse(stats));
  } catch (error: any) {
    console.error("Get admin stats error:", error);
    return c.json(errorResponse(
      "Failed to fetch admin stats",
      "QUERY_ERROR"
    ), 500);
  }
});

// GET /api/admin/scrape/jobs - Get recent scrape jobs (requires admin key in header)
app.get("/api/admin/scrape/jobs",
  zValidator("query", z.object({
    limit: z.coerce.number().min(1).max(50).default(10),
  })),
  async (c) => {
    // Verify admin key from header
    const auth = validateAdminKey(c);
    if (!auth.valid) return auth.error;

    try {
      const { limit } = c.req.valid("query");

      const jobs = await c.env.runQuery(api.scrapeJobs.getRecentJobs, { limit });

      return c.json(successResponse(jobs, {
        count: jobs.length,
      }));

    } catch (error: any) {
      console.error("Get jobs error:", error);
      return c.json(errorResponse(
        "Failed to fetch scrape jobs",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/admin/scrape/:jobId - Get specific scrape job status (requires admin key in header)
app.get("/api/admin/scrape/:jobId",
  async (c) => {
    // Verify admin key from header
    const auth = validateAdminKey(c);
    if (!auth.valid) return auth.error;

    try {
      const jobId = c.req.param("jobId");

      const job = await c.env.runQuery(api.scrapeJobs.getJobStatus, { jobId });

      if (!job) {
        return c.json(errorResponse(
          "Scrape job not found",
          "NOT_FOUND",
          { jobId }
        ), 404);
      }

      return c.json(successResponse(job));

    } catch (error: any) {
      console.error("Get job status error:", error);
      return c.json(errorResponse(
        "Failed to fetch job status",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// ============================================================================
// ROUTES: PLAYERS
// ============================================================================

// GET /api/players - List players with filtering and pagination
app.get("/api/players",
  authMiddleware,
  rejectUnknownParams("/api/players"),
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).default("curr"),
    team: z.string().optional(),
    minRating: z.coerce.number().min(0).max(99).optional(),
    maxRating: z.coerce.number().min(0).max(99).optional(),
    position: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    try {
      const params = c.req.valid("query");

      // Calculate offset from cursor (offset-based pagination)
      let offset = 0;
      if (params.cursor) {
        const parsedOffset = parseInt(params.cursor, 10);
        if (!isNaN(parsedOffset)) {
          offset = parsedOffset;
        }
      }

      // Build query args, only including defined values
      const queryArgs: any = {
        teamType: params.teamType,
        sortBy: "overall-desc",
        limit: params.limit,
        offset: offset,
      };

      if (params.team) queryArgs.teams = [params.team];
      if (params.minRating !== undefined) queryArgs.minOverall = params.minRating;
      if (params.maxRating !== undefined) queryArgs.maxOverall = params.maxRating;
      if (params.position) queryArgs.positions = [params.position];

      // Use optimized getAllFiltered which filters at database level
      const result = await c.env.runQuery(api.players.getAllFiltered, queryArgs);

      // Calculate next cursor
      const nextCursor = result.hasMore ? (offset + params.limit).toString() : undefined;

      // Add caching headers - player data cached for 1 hour
      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(result.players, {
        pagination: {
          hasMore: result.hasMore,
          nextCursor: nextCursor,
          count: result.players.length,
          limit: params.limit,
          total: result.totalCount,
        },
      }));
    } catch (error: any) {
      console.error("Error fetching players:", error);
      return c.json(errorResponse(
        "Failed to fetch players",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/players/bulk - Authenticated bulk export. Returns ALL matching
// players in a single response (no pagination). Costs 1 request against the
// caller's rate limit instead of the N requests needed to paginate through
// /api/players. Useful for warehouse loads, local mirrors, ML datasets, etc.
// Heavily cached at the edge (1 hour) and revalidates via ETag/304.
//
// NOTE: This route MUST be registered before /api/players/:id so "bulk" isn't
// parsed as a player ID.
app.get("/api/players/bulk",
  authMiddleware,
  rejectUnknownParams("/api/players/bulk"),
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).optional(),
    team: z.string().optional(),
    minRating: z.coerce.number().min(0).max(99).optional(),
    maxRating: z.coerce.number().min(0).max(99).optional(),
    position: z.string().optional(),
  })),
  async (c) => {
    try {
      const params = c.req.valid("query");

      // Cap at 10k to defend against future schema growth; current DB is ~1.9k
      // players, so this returns everything matching the filters.
      const queryArgs: any = {
        sortBy: "overall-desc",
        limit: 10000,
        offset: 0,
      };
      if (params.teamType) queryArgs.teamType = params.teamType;
      if (params.team) queryArgs.teams = [params.team];
      if (params.minRating !== undefined) queryArgs.minOverall = params.minRating;
      if (params.maxRating !== undefined) queryArgs.maxOverall = params.maxRating;
      if (params.position) queryArgs.positions = [params.position];

      const result = await c.env.runQuery(api.players.getAllFiltered, queryArgs);

      c.header("Cache-Control", "public, max-age=3600, s-maxage=3600");

      return c.json(successResponse(result.players, {
        count: result.players.length,
        total: result.totalCount,
        filters: {
          teamType: params.teamType ?? null,
          team: params.team ?? null,
          minRating: params.minRating ?? null,
          maxRating: params.maxRating ?? null,
          position: params.position ?? null,
        },
      }));
    } catch (error: any) {
      console.error("Error fetching bulk players:", error);
      return c.json(errorResponse(
        "Failed to fetch bulk players",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/public/players - Public, unauthenticated read-only player list.
// Same shape as /api/players (delegates to the same underlying query).
// Auth: none. Rate limit: 60 req/min/IP. Intended for browser-shipped apps
// (e.g. blacktopblitz.com) that can't safely embed an API key.
app.get("/api/public/players",
  publicIpRateLimitMiddleware,
  rejectUnknownParams("/api/public/players"),
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).default("curr"),
    team: z.string().optional(),
    minRating: z.coerce.number().min(0).max(99).optional(),
    maxRating: z.coerce.number().min(0).max(99).optional(),
    position: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    try {
      const params = c.req.valid("query");

      let offset = 0;
      if (params.cursor) {
        const parsedOffset = parseInt(params.cursor, 10);
        if (!isNaN(parsedOffset)) offset = parsedOffset;
      }

      const queryArgs: any = {
        teamType: params.teamType,
        sortBy: "overall-desc",
        limit: params.limit,
        offset,
      };
      if (params.team) queryArgs.teams = [params.team];
      if (params.minRating !== undefined) queryArgs.minOverall = params.minRating;
      if (params.maxRating !== undefined) queryArgs.maxOverall = params.maxRating;
      if (params.position) queryArgs.positions = [params.position];

      const result = await c.env.runQuery(api.players.getAllFiltered, queryArgs);
      const nextCursor = result.hasMore ? (offset + params.limit).toString() : undefined;

      // Cache aggressively at the edge — player data only changes on bi-weekly scrape.
      c.header("Cache-Control", "public, max-age=3600, s-maxage=3600");

      return c.json(successResponse(result.players, {
        pagination: {
          hasMore: result.hasMore,
          nextCursor,
          count: result.players.length,
          limit: params.limit,
          total: result.totalCount,
        },
      }));
    } catch (error: any) {
      console.error("Error fetching public players:", error);
      return c.json(errorResponse(
        "Failed to fetch players",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/players/search - Search players by name
// NOTE: This route MUST come before /api/players/:id to avoid matching "search" as an ID
app.get("/api/players/search",
  authMiddleware,
  rejectUnknownParams("/api/players/search"),
  zValidator("query", z.object({
    q: z.string().min(1, "Search query is required").max(100, "Search query too long"),
    teamType: z.enum(["curr", "class", "allt"]).optional(),
    limit: z.coerce.number().min(1).max(50).default(50),
  })),
  async (c) => {
    try {
      const { q, teamType, limit } = c.req.valid("query");

      const searchArgs: any = { query: q };
      if (teamType !== undefined) {
        searchArgs.teamType = teamType;
      }

      const results = await c.env.runQuery(api.players.searchPlayers, searchArgs);

      // Results already limited to 50 in query, but respect user's limit if lower
      const limitedResults = results.slice(0, limit);

      // Add caching headers - search results cached for 5 minutes
      c.header("Cache-Control", "public, max-age=300");

      return c.json(successResponse(limitedResults, {
        count: limitedResults.length,
        total: results.length,
        truncated: results.length > limit,
      }));
    } catch (error: any) {
      console.error("Search error:", error);
      return c.json(errorResponse(
        "Search failed",
        "SEARCH_ERROR"
      ), 500);
    }
  }
);

// GET /api/players/:id - Get player by ID
app.get("/api/players/:id",
  authMiddleware,
  rejectUnknownParams("/api/players/:id"),
  async (c) => {
  try {
    const playerId = c.req.param("id");

    if (!playerId.startsWith("j") || playerId.length < 10) {
      return c.json(errorResponse(
        "Invalid player ID format",
        "INVALID_ID"
      ), 400);
    }

    const player = await c.env.runQuery(api.players.getPlayerById, {
      id: playerId as any,
    });

    if (!player) {
      return c.json(errorResponse(
        "Player not found",
        "PLAYER_NOT_FOUND",
        { playerId }
      ), 404);
    }

    // Add caching headers - individual player data cached for 1 hour
    c.header("Cache-Control", "public, max-age=3600");

    return c.json(successResponse(player));
  } catch (error: any) {
    console.error("Error fetching player:", error);
    return c.json(errorResponse(
      "Failed to fetch player",
      "QUERY_ERROR"
    ), 500);
  }
});

// GET /api/players/slug/:slug - Get player by slug (more user-friendly)
app.get("/api/players/slug/:slug",
  authMiddleware,
  rejectUnknownParams("/api/players/slug/:slug"),
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).optional(),
    team: z.string().optional(),
  })),
  async (c) => {
    try {
      const slug = c.req.param("slug");
      const { teamType, team } = c.req.valid("query");

      const playerArgs: any = { slug };
      if (teamType !== undefined) {
        playerArgs.teamType = teamType;
      }
      if (team !== undefined) {
        playerArgs.team = team;
      }

      const player = await c.env.runQuery(api.players.getPlayerBySlug, playerArgs);

      if (!player) {
        return c.json(errorResponse(
          "Player not found",
          "PLAYER_NOT_FOUND",
          { slug, teamType, team }
        ), 404);
      }

      // Add caching headers - individual player data cached for 1 hour
      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(player));
    } catch (error: any) {
      console.error("Error fetching player by slug:", error);
      return c.json(errorResponse(
        "Failed to fetch player",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/players/:id/history - Get player rating history over time
app.get("/api/players/:id/history",
  authMiddleware,
  zValidator("query", z.object({
    gameVersion: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    try {
      const playerId = c.req.param("id");
      const { gameVersion, limit } = c.req.valid("query");

      if (!playerId.startsWith("j") || playerId.length < 10) {
        return c.json(errorResponse(
          "Invalid player ID format",
          "INVALID_ID"
        ), 400);
      }

      const historyArgs: any = {
        playerId: playerId as any,
        limit,
      };
      if (gameVersion) historyArgs.gameVersion = gameVersion;

      const history = await c.env.runQuery(api.playerHistory.getPlayerHistory, historyArgs);

      c.header("Cache-Control", "public, max-age=300");

      return c.json(successResponse(history, {
        count: history.length,
        playerId,
      }));
    } catch (error: any) {
      console.error("Error fetching player history:", error);
      return c.json(errorResponse(
        "Failed to fetch player history",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/players/:id/attribute/:attr - Get specific attribute history
app.get("/api/players/:id/attribute/:attr",
  authMiddleware,
  zValidator("query", z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    try {
      const playerId = c.req.param("id");
      const attribute = c.req.param("attr");
      const { limit } = c.req.valid("query");

      if (!playerId.startsWith("j") || playerId.length < 10) {
        return c.json(errorResponse(
          "Invalid player ID format",
          "INVALID_ID"
        ), 400);
      }

      const history = await c.env.runQuery(api.playerHistory.getAttributeHistory, {
        playerId: playerId as any,
        attribute,
        limit,
      });

      c.header("Cache-Control", "public, max-age=300");

      return c.json(successResponse(history, {
        attribute,
        playerId,
        dataPoints: history.length,
      }));
    } catch (error: any) {
      console.error("Error fetching attribute history:", error);
      return c.json(errorResponse(
        "Failed to fetch attribute history",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/players/:id/versions - Get cross-version ratings (2K26, 2K25, etc.)
app.get("/api/players/:id/versions",
  authMiddleware,
  async (c) => {
    try {
      const playerId = c.req.param("id");

      if (!playerId.startsWith("j") || playerId.length < 10) {
        return c.json(errorResponse(
          "Invalid player ID format",
          "INVALID_ID"
        ), 400);
      }

      const player = await c.env.runQuery(api.players.getPlayerById, {
        id: playerId as any,
      });

      if (!player) {
        return c.json(errorResponse(
          "Player not found",
          "PLAYER_NOT_FOUND",
          { playerId }
        ), 404);
      }

      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse({
        playerId,
        name: player.name,
        slug: player.slug,
        currentVersion: player.gameVersion || "2K26",
        currentOverall: player.overall,
        ratingHistory: player.ratingHistory || [],
      }));
    } catch (error: any) {
      console.error("Error fetching player versions:", error);
      return c.json(errorResponse(
        "Failed to fetch player versions",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// ============================================================================
// ROUTES: TEAMS
// ============================================================================

// GET /api/teams - List all teams
app.get("/api/teams",
  authMiddleware,
  rejectUnknownParams("/api/teams"),
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).default("curr"),
  })),
  async (c) => {
    try {
      const { teamType } = c.req.valid("query");

      const teams = await c.env.runQuery(api.players.getTeams, { teamType });

      // Add caching headers - teams list cached for 1 hour
      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(teams, {
        count: teams.length,
      }));
    } catch (error: any) {
      console.error("Error fetching teams:", error);
      return c.json(errorResponse(
        "Failed to fetch teams",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/teams/:teamName/roster - Get team roster
app.get("/api/teams/:teamName/roster",
  authMiddleware,
  rejectUnknownParams("/api/teams/:teamName/roster"),
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).optional(),
  })),
  async (c) => {
    try {
      const teamName = decodeURIComponent(c.req.param("teamName"));

      // Validate team name
      if (!teamName || teamName.length > 50 || teamName.length < 1) {
        return c.json(errorResponse(
          "Invalid team name",
          "INVALID_INPUT",
          { message: "Team name must be between 1 and 50 characters" }
        ), 400);
      }

      const { teamType } = c.req.valid("query");

      const rosterArgs: any = { team: teamName };
      if (teamType !== undefined) {
        rosterArgs.teamType = teamType;
      }

      const roster = await c.env.runQuery(api.players.getPlayersByTeam, rosterArgs);

      if (roster.length === 0) {
        return c.json(errorResponse(
          `No players found for team: ${teamName}`,
          "TEAM_NOT_FOUND",
          { teamName, teamType }
        ), 404);
      }

      // Add caching headers - team rosters cached for 1 hour
      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(roster, {
        team: teamName,
        teamType: teamType || "all",
        count: roster.length,
      }));
    } catch (error: any) {
      console.error("Error fetching roster:", error);
      return c.json(errorResponse(
        "Failed to fetch roster",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// ============================================================================
// ROUTES: TRENDING
// ============================================================================

// GET /api/trending - Get players with biggest recent rating changes
app.get("/api/trending",
  authMiddleware,
  zValidator("query", z.object({
    teamType: z.enum(["curr", "class", "allt"]).optional(),
    days: z.coerce.number().min(1).max(90).default(7),
    limit: z.coerce.number().min(1).max(50).default(20),
  })),
  async (c) => {
    try {
      const { teamType, days, limit } = c.req.valid("query");

      const trendingArgs: any = { days, limit };
      if (teamType) trendingArgs.teamType = teamType;

      const trending = await c.env.runQuery(api.playerHistory.getTopRatingChanges, trendingArgs);

      c.header("Cache-Control", "public, max-age=300");

      return c.json(successResponse(trending, {
        count: trending.length,
        days,
        teamType: teamType || "all",
      }));
    } catch (error: any) {
      console.error("Error fetching trending players:", error);
      return c.json(errorResponse(
        "Failed to fetch trending players",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// ============================================================================
// ROUTES: BADGES
// ============================================================================

// GET /api/badges - List all badges
app.get("/api/badges",
  authMiddleware,
  zValidator("query", z.object({
    category: z.string().optional(),
    gameVersion: z.string().optional(),
  })),
  async (c) => {
    try {
      const { category, gameVersion } = c.req.valid("query");

      const badgeArgs: any = {};
      if (category) badgeArgs.category = category;
      if (gameVersion) badgeArgs.gameVersion = gameVersion;

      const badges = await c.env.runQuery(api.badges.getAllBadges, badgeArgs);

      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(badges, {
        count: badges.length,
      }));
    } catch (error: any) {
      console.error("Error fetching badges:", error);
      return c.json(errorResponse(
        "Failed to fetch badges",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/badges/categories - Get badge categories with counts
app.get("/api/badges/categories",
  authMiddleware,
  async (c) => {
    try {
      const categories = await c.env.runQuery(api.badges.getBadgeCategories, {});

      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(categories, {
        count: categories.length,
      }));
    } catch (error: any) {
      console.error("Error fetching badge categories:", error);
      return c.json(errorResponse(
        "Failed to fetch badge categories",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/badges/:slug - Get badge by slug
app.get("/api/badges/:slug",
  authMiddleware,
  async (c) => {
    try {
      const slug = c.req.param("slug");

      // Check if this is actually a path like "categories" that should be handled elsewhere
      if (slug === "categories") {
        // This shouldn't happen due to route ordering, but just in case
        const categories = await c.env.runQuery(api.badges.getBadgeCategories, {});
        return c.json(successResponse(categories));
      }

      const badge = await c.env.runQuery(api.badges.getBadgeBySlug, { slug });

      if (!badge) {
        return c.json(errorResponse(
          "Badge not found",
          "BADGE_NOT_FOUND",
          { slug }
        ), 404);
      }

      c.header("Cache-Control", "public, max-age=3600");

      return c.json(successResponse(badge));
    } catch (error: any) {
      console.error("Error fetching badge:", error);
      return c.json(errorResponse(
        "Failed to fetch badge",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// GET /api/badges/:slug/players - Get players with a specific badge
app.get("/api/badges/:slug/players",
  authMiddleware,
  zValidator("query", z.object({
    tier: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
  })),
  async (c) => {
    try {
      const slug = c.req.param("slug");
      const { tier, limit } = c.req.valid("query");

      const playersArgs: any = { badgeSlug: slug, limit };
      if (tier) playersArgs.tier = tier;

      const players = await c.env.runQuery(api.badges.getPlayersWithBadge, playersArgs);

      c.header("Cache-Control", "public, max-age=1800");

      return c.json(successResponse(players, {
        badge: slug,
        tier: tier || "all",
        count: players.length,
      }));
    } catch (error: any) {
      console.error("Error fetching players with badge:", error);
      return c.json(errorResponse(
        "Failed to fetch players with badge",
        "QUERY_ERROR"
      ), 500);
    }
  }
);

// ============================================================================
// ROUTES: STATISTICS
// ============================================================================

// GET /api/stats - Get database statistics (public, no auth required)
app.get("/api/stats", async (c) => {
  try {
    const stats = await c.env.runQuery(api.players.getStats);

    // Add caching headers - stats cached for 30 minutes
    c.header("Cache-Control", "public, max-age=1800");

    return c.json(successResponse(stats));
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    return c.json(errorResponse(
      "Failed to fetch statistics",
      "QUERY_ERROR"
    ), 500);
  }
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

app.notFound((c) => {
  return c.json(errorResponse(
    "Endpoint not found",
    "NOT_FOUND",
    { path: c.req.path }
  ), 404);
});

app.onError((err, c) => {
  console.error("HTTP Error:", err);
  return c.json(errorResponse(
    "Internal server error",
    "INTERNAL_ERROR",
    process.env.CONVEX_CLOUD_URL?.includes("dev") ? err.message : undefined
  ), 500);
});

// ============================================================================
// EXPORT
// ============================================================================

export default new HttpRouterWithHono(app);
