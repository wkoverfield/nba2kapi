import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SITE_URL, SITEMAP_CACHE_TAG, teamCanonical } from "@/lib/seo";

// Rendered on request and cached by the Vercel CDN under SITEMAP_CACHE_TAG, so
// crawler hits are served from the edge without re-running the Convex entity
// inventory query. POST /api/revalidate invalidates the tag after each scrape;
// the 30-day CDN max-age is a backstop.
//
// Keep this a dynamic route handler. A force-static app/sitemap.ts metadata
// route is prerendered at build, and Vercel serves that build-time copy without
// the implicit `_N_T_/sitemap.xml` tag, so neither revalidatePath nor tag
// invalidation reaches it until the next deployment.
export const dynamic = "force-dynamic";

const CDN_MAX_AGE_SECONDS = 2592000;

type ChangeFrequency = "daily" | "weekly" | "monthly";

type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/playground", changeFrequency: "weekly", priority: 0.9 },
  { path: "/teams", changeFrequency: "weekly", priority: 0.9 },
  { path: "/lineups", changeFrequency: "monthly", priority: 0.8 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.7 },
  { path: "/badges", changeFrequency: "weekly", priority: 0.8 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.9 },
  { path: "/docs/quickstart", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/authentication", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/endpoints/players", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/endpoints/teams", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/endpoints/search", changeFrequency: "monthly", priority: 0.8 },
  { path: "/docs/rate-limits", changeFrequency: "monthly", priority: 0.7 },
  { path: "/docs/errors", changeFrequency: "monthly", priority: 0.7 },
];

function updated(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function sitemapEntries(): Promise<SitemapEntry[]> {
  const entities = await fetchQuery(api.seo.getIndexableEntities, {});

  return [
    ...STATIC_ROUTES.map((route) => ({
      url: `${SITE_URL}${route.path}`,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...entities.players.map((player) => ({
      url: `${SITE_URL}/players/${player.slug}`,
      lastModified: updated(player.lastUpdated),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...entities.teams.map((team) => ({
      url: `${SITE_URL}${teamCanonical(team.slug, team.teamType)}`,
      lastModified: updated(team.lastUpdated),
      changeFrequency: "weekly" as const,
      priority: team.teamType === "curr" ? 0.8 : 0.7,
    })),
    ...entities.badges.map((badge) => ({
      url: `${SITE_URL}/badges/${badge.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

function toXml(entries: SitemapEntry[]) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  for (const entry of entries) {
    xml += "<url>\n";
    xml += `<loc>${escapeXml(entry.url)}</loc>\n`;
    if (entry.lastModified) {
      xml += `<lastmod>${entry.lastModified.toISOString()}</lastmod>\n`;
    }
    xml += `<changefreq>${entry.changeFrequency}</changefreq>\n`;
    xml += `<priority>${entry.priority}</priority>\n`;
    xml += "</url>\n";
  }
  xml += "</urlset>\n";
  return xml;
}

export async function GET() {
  return new Response(toXml(await sitemapEntries()), {
    headers: {
      "Content-Type": "application/xml",
      // Browsers and other shared caches always revalidate; only the Vercel
      // CDN holds the response, keyed to a tag the revalidate route can purge.
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Vercel-CDN-Cache-Control": `max-age=${CDN_MAX_AGE_SECONDS}`,
      "Vercel-Cache-Tag": SITEMAP_CACHE_TAG,
    },
  });
}
