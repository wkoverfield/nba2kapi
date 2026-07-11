import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gameLabel, safeJsonLd, SITE_URL } from "@/lib/seo";
import { PlayerDossierClient } from "./player-dossier-client";

type TeamType = "curr" | "class" | "allt";
type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; team?: string }>;
};

function teamType(value?: string): TeamType | undefined {
  return value === "curr" || value === "class" || value === "allt" ? value : undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const preloaded = await preloadQuery(api.dossier.getDossier, {
    slug,
    teamType: teamType(search.type),
    team: search.team,
  });
  const dossier = preloadedQueryResult(preloaded);
  if (!dossier) return { title: "Player not found", robots: { index: false, follow: false } };

  const p = dossier.player;
  const game = gameLabel();
  const position = p.positions.join("/") || "player";
  const title = `${p.name} ${game} Rating, Attributes & Badges`;
  const description = `${p.name} is a ${p.overall} overall ${position} for ${p.team} in ${game}. Explore every attribute, badge, percentile, build profile, rating history, and similar players.`;
  const canonical = `/players/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "profile", url: canonical, title, description, images: p.playerImage ? [{ url: p.playerImage, alt: p.name }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: p.playerImage ? [p.playerImage] : undefined },
  };
}

export default async function PlayerPage(props: PageProps) {
  const [{ slug }, search] = await Promise.all([props.params, props.searchParams]);
  const preloadedDossier = await preloadQuery(api.dossier.getDossier, {
    slug,
    teamType: teamType(search.type),
    team: search.team,
  });
  const dossier = preloadedQueryResult(preloadedDossier);
  if (!dossier) notFound();

  const player = dossier.player;
  const canonical = `${SITE_URL}/players/${slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": canonical,
        url: canonical,
        name: `${player.name} ${gameLabel()} ratings profile`,
        mainEntity: {
          "@type": "Person",
          name: player.name,
          image: player.playerImage || undefined,
          description: `${player.overall} overall ${player.positions.join("/")} for ${player.team}`,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "NBA 2K API", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Players", item: `${SITE_URL}/playground` },
          { "@type": "ListItem", position: 3, name: player.name, item: canonical },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <PlayerDossierClient preloadedDossier={preloadedDossier} />
    </>
  );
}
