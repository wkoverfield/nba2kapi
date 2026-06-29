/**
 * Convex Database Schema for NBA 2K API
 * Defines tables for players, API keys, and request logs
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  /**
   * Players table - stores comprehensive NBA 2K player data
   */
  players: defineTable({
    // Basic info
    name: v.string(),
    slug: v.string(), // URL-friendly name
    playerUrl: v.optional(v.string()),
    team: v.string(),
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    overall: v.number(),
    positions: v.optional(v.array(v.string())), // Array for filtering: ["PG", "SG"]

    // Physical attributes
    height: v.optional(v.string()),
    weight: v.optional(v.string()),
    wingspan: v.optional(v.string()),

    // Archetype (e.g., "Speedy Blow-By Ace") - new field
    archetype: v.optional(v.string()),
    // Build - old field, kept for backwards compatibility
    build: v.optional(v.string()),

    // College / pre-NBA school (e.g., "Villanova"). Scraped from 2kratings'
    // "Prior to NBA:" field. Used by downstream consumers (blacktop) to filter
    // players by college.
    college: v.optional(v.string()),

    // Images
    playerImage: v.optional(v.string()),
    teamImg: v.optional(v.string()),

    // Detailed attributes (flat structure with all possible attributes)
    // Keys are attribute names (e.g., "closeShot", "midRange"), values are numeric ratings
    attributes: v.optional(v.record(v.string(), v.number())),

    // Badges
    badges: v.optional(
      v.object({
        total: v.optional(v.number()),
        legendary: v.optional(v.number()),
        hallOfFame: v.optional(v.number()),
        gold: v.optional(v.number()),
        silver: v.optional(v.number()),
        bronze: v.optional(v.number()),
        list: v.optional(v.array(
          v.object({
            name: v.string(),
            tier: v.string(),
            category: v.optional(v.string()),
            description: v.optional(v.string()),
            imageUrl: v.optional(v.string()),
          })
        )),
      })
    ),

    // Hot Zones - shooting zones on the court
    hotZones: v.optional(
      v.object({
        leftCornerThree: v.optional(v.string()), // "hot", "cold", "neutral"
        leftWingThree: v.optional(v.string()),
        topKeyThree: v.optional(v.string()),
        rightWingThree: v.optional(v.string()),
        rightCornerThree: v.optional(v.string()),
        leftElbow: v.optional(v.string()),
        topKey: v.optional(v.string()),
        rightElbow: v.optional(v.string()),
        leftBaseline: v.optional(v.string()),
        paint: v.optional(v.string()),
        rightBaseline: v.optional(v.string()),
        underBasket: v.optional(v.string()),
      })
    ),

    // Cross-version historical ratings (from 2kratings.com)
    ratingHistory: v.optional(
      v.array(
        v.object({
          gameVersion: v.string(), // "2K26", "2K25", "2K24", etc.
          overall: v.number(),
          delta: v.optional(v.number()), // +/- from previous version
        })
      )
    ),

    // Current game version
    gameVersion: v.optional(v.string()), // "2K26"

    // Timestamps
    lastUpdated: v.string(), // ISO timestamp
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_name", ["name"])
    .index("by_team", ["team"])
    .index("by_slug", ["slug"])
    .index("by_teamType", ["teamType"])
    .index("by_overall", ["overall"])
    .index("by_team_and_type", ["team", "teamType"]),

  /**
   * API Keys table - stores user API keys for authentication
   */
  apiKeys: defineTable({
    key: v.string(), // Generated UUID
    email: v.string(),
    name: v.string(), // Developer/project name
    userId: v.optional(v.string()), // For future user accounts

    // Rate limiting
    requestCount: v.number(), // Total requests made (all time)
    lastRequest: v.optional(v.string()), // ISO timestamp
    rateLimit: v.number(), // Requests per hour

    // Atomic hourly counter (prevents race conditions)
    currentHourRequests: v.optional(v.number()), // Requests in current hour
    currentHourStart: v.optional(v.string()), // ISO timestamp of hour start

    // Status
    isActive: v.boolean(),

    // Timestamps
    createdAt: v.string(), // ISO timestamp
  })
    .index("by_key", ["key"])
    .index("by_email", ["email"])
    .index("by_isActive", ["isActive"]),

  /**
   * Request Logs table - stores API usage analytics
   */
  requestLogs: defineTable({
    apiKeyId: v.id("apiKeys"), // Reference to API key
    endpoint: v.string(), // Requested endpoint
    method: v.string(), // HTTP method (GET, POST, etc.)
    statusCode: v.number(), // Response status code
    responseTime: v.number(), // Response time in ms
    timestamp: v.string(), // ISO timestamp

    // Optional request details
    queryParams: v.optional(v.string()), // Stringified query params
    ipAddress: v.optional(v.string()),
  })
    .index("by_apiKeyId", ["apiKeyId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_endpoint", ["endpoint"])
    .index("by_apiKeyId_and_timestamp", ["apiKeyId", "timestamp"]), // For efficient rate limiting

  /**
   * Scrape Jobs table - tracks scraping operations
   */
  scrapeJobs: defineTable({
    jobId: v.string(), // Unique job identifier
    teamType: v.union(v.literal("curr"), v.literal("class"), v.literal("allt")),
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),

    // Statistics
    playersScraped: v.number(), // Total players found
    playersUpdated: v.number(), // Existing players updated
    playersAdded: v.number(), // New players added
    teamsScraped: v.number(), // Number of teams processed

    // Errors and logs
    errors: v.array(v.string()), // Error messages

    // Timing
    startTime: v.string(), // ISO timestamp
    endTime: v.optional(v.string()), // ISO timestamp
    duration: v.optional(v.number()), // Duration in ms
  })
    .index("by_jobId", ["jobId"])
    .index("by_status", ["status"])
    .index("by_teamType", ["teamType"])
    .index("by_startTime", ["startTime"]),

  /**
   * Feedback table - user suggestions and feature requests
   */
  feedback: defineTable({
    type: v.string(), // "feature" | "bug" | "improvement" | "other"
    title: v.string(),
    description: v.string(),
    status: v.string(), // "pending" | "planned" | "completed" | "declined"
    upvotes: v.number(),
    upvoterIds: v.array(v.string()), // Track who voted (prevent double voting)
    authorName: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_upvotes", ["upvotes"])
    .index("by_status", ["status"]),

  /**
   * Player Rating History - tracks within-game rating changes over time
   * Uses delta-based tracking to save storage (only stores what changed)
   */
  playerRatingHistory: defineTable({
    playerId: v.id("players"),
    scrapeJobId: v.optional(v.string()),
    scrapedAt: v.string(), // ISO timestamp
    gameVersion: v.string(), // "2K26"

    // Overall rating change
    previousOverall: v.optional(v.number()),
    newOverall: v.number(),
    overallDelta: v.optional(v.number()), // +3, -2, etc.

    // Changed attributes only (sparse - saves storage)
    attributeChanges: v.optional(
      v.record(
        v.string(),
        v.object({
          prev: v.number(),
          new: v.number(),
        })
      )
    ),

    // Badge changes
    badgeChanges: v.optional(
      v.object({
        added: v.optional(v.array(v.object({ name: v.string(), tier: v.string() }))),
        removed: v.optional(v.array(v.object({ name: v.string(), tier: v.string() }))),
        upgraded: v.optional(
          v.array(v.object({ name: v.string(), fromTier: v.string(), toTier: v.string() }))
        ),
        downgraded: v.optional(
          v.array(v.object({ name: v.string(), fromTier: v.string(), toTier: v.string() }))
        ),
      })
    ),

    // Type of history entry
    changeType: v.union(
      v.literal("initial"), // First scrape
      v.literal("update"), // Ratings changed
      v.literal("snapshot") // Periodic full snapshot
    ),

    // Full state for snapshots/initial entries
    fullAttributes: v.optional(v.record(v.string(), v.number())),
    fullBadges: v.optional(v.any()),
    hotZones: v.optional(v.any()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_playerId_and_scrapedAt", ["playerId", "scrapedAt"])
    .index("by_scrapedAt", ["scrapedAt"])
    .index("by_gameVersion", ["gameVersion"]),

  /**
   * Player Snapshots - full point-in-time snapshots (weekly)
   * Used for efficient historical reconstruction
   */
  playerSnapshots: defineTable({
    playerId: v.id("players"),
    snapshotDate: v.string(), // YYYY-MM-DD
    gameVersion: v.string(),
    overall: v.number(),
    attributes: v.record(v.string(), v.number()),
    badges: v.optional(v.any()),
    hotZones: v.optional(v.any()),
    createdAt: v.string(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_playerId_and_snapshotDate", ["playerId", "snapshotDate"])
    .index("by_snapshotDate", ["snapshotDate"]),

  /**
   * Badges - normalized badge reference table
   * One entry per unique badge (not duplicated per player)
   */
  badges: defineTable({
    name: v.string(),
    slug: v.string(), // URL-friendly name
    category: v.string(), // "Playmaking", "Outside Scoring", etc.
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()), // External URL from 2kratings.com
    gameVersion: v.optional(v.string()), // Badges change between 2K versions
    lastUpdated: v.string(),
    createdAt: v.string(),
  })
    .index("by_name", ["name"])
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_gameVersion", ["gameVersion"]),

  /**
   * Player Badges - junction table linking players to badges
   * Enables efficient queries: "players with badge X" and "badges for player Y"
   */
  playerBadges: defineTable({
    playerId: v.id("players"),
    badgeId: v.id("badges"),
    tier: v.string(), // "Legendary", "Hall of Fame", "Gold", "Silver", "Bronze"
  })
    .index("by_playerId", ["playerId"])
    .index("by_badgeId", ["badgeId"])
    .index("by_playerId_and_badgeId", ["playerId", "badgeId"]),

  /**
   * Registration Attempts - rate limiting for API key registration
   * Database-backed to work correctly across serverless instances
   */
  registrationAttempts: defineTable({
    ip: v.string(), // Client IP address
    count: v.number(), // Number of attempts in current window
    windowStart: v.number(), // Unix timestamp (ms) when window started
  })
    .index("by_ip", ["ip"]),

  /**
   * Public API Rate Limits - per-IP rate limiting for unauthenticated /api/public/* routes
   * Window: 60 seconds. Limit set in convex/apiKeys.ts (checkPublicApiRateLimit).
   */
  publicApiRateLimits: defineTable({
    ip: v.string(), // Client IP address
    count: v.number(), // Number of requests in current window
    windowStart: v.number(), // Unix timestamp (ms) when window started
  })
    .index("by_ip", ["ip"]),

  /**
   * Site stats (pageview analytics for the marketing/app site).
   * Cumulative counters keyed by "total" | "path:<p>" | "day:<YYYY-MM-DD>" | "uvday:<YYYY-MM-DD>".
   */
  pageviewCounters: defineTable({
    key: v.string(),
    count: v.number(),
  }).index("by_key", ["key"]),

  // Per-day unique-visitor dedup rows (pruned > 120 days by cron).
  pageviewVisits: defineTable({
    date: v.string(),
    visitorId: v.string(),
  }).index("by_date_and_visitor", ["date", "visitorId"]),
});
