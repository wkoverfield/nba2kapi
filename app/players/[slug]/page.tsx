import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { preloadQuery, preloadedQueryResult } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { gameLabel, safeJsonLd, SITE_URL } from "@/lib/seo";
import { PlayerDossierClient } from "./player-dossier-client";

// Canonical player pages are statically cached (full route cache) and
// invalidated on demand via POST /api/revalidate after each scrape. The
// 30-day revalidate is a backstop only. Era/team query variants (?type=,
// ?team=) are resolved client-side so they never force dynamic rendering.
export const revalidate = 2592000;

// No paths at build time: every slug renders on first request, then is
// cached. Unknown slugs still 404 via notFound() below.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

// One dossier fetch per render, shared by generateMetadata and the page body.
const preloadDossier = cache((slug: string) =>
  preloadQuery(api.dossier.getDossier, { slug })
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dossier = preloadedQueryResult(await preloadDossier(slug));
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
  const { slug } = await props.params;
  const preloadedDossier = await preloadDossier(slug);
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
