/**
 * HTTP API Routes
 * REST API endpoints for NBA 2K player data
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { etag } from "hono/etag";
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
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Registration rate limiting (in-memory, per-instance)
 * Limits registrations per IP to prevent abuse
 */
const registrationAttempts = new Map<string, { count: number; resetAt: number }>();
const REGISTRATION_LIMIT = 5;       // Max registrations per window
const REGISTRATION_WINDOW = 3600000; // 1 hour in milliseconds

function checkRegistrationRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const attempt = registrationAttempts.get(ip);

  // Periodic cleanup: remove expired entries when map gets large
  if (registrationAttempts.size > 10000) {
    for (const [key, val] of registrationAttempts) {
      if (val.resetAt < now) registrationAttempts.delete(key);
    }
  }

  // New IP or expired window
  if (!attempt || attempt.resetAt < now) {
    registrationAttempts.set(ip, { count: 1, resetAt: now + REGISTRATION_WINDOW });
    return { allowed: true, remaining: REGISTRATION_LIMIT - 1 };
  }

  // Check if at limit
  if (attempt.count >= REGISTRATION_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  // Increment counter
  attempt.count++;
  return { allowed: true, remaining: REGISTRATION_LIMIT - attempt.count };
}

/**
 * Validate admin API key from X-Admin-Key header
 * Uses constant-time comparison to prevent timing attacks
 */
function validateAdminKey(c: any): { valid: boolean; error?: Response } {
  const adminKey = c.req.header("X-Admin-Key");

  if (!adminKey) {
    return {
      valid: false,
      error: c.json(errorResponse("Unauthorized", "MISSING_ADMIN_KEY", {
        message: "Admin key required. Provide it in the X-Admin-Key header."
      }), 401)
    };
  }

  const expectedKey = process.env.ADMIN_API_KEY || "";
  if (!expectedKey || !constantTimeCompare(adminKey, expectedKey)) {
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

// Enable ETag support for caching
app.use("*", etag());

// CORS configuration with production safety check
const clientOrigin = process.env.CLIENT_ORIGIN;

// In production, require CLIENT_ORIGIN to be explicitly set
if (!clientOrigin) {
  const isProduction = process.env.CONVEX_CLOUD_URL?.includes("canny-kingfisher");
  if (isProduction) {
    console.error("❌ SECURITY ERROR: CLIENT_ORIGIN must be set in production!");
    // Don't throw - this would break the deployment. Instead, use restrictive default.
  } else {
    console.warn("⚠️ CLIENT_ORIGIN not set. Using http://localhost:3000 for development.");
  }
}

app.use("/api/*", cors({
  origin: clientOrigin || "http://localhost:3000",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Admin-Key", "If-None-Match"],
  credentials: false, // Not needed for header-based auth
  exposeHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "ETag", "Cache-Control"],
}));

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
  return {
    success: true,
    data,
    ...(meta && { meta: { ...meta, timestamp: new Date().toISOString() } }),
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
      // Rate limit by IP to prevent abuse
      const clientIp = c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
                    || c.req.header("CF-Connecting-IP")
                    || "unknown";

      const rateCheck = checkRegistrationRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return c.json(errorResponse(
          "Too many registration attempts. Try again later.",
          "REGISTRATION_RATE_LIMIT",
          { retryAfter: "1 hour" }
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
