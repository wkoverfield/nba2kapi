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
// MIDDLEWARE
// ============================================================================

// Logger middleware (only in development)
if (process.env.NODE_ENV === "development") {
  app.use("*", logger());
}

// Enable ETag support for caching
app.use("*", etag());

// CORS configuration
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";

app.use("/api/*", cors({
  origin: clientOrigin,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "If-None-Match"],
  credentials: true,
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

// POST /api/register - Register for API key (no auth required)
app.post("/api/register",
  zValidator("json", z.object({
    email: z.string().email(),
    name: z.string().min(1),
    purpose: z.string().optional(),
  })),
  async (c) => {
    try {
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

// POST /api/admin/scrape - Manually trigger scraping (requires admin key)
app.post("/api/admin/scrape",
  zValidator("json", z.object({
    teamType: z.enum(["curr", "class", "allt"]),
    teams: z.array(z.string()).optional(),
    adminKey: z.string(),
  })),
  async (c) => {
    try {
      const { teamType, teams, adminKey } = c.req.valid("json");

      // Verify admin key
      if (adminKey !== process.env.ADMIN_API_KEY) {
        return c.json(errorResponse(
          "Unauthorized",
          "INVALID_ADMIN_KEY"
        ), 401);
      }

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

// GET /api/admin/scrape/jobs - Get recent scrape jobs (requires admin key)
app.get("/api/admin/scrape/jobs",
  zValidator("query", z.object({
    adminKey: z.string(),
    limit: z.coerce.number().min(1).max(50).default(10),
  })),
  async (c) => {
    try {
      const { adminKey, limit } = c.req.valid("query");

      // Verify admin key
      if (adminKey !== process.env.ADMIN_API_KEY) {
        return c.json(errorResponse(
          "Unauthorized",
          "INVALID_ADMIN_KEY"
        ), 401);
      }

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

// GET /api/admin/scrape/:jobId - Get specific scrape job status (requires admin key)
app.get("/api/admin/scrape/:jobId",
  zValidator("query", z.object({
    adminKey: z.string(),
  })),
  async (c) => {
    try {
      const jobId = c.req.param("jobId");
      const { adminKey } = c.req.valid("query");

      // Verify admin key
      if (adminKey !== process.env.ADMIN_API_KEY) {
        return c.json(errorResponse(
          "Unauthorized",
          "INVALID_ADMIN_KEY"
        ), 401);
      }

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
