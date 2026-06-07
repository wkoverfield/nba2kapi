import { mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;
const dstr = (ms: number) => new Date(ms).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

function sanitizePath(raw: string): string | null {
  let p = (raw || "").split("?")[0].split("#")[0].trim();
  if (!p.startsWith("/")) return null;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (p.length > 120) p = p.slice(0, 120);
  return p;
}

/**
 * Public: record a pageview for the marketing/app site. Fire-and-forget.
 * (The API itself is metered separately via apiKeys.requestCount.)
 */
export const recordPageview = mutation({
  args: { path: v.string(), visitorId: v.string() },
  handler: async (ctx, { path, visitorId }) => {
    const p = sanitizePath(path);
    if (!p) return;
    const vId = (visitorId || "anon").slice(0, 64);
    const date = dstr(Date.now());

    const bump = async (key: string) => {
      const existing = await ctx.db
        .query("pageviewCounters")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (existing) await ctx.db.patch(existing._id, { count: existing.count + 1 });
      else await ctx.db.insert("pageviewCounters", { key, count: 1 });
    };

    await bump("total");
    await bump(`path:${p}`);
    await bump(`day:${date}`);

    const seen = await ctx.db
      .query("pageviewVisits")
      .withIndex("by_date_and_visitor", (q) => q.eq("date", date).eq("visitorId", vId))
      .first();
    if (!seen) {
      await ctx.db.insert("pageviewVisits", { date, visitorId: vId });
      await bump(`uvday:${date}`);
    }
  },
});

/**
 * Internal: one-call dashboard of site traffic + API usage + feedback.
 * Run via `npx convex run siteStats:getDashboard --prod`.
 */
export const getDashboard = internalQuery({
  args: {},
  handler: async (ctx) => {
    const counters = await ctx.db.query("pageviewCounters").collect();
    const map: Record<string, number> = {};
    for (const c of counters) map[c.key] = c.count;

    const days: { date: string; views: number; uniques: number }[] = [];
    for (const c of counters) {
      if (c.key.startsWith("day:")) {
        const date = c.key.slice(4);
        days.push({ date, views: c.count, uniques: map[`uvday:${date}`] ?? 0 });
      }
    }
    days.sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first

    const now = Date.now();
    const cutoff7 = dstr(now - 7 * DAY_MS);
    const cutoff30 = dstr(now - 30 * DAY_MS);
    const sum = (cutoff: string, field: "views" | "uniques") =>
      days.filter((d) => d.date >= cutoff).reduce((s, d) => s + d[field], 0);

    const topPages = counters
      .filter((c) => c.key.startsWith("path:"))
      .map((c) => ({ path: c.key.slice(5), views: c.count }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    // Actions for nba2kapi = API usage (cumulative requestCount on apiKeys).
    const keys = await ctx.db.query("apiKeys").collect();
    const actions = {
      apiKeys: keys.length,
      activeApiKeys: keys.filter((k) => k.isActive).length,
      apiRequests: keys.reduce((s, k) => s + (k.requestCount || 0), 0),
    };

    const feedback = await ctx.db.query("feedback").collect();
    const byStatus: Record<string, number> = {};
    for (const f of feedback) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    const recent = feedback
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8)
      .map((f) => ({
        title: f.title,
        type: f.type,
        status: f.status,
        upvotes: f.upvotes,
        createdAt: f.createdAt,
      }));

    return {
      pageviews: {
        total: map["total"] ?? 0,
        last7: sum(cutoff7, "views"),
        last30: sum(cutoff30, "views"),
        byDay: days.slice(0, 30),
      },
      uniques: { last7: sum(cutoff7, "uniques"), last30: sum(cutoff30, "uniques") },
      topPages,
      actions,
      feedback: { total: feedback.length, byStatus, recent },
    };
  },
});

/** Internal: prune the per-day unique-visitor dedup rows older than 120 days (cron). */
export const pruneVisits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = dstr(Date.now() - 120 * DAY_MS);
    const old = await ctx.db
      .query("pageviewVisits")
      .withIndex("by_date_and_visitor", (q) => q.lt("date", cutoff))
      .take(4000);
    let deleted = 0;
    for (const row of old) {
      await ctx.db.delete(row._id);
      deleted++;
    }
    return { deleted, more: old.length === 4000 };
  },
});
