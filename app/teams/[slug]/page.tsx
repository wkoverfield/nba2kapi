import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchQuery, preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { ERA_LABELS, gameLabel, safeJsonLd, SITE_URL, teamCanonical } from "@/lib/seo";
import { TeamDetailClient } from "./team-detail-client";

type TeamType = "curr" | "class" | "allt";
type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
};

function parseTeamType(value?: string): TeamType {
  return value === "class" || value === "allt" ? value : "curr";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const era = parseTeamType(search.type);
  const team = await fetchQuery(api.teams.getTeamBySlug, { slug, teamType: era });
  if (!team) return { title: "Team not found", robots: { index: false, follow: false } };

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

export default async function TeamPage({ params, searchParams }: PageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const era = parseTeamType(search.type);
  const team = await fetchQuery(api.teams.getTeamBySlug, { slug, teamType: era });
  if (!team) notFound();

  const [preloadedTeam, preloadedRoster, preloadedBoard] = await Promise.all([
    preloadQuery(api.teams.getTeamBySlug, { slug, teamType: era }),
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
