/**
 * Admin Stats
 * One query that returns everything you'd want to know about API usage at a
 * glance: API key counts, request volume across rolling windows, top endpoints,
 * top users, public-endpoint IP traffic, and DB size. Gated by X-Admin-Key in
 * the HTTP layer; this file just exposes the raw Convex query.
 */

import { query } from "./_generated/server";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff1m = new Date(now - 60 * 1000).toISOString();
    const cutoff24h = new Date(now - MS_PER_DAY).toISOString();
    const cutoff7d = new Date(now - 7 * MS_PER_DAY).toISOString();
    const cutoff30d = new Date(now - 30 * MS_PER_DAY).toISOString();

    // -------- API keys --------
    const allKeys = await ctx.db.query("apiKeys").collect();
    const keysById = new Map(allKeys.map((k) => [k._id, k]));
    const apiKeys = {
      total: allKeys.length,
      active: allKeys.filter((k) => k.isActive).length,
      last24h: allKeys.filter((k) => k.createdAt >= cutoff24h).length,
      last7d: allKeys.filter((k) => k.createdAt >= cutoff7d).length,
      last30d: allKeys.filter((k) => k.createdAt >= cutoff30d).length,
    };

    // -------- Authenticated requests (requestLogs) --------
    // Range scan on the `by_timestamp` index — pull the last 30 days only.
    // At current volume (~600 req/month) this is trivial; at 100k+/month it's
    // still fine as a single query.
    const logs30d = await ctx.db
      .query("requestLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff30d))
      .collect();

    const logs7d = logs30d.filter((l) => l.timestamp >= cutoff7d);
    const logs24h = logs30d.filter((l) => l.timestamp >= cutoff24h);
    const logs1m = logs30d.filter((l) => l.timestamp >= cutoff1m);

    // Lifetime total = sum of per-key counters (cheaper than count() on full table)
    const lifetimeRequests = allKeys.reduce((sum, k) => sum + (k.requestCount || 0), 0);

    const avgResponseTimeMs24h =
      logs24h.length > 0
        ? Math.round(
            logs24h.reduce((sum, l) => sum + (l.responseTime || 0), 0) / logs24h.length,
          )
        : 0;

    // Top endpoints (last 7d)
    const endpointCounts = new Map<string, number>();
    for (const log of logs7d) {
      endpointCounts.set(log.endpoint, (endpointCounts.get(log.endpoint) || 0) + 1);
    }
    const topEndpoints7d = Array.from(endpointCounts.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top API keys by request count (last 7d) — anonymized to email + name
    const keyRequestCounts = new Map<string, number>();
    for (const log of logs7d) {
      const id = log.apiKeyId as unknown as string;
      keyRequestCounts.set(id, (keyRequestCounts.get(id) || 0) + 1);
    }
    const topApiKeys7d = Array.from(keyRequestCounts.entries())
      .map(([id, count]) => {
        const key = keysById.get(id as any);
        return {
          email: key?.email ?? "unknown",
          name: key?.name ?? "unknown",
          count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Status code distribution (last 7d) — quick health signal
    const statusCounts: Record<string, number> = {};
    for (const log of logs7d) {
      const bucket = `${Math.floor(log.statusCode / 100)}xx`;
      statusCounts[bucket] = (statusCounts[bucket] || 0) + 1;
    }

    // -------- Public API (no-auth) — IP rate-limit table --------
    // Only rows within the last 60s window are still "live" rate-limit state;
    // older rows are stale but kept around until next request from the IP.
    const publicLimits = await ctx.db.query("publicApiRateLimits").collect();
    const livePublic = publicLimits.filter((r) => r.windowStart >= now - 60 * 1000);
    const publicApi = {
      activeIpsLast1m: livePublic.length,
      requestsLast1m: livePublic.reduce((sum, r) => sum + r.count, 0),
      totalIpsTracked: publicLimits.length, // includes stale rows
    };

    // -------- Database --------
    // Player count via the by_overall index → small, cheap; lastUpdated comes
    // from the most recent player row.
    const allPlayersMeta = await ctx.db
      .query("players")
      .withIndex("by_overall")
      .order("desc")
      .collect();
    const lastScrapeAt = allPlayersMeta
      .map((p) => p.lastUpdated)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      generatedAt: new Date(now).toISOString(),
      apiKeys,
      authenticatedRequests: {
        lifetime: lifetimeRequests,
        last30d: logs30d.length,
        last7d: logs7d.length,
        last24h: logs24h.length,
        last1m: logs1m.length,
        avgResponseTimeMs24h,
        statusCounts7d: statusCounts,
        topEndpoints7d,
        topApiKeys7d,
      },
      publicApi,
      database: {
        totalPlayers: allPlayersMeta.length,
        lastScrapeAt,
      },
    };
  },
});
