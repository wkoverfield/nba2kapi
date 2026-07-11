"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses } from "@/lib/rating-colors";
import { cn } from "@/lib/utils";

type DirectoryBadge = {
  name: string;
  slug: string;
  category: string;
  description: string | null;
  imageUrl: string | null;
  playerCount: number;
  tierCounts: Record<string, number>;
};

const TIERS = ["Legendary", "Hall of Fame", "Gold", "Silver", "Bronze"];
const TIER_STYLE: Record<string, { dot: string; active: string }> = {
  Legendary: { dot: "overall-dark-matter", active: "border-[#1a1918] bg-[#f3eaf2]" },
  "Hall of Fame": { dot: "overall-amethyst", active: "border-[#7620a8] bg-[#f6ebfb]" },
  Gold: { dot: "overall-gold", active: "border-[#a38829] bg-[#fbf5df]" },
  Silver: { dot: "overall-silver", active: "border-[#777] bg-[#f1f1f1]" },
  Bronze: { dot: "bg-[#9a6234]", active: "border-[#8a542a] bg-[#f8eee5]" },
};

function initialTier(badge?: DirectoryBadge) {
  return TIERS.find((tier) => (badge?.tierCounts[tier] ?? 0) > 0) ?? "Gold";
}

export function BadgeExplorerClient({ badges }: { badges: DirectoryBadge[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const initialSlug = sp.get("badge");
  const [selectedSlug, setSelectedSlug] = useState(
    initialSlug && badges.some((badge) => badge.slug === initialSlug) ? initialSlug : (badges.find((badge) => badge.slug === "deadeye")?.slug ?? badges[0]?.slug ?? "")
  );
  const selectedBadge = badges.find((badge) => badge.slug === selectedSlug);
  const tierParam = sp.get("tier");
  const [tier, setTier] = useState(
    tierParam && TIERS.includes(tierParam) ? tierParam : initialTier(selectedBadge)
  );
  const [search, setSearch] = useState("");
  const detail = useQuery(api.badges.getBadgeDetail, selectedSlug ? { slug: selectedSlug } : "skip");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSlug) params.set("badge", selectedSlug);
    if (tier) params.set("tier", tier);
    router.replace(`/badges?${params.toString()}`, { scroll: false });
  }, [selectedSlug, tier, router]);

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const map = new Map<string, DirectoryBadge[]>();
    for (const badge of badges) {
      if (needle && !badge.name.toLowerCase().includes(needle) && !badge.category.toLowerCase().includes(needle)) continue;
      map.set(badge.category, [...(map.get(badge.category) ?? []), badge]);
    }
    return [...map.entries()];
  }, [badges, search]);

  const holders = (detail?.players ?? []).filter((player) => player.tier === tier);
  const selectBadge = (badge: DirectoryBadge) => {
    setSelectedSlug(badge.slug);
    setTier(initialTier(badge));
  };

  return (
    <>
      <header>
        <h1 className="font-display text-[clamp(34px,4vw,48px)] font-bold tracking-[-.04em]">Badges</h1>
        <p className="mt-1 font-plex text-[9px] tracking-[.12em] text-[#8a8577]">
          {badges.length} BADGES · PICK A BADGE, THEN A TIER TO SEE WHO HOLDS IT THERE
        </p>
      </header>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(320px,1fr)_minmax(460px,1fr)]">
        <section className="space-y-4">
          <label className="flex items-center gap-2 rounded-full border border-[#e5e2da] bg-white px-4 py-2.5">
            <Search className="h-3.5 w-3.5 text-[#8a8577]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter badges…" className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-[#b5b0a1]" />
          </label>
          {groups.map(([category, items]) => (
            <div key={category}>
              <div className="mb-2 font-plex text-[8.5px] tracking-[.12em] text-[#b5b0a1]">{category.toUpperCase()} · {items.length}</div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((badge) => {
                  const topTier = initialTier(badge);
                  return (
                    <button key={badge.slug} type="button" onClick={() => selectBadge(badge)} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-[border-color,transform] active:scale-[.97]", selectedSlug === badge.slug ? TIER_STYLE[topTier]?.active : "border-[#e5e2da] bg-white hover:border-[#1a1918]") }>
                      {badge.imageUrl ? (
                        <span className="relative h-[18px] w-[18px] shrink-0">
                          <Image src={badge.imageUrl} alt="" fill sizes="18px" className="object-contain" />
                        </span>
                      ) : (
                        <span className={cn("h-2.5 w-2.5 rounded-[3px]", TIER_STYLE[topTier]?.dot ?? "bg-[#57534a]")} />
                      )}
                      {badge.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="sticky top-4 overflow-hidden rounded-[18px] border border-[#e5e2da] bg-white">
          <div className="bg-[#faf8f1] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[13px] font-display text-[18px] font-bold text-white shadow-[0_8px_18px_-9px_rgba(26,25,24,.6)]", selectedBadge?.imageUrl ? "bg-[#1a1918]" : (TIER_STYLE[tier]?.dot ?? "bg-[#1a1918]"))}>
                  {selectedBadge?.imageUrl ? <Image src={selectedBadge.imageUrl} alt={`${selectedBadge.name} badge`} fill sizes="64px" className="object-contain p-1.5" /> : selectedBadge?.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                </div>
                <div><p className="font-plex text-[8px] tracking-[.12em] text-[#8a8577]">{selectedBadge?.category.toUpperCase()}</p><h2 className="font-display text-[28px] font-bold tracking-[-.03em]">{selectedBadge?.name}</h2></div>
              </div>
              <div className="text-right"><b className="font-display text-[28px]">{selectedBadge?.playerCount ?? 0}</b><p className="font-plex text-[7.5px] text-[#8a8577]">HOLD IT AT ANY TIER</p></div>
            </div>
            <p className="mt-4 max-w-[620px] text-[13.5px] leading-[1.55] text-[#57534a]">{selectedBadge?.description ?? "Badge description unavailable."}</p>
            <div className="mt-4 font-plex text-[8px] tracking-[.12em] text-[#b5b0a1]">HOLDERS BY TIER — PICK ONE</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TIERS.filter((value) => (selectedBadge?.tierCounts[value] ?? 0) > 0).map((value) => (
                <button key={value} type="button" onClick={() => setTier(value)} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2", tier === value ? TIER_STYLE[value]?.active : "border-[#e5e2da] bg-white")}><span className={cn("h-2.5 w-2.5 rounded-[3px]", TIER_STYLE[value]?.dot)} /><span className="font-plex text-[8px] font-bold">{value.toUpperCase()}</span><b className="font-display text-[14px]">{selectedBadge?.tierCounts[value]}</b></button>
              ))}
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="font-plex text-[9px] font-bold tracking-[.1em]">{tier.toUpperCase()} · {holders.length} PLAYERS</span><Link href={`/playground?era=all&badge=${selectedSlug}&badgeTier=${encodeURIComponent(tier)}&sort=overall:desc`} className="border-b border-[#1a1918] font-plex text-[8.5px] text-[#1a1918] no-underline">OPEN THIS TIER IN PLAYGROUND →</Link></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {holders.slice(0, 12).map((player) => (
                <Link key={`${player.slug}:${player.team}:${player.tier}`} href={`/players/${player.slug}?type=${player.teamType}&team=${encodeURIComponent(player.team)}`} className="flex items-center gap-2.5 rounded-[10px] border border-[#efece4] bg-[#faf9f5] px-3 py-2 text-[#1a1918] no-underline hover:border-[#1a1918]"><Headshot src={player.playerImage} name={player.name} size={34} /><span className="min-w-0 flex-1"><b className="block truncate text-[12px]">{player.name}</b><span className="block truncate font-plex text-[7.5px] text-[#8a8577]">{player.positions.join("/")} · {player.team}</span></span><span className={cn("rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold text-white", getRatingClasses(player.overall).bg)}>{player.overall}</span></Link>
              ))}
            </div>
            {holders.length > 12 && <p className="mt-3 font-plex text-[8.5px] text-[#8a8577]">+ {holders.length - 12} MORE IN PLAYGROUND</p>}
            <p className="mt-2 font-plex text-[8px] text-[#b5b0a1]">GET /api/players?badge={selectedSlug}&amp;badgeTier={encodeURIComponent(tier)}</p>
          </div>
        </section>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[14px] border border-[#e5e2da] bg-white px-5 py-3"><span className="rounded-[5px] bg-[#f6e9c8] px-2 py-1 font-plex text-[8px] font-bold text-[#8a6200]">ONE VIEW, THREE PLACES</span><p className="min-w-[220px] flex-1 text-[12.5px] text-[#57534a]">Badge detail, player holders, and the exact Playground filter stay connected in one view.</p><Link href="/playground" className="rounded-full bg-[#1a1918] px-4 py-2 text-[11px] font-semibold text-white no-underline">Filter by badge →</Link></div>
    </>
  );
}
