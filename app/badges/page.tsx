import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";

export const metadata: Metadata = {
  title: "NBA 2K27 Badges — Complete Badge List & Player Counts",
  description: "Browse every NBA 2K27 badge by category, see what each badge does, its tier distribution, and which players have it.",
  alternates: { canonical: "/badges" },
};

export default async function BadgesPage() {
  const badges = await fetchQuery(api.badges.getBadgeDirectory, {});
  const groups = new Map<string, typeof badges>();
  for (const badge of badges) groups.set(badge.category, [...(groups.get(badge.category) ?? []), badge]);

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav width="wide" />
      <main className="mx-auto max-w-[1440px] px-[clamp(20px,4vw,48px)] pb-14">
        <header className="grid items-end gap-5 border-b border-[#d9d4c7] pb-7 md:grid-cols-[1fr_420px]">
          <div><p className="mb-3 font-plex text-[10px] tracking-[.14em] text-[#8a8577]">THE BADGE ALMANAC · {badges.length} BADGES</p><h1 className="font-display text-[clamp(46px,7vw,88px)] leading-[.82] font-bold tracking-[-.065em]">Every badge.<br />Who has it.</h1></div>
          <p className="m-0 text-[15px] leading-[1.65] text-[#57534a]">A complete reference for NBA 2K27 badges, organized by what they change on the floor. Open any badge for its description, tier distribution, strongest examples, and a live player query.</p>
        </header>

        {[...groups.entries()].map(([category, items], groupIndex) => (
          <section key={category} className="border-b border-[#d9d4c7] py-7">
            <div className="mb-4 flex items-baseline justify-between"><h2 className="font-display text-[28px] font-bold tracking-[-.03em]">{category}</h2><span className="font-plex text-[9px] text-[#8a8577]">{String(groupIndex + 1).padStart(2, "0")} · {items.length} BADGES</span></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((badge) => (
                <Link key={badge.slug} href={`/badges/${badge.slug}`} className="group flex min-h-[116px] flex-col rounded-[13px] border border-[#e5e2da] bg-white p-4 text-[#1a1918] no-underline transition-[border-color,transform] duration-150 hover:-translate-y-0.5 hover:border-[#1a1918]">
                  <div className="flex items-start gap-3">
                    {badge.imageUrl ? <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[9px] bg-[#f1efe8]"><Image src={badge.imageUrl} alt="" fill sizes="40px" className="object-contain" /></div> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] bg-[#1a1918] font-display text-[13px] font-bold text-white">{badge.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>}
                    <div className="min-w-0"><h3 className="m-0 text-[14px] font-bold">{badge.name}</h3><p className="mt-1 line-clamp-2 text-[10.5px] leading-[1.45] text-[#8a8577]">{badge.description ?? "Badge description unavailable."}</p></div>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3 font-plex text-[8px] text-[#8a8577]"><span>{badge.playerCount} PLAYERS</span><span className="transition-transform group-hover:translate-x-0.5">OPEN →</span></div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
      <FooterStrip width="wide" />
    </div>
  );
}
