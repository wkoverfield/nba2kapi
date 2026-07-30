import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ERA_LABELS, gameLabel, safeJsonLd, SITE_URL, teamCanonical } from "@/lib/seo";
import { TeamDetailClient } from "./team-detail-client";

// Canonical team pages are statically cached (full route cache) and
// invalidated on demand via POST /api/revalidate after each scrape. The
// 30-day revalidate is a backstop only. ?type= era variants are resolved
// client-side so they never force dynamic rendering.
export const revalidate = 2592000;

// No paths at build time: every slug renders on first request, then is
// cached. Unknown slugs still 404 via notFound() below.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type TeamType = "curr" | "class" | "allt";
type PageProps = {
  params: Promise<{ slug: string }>;
};

const ERAS: TeamType[] = ["curr", "class", "allt"];

// Team slugs embed their era (classic slugs carry a season prefix, all-time
// slugs an "all-time-" prefix), so a slug maps to exactly one era. Probe eras
// in canonical order and keep the first hit. Cached so generateMetadata and
// the page body share one lookup per render.
const preloadTeam = cache(async (slug: string) => {
  for (const era of ERAS) {
    const preloaded = await preloadQuery(api.teams.getTeamBySlug, { slug, teamType: era });
    if (preloadedQueryResult(preloaded) !== null) return preloaded;
  }
  return null;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const preloadedTeam = await preloadTeam(slug);
  const team = preloadedTeam ? preloadedQueryResult(preloadedTeam) : null;
  if (!team) return { title: "Team not found", robots: { index: false, follow: false } };

  const era = team.teamType;
  const game = gameLabel();
  const eraLabel = ERA_LABELS[era];
  const title = `${team.name} ${game} Roster, Ratings & Depth Chart`;
  const description = `Explore the ${eraLabel.toLowerCase()} ${team.name} roster in ${game}: player ratings, attributes, depth chart, team strengths, shooting, defense, and API data.`;
  const canonical = teamCanonical(slug, era);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", url: canonical, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function TeamPage({ params }: PageProps) {
  const { slug } = await params;
  const preloadedTeam = await preloadTeam(slug);
  const team = preloadedTeam ? preloadedQueryResult(preloadedTeam) : null;
  if (!preloadedTeam || !team) notFound();

  const era = team.teamType;
  const [preloadedRoster, preloadedBoard] = await Promise.all([
    preloadQuery(api.players.getPlayersByTeam, { team: team.name, teamType: era }),
    preloadQuery(api.teams.getBoard, { teamType: era }),
  ]);
  const roster = preloadedQueryResult(preloadedRoster);
  const canonical = `${SITE_URL}${teamCanonical(slug, era)}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsTeam",
        "@id": canonical,
        name: team.name,
        sport: "Basketball",
        member: roster.slice(0, 15).map((player: { name: string; slug: string }) => ({
          "@type": "OrganizationRole",
          member: { "@type": "Person", name: player.name, url: `${SITE_URL}/players/${player.slug}` },
          roleName: "Player",
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "NBA 2K API", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Teams", item: `${SITE_URL}/teams` },
          { "@type": "ListItem", position: 3, name: team.name, item: canonical },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <TeamDetailClient
        preloadedTeam={preloadedTeam}
        preloadedRoster={preloadedRoster}
        preloadedBoard={preloadedBoard}
      />
    </>
  );
}
