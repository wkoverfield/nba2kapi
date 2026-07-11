import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses } from "@/lib/rating-colors";
import { SITE_URL, safeJsonLd } from "@/lib/seo";
import { cn } from "@/lib/utils";

const TIER_ORDER = ["Legendary", "Hall of Fame", "Gold", "Silver", "Bronze"];
const TIER_CLASS: Record<string, string> = { Legendary: "overall-dark-matter", "Hall of Fame": "overall-amethyst", Gold: "overall-gold", Silver: "overall-silver", Bronze: "bg-[#9a6234]" };
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const detail = await fetchQuery(api.badges.getBadgeDetail, { slug });
  if (!detail) return { title: "Badge not found", robots: { index: false, follow: false } };
  const title = `${detail.badge.name} Badge — NBA 2K27 Players & Tiers`;
  const description = `${detail.badge.description ?? `Explore the ${detail.badge.name} badge in NBA 2K27.`} See ${detail.playerCount} players with the badge, broken down by tier.`;
  return { title, description, alternates: { canonical: `/badges/${slug}` }, openGraph: { title, description, url: `/badges/${slug}` } };
}

export default async function BadgeDetailPage({ params }: Props) {
  const { slug } = await params;
  const detail = await fetchQuery(api.badges.getBadgeDetail, { slug });
  if (!detail) notFound();
  const { badge, players, tierCounts } = detail;
  const canonical = `${SITE_URL}/badges/${slug}`;
  const jsonLd = { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", "@id": canonical, name: `${badge.name} NBA 2K27 badge`, description: badge.description ?? undefined }, { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "NBA 2K API", item: SITE_URL }, { "@type": "ListItem", position: 2, name: "Badges", item: `${SITE_URL}/badges` }, { "@type": "ListItem", position: 3, name: badge.name, item: canonical }] }] };

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <TopNav width="wide" />
      <main className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,48px)] pb-14">
        <Link href="/badges" className="font-plex text-[9px] tracking-[.1em] text-[#8a8577] no-underline">← ALL BADGES</Link>
        <header className="mt-4 grid overflow-hidden rounded-[18px] border border-[#d9d4c7] bg-white md:grid-cols-[260px_1fr]">
          <div className="flex min-h-[260px] items-center justify-center bg-[#1a1918] p-10">{badge.imageUrl ? <div className="relative h-40 w-40"><Image src={badge.imageUrl} alt={badge.name} fill sizes="160px" className="object-contain" /></div> : <span className="font-display text-[72px] font-bold text-white">{badge.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>}</div>
          <div className="flex flex-col justify-center p-[clamp(24px,5vw,56px)]"><p className="mb-3 font-plex text-[9px] tracking-[.13em] text-[#8a8577]">{badge.category.toUpperCase()} BADGE · NBA 2K27</p><h1 className="font-display text-[clamp(42px,6vw,76px)] leading-[.88] font-bold tracking-[-.055em]">{badge.name}</h1><p className="mt-5 max-w-[760px] text-[16px] leading-[1.65] text-[#57534a]">{badge.description ?? "Detailed gameplay description is not available from the current source."}</p><div className="mt-5 flex flex-wrap gap-2">{TIER_ORDER.filter((tier) => tierCounts[tier]).map((tier) => <Link key={tier} href={`/playground?era=all&badge=${slug}&badgeTier=${encodeURIComponent(tier)}&sort=overall:desc`} className={cn("rounded-full px-3 py-1.5 font-plex text-[8.5px] font-bold text-white no-underline", TIER_CLASS[tier])}>{tier.toUpperCase()} · {tierCounts[tier]}</Link>)}</div></div>
        </header>

        <section className="mt-3 overflow-hidden rounded-[16px] border border-[#e5e2da] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e2da] px-5 py-4"><div><p className="m-0 font-plex text-[9.5px] tracking-[.12em] text-[#8a8577]">WHO HAS IT</p><h2 className="mt-1 font-display text-[26px] font-bold">Top-rated examples</h2></div><Link href={`/playground?era=all&badge=${slug}&sort=overall:desc`} className="rounded-full bg-[#1a1918] px-4 py-2 text-[12px] font-semibold text-white no-underline">See all {detail.playerCount} in Playground →</Link></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {players.slice(0, 18).map((player) => <Link key={`${player.slug}:${player.team}:${player.tier}`} href={`/players/${player.slug}?type=${player.teamType}&team=${encodeURIComponent(player.team)}`} className="flex items-center gap-3 border-b border-r border-[#f1efe8] px-4 py-3 text-[#1a1918] no-underline hover:bg-[#faf9f5]"><Headshot src={player.playerImage} name={player.name} size={40} /><span className="min-w-0 flex-1"><b className="block truncate text-[13px]">{player.name}</b><span className="block truncate font-plex text-[8px] text-[#8a8577]">{player.positions.join("/")} · {player.team}</span></span><span className={cn("rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold text-white", getRatingClasses(player.overall).bg)}>{player.overall}</span><span className={cn("rounded px-1.5 py-0.5 font-plex text-[7px] text-white", TIER_CLASS[player.tier] ?? "bg-[#57534a]")}>{player.tier === "Hall of Fame" ? "HOF" : player.tier.toUpperCase()}</span></Link>)}
          </div>
        </section>
      </main>
      <FooterStrip width="wide" />
    </div>
  );
}
