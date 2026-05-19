/**
 * Application constants
 *
 * IMPORTANT: Convex uses TWO different domains:
 * - .convex.cloud = ConvexClient for realtime queries/mutations
 * - .convex.site  = HTTP Actions for REST API endpoints
 */

/**
 * Helper to get required env var with clear error message
 */
function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please set it in your .env.local file. See .env.example for reference.`
    );
  }
  return value;
}

/**
 * CONVEX_URL - For ConvexClient (realtime subscriptions, queries, mutations)
 * Used by: ConvexProvider, ConvexHttpClient in scripts
 */
export const CONVEX_URL = getEnvVar(
  "NEXT_PUBLIC_CONVEX_URL",
  // Fallback for build time - actual value comes from env at runtime
  process.env.NODE_ENV === "production" ? undefined : "https://polished-bee-946.convex.cloud"
);

/**
 * CONVEX_SITE_URL - For HTTP Actions (REST API endpoints)
 * Used by: fetch() calls to /api/players, /api/register, etc.
 */
export const CONVEX_SITE_URL = getEnvVar(
  "NEXT_PUBLIC_CONVEX_SITE_URL",
  // Fallback for build time - actual value comes from env at runtime
  process.env.NODE_ENV === "production" ? undefined : "https://polished-bee-946.convex.site"
);

/**
 * API_BASE_URL - Full base URL for REST API endpoints
 * Points to the .convex.site domain where HTTP actions are served
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || `${CONVEX_SITE_URL}/api`;

export const API_KEY_STORAGE_KEY = "nba2k_api_key";
