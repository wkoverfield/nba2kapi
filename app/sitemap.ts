import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { SITE_URL, teamCanonical } from "@/lib/seo";

const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}> = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/playground", changeFrequency: "weekly", priority: 0.9 },
  { path: "/teams", changeFrequency: "weekly", priority: 0.9 },
  { path: "/lineups", changeFrequency: "monthly", priority: 0.8 },
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  ];
}
