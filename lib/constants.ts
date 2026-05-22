/**
 * Application constants
 *
 * IMPORTANT: Convex uses TWO different domains:
 * - .convex.cloud = ConvexClient for realtime queries/mutations
 * - .convex.site  = HTTP Actions for REST API endpoints
 *
 * NOTE: Must use literal process.env.NEXT_PUBLIC_X access for Next.js
 * build-time replacement to work. Dynamic access like process.env[name]
 * doesn't get inlined and fails client-side.
 */

/**
 * CONVEX_URL - For ConvexClient (realtime subscriptions, queries, mutations)
 * Used by: ConvexProvider, ConvexHttpClient in scripts
 */
export const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://canny-kingfisher-472.convex.cloud";

/**
 * CONVEX_SITE_URL - For HTTP Actions (REST API endpoints)
 * Used by: fetch() calls to /api/players, /api/register, etc.
 */
export const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "https://canny-kingfisher-472.convex.site";

/**
 * API_BASE_URL - Full base URL for REST API endpoints
 * Points to the .convex.site domain where HTTP actions are served
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || `${CONVEX_SITE_URL}/api`;

export const API_KEY_STORAGE_KEY = "nba2k_api_key";
