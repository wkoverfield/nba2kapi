"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { ATTRIBUTE_CATEGORIES } from "@/convex/attributeCategories";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getAttributeDisplayName } from "@/lib/attribute-normalizer";
import { getRatingClasses } from "@/lib/rating-colors";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";
type PickerPlayer = {
  name: string;
  slug: string;
  team: string;
  teamType: TeamType;
  positions: string[];
  overall: number;
  playerImage: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  insideScoring: "Inside scoring",
  outsideScoring: "Outside scoring",
  playmaking: "Playmaking",
  athleticism: "Athleticism",
  defending: "Defending",
  rebounding: "Rebounding",
};
const TIER_CLASS: Record<string, string> = {
  Legendary: "overall-dark-matter",
  "Hall of Fame": "overall-amethyst",
  Gold: "overall-gold",
  Silver: "overall-silver",
  Bronze: "bg-[#9a6234]",
};

function parseType(value: string | null): TeamType | undefined {
  return value === "curr" || value === "class" || value === "allt" ? value : undefined;
}

function PlayerPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (player: PickerPlayer) => void;
}) {
  const [search, setSearch] = useState("");
  const [era, setEra] = useState<"all" | TeamType>("all");
  const players = useQuery(api.players.getPlaygroundPlayers, {}) as PickerPlayer[] | undefined;
  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (players ?? [])
      .filter((player) => era === "all" || player.teamType === era)
      .filter((player) => !needle || player.name.toLowerCase().includes(needle) || player.team.toLowerCase().includes(needle))
      .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [players, search, era]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#1a1918]/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[78vh] w-[min(620px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border border-[#d9d4c7] bg-[#faf9f5] shadow-[0_30px_80px_-28px_rgba(26,25,24,.65)] outline-none">
          <div className="flex items-center justify-between border-b border-[#e5e2da] px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-[22px] font-bold tracking-[-.02em]">Choose the matchup</Dialog.Title>
              <Dialog.Description className="font-plex text-[9px] tracking-[.1em] text-[#8a8577]">SEARCH ANY CURRENT, CLASSIC OR ALL-TIME PLAYER</Dialog.Description>
            </div>
            <Dialog.Close className="cursor-pointer rounded-full border border-[#e5e2da] bg-white p-2"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <div className="border-b border-[#e5e2da] p-4">
            <label className="flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-white px-4 py-2.5">
              <Search className="h-4 w-4 text-[#8a8577]" />
              <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search player or team…" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#b5b0a1]" />
            </label>
            <div className="mt-2.5 flex gap-1.5">
              {(["all", "curr", "class", "allt"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setEra(value)} className={cn("cursor-pointer rounded-full border px-3 py-1 font-plex text-[9px] font-bold", era === value ? "border-[#1a1918] bg-[#1a1918] text-white" : "border-[#e5e2da] bg-white text-[#57534a]")}>{value === "all" ? "ALL ERAS" : value === "curr" ? "CURRENT" : value === "class" ? "CLASSIC" : "ALL-TIME"}</button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto p-2">
            {results.map((player) => (
              <button key={`${player.slug}:${player.teamType}:${player.team}`} type="button" onClick={() => { onPick(player); onOpenChange(false); }} className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-left hover:bg-white">
                <Headshot src={player.playerImage} name={player.name} size={38} />
                <span className="min-w-0 flex-1"><b className="block truncate text-[14px]">{player.name}</b><span className="block truncate font-plex text-[8.5px] text-[#8a8577]">{player.positions.join("/")} · {player.team} · {player.teamType.toUpperCase()}</span></span>
                <span className={cn("rounded-[6px] px-2 py-1 text-[13px] font-bold text-white", getRatingClasses(player.overall).bg)}>{player.overall}</span>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PlayerRail({ dossier, side, onChoose }: { dossier: ReturnType<typeof useQuery<typeof api.dossier.getDossier>>; side: "left" | "right"; onChoose: () => void }) {
  if (!dossier) return <button type="button" onClick={onChoose} className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-[#d9d4c7] bg-white/55 text-center"><span className="font-display text-[46px] font-light text-[#c6c0b2]">+</span><b className="text-[14px]">Add {side === "left" ? "first" : "second"} player</b><span className="mt-1 font-plex text-[8.5px] text-[#8a8577]">SEARCH THE FULL DATABASE</span></button>;
  const player = dossier.player;
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[#d9d4c7] bg-[#1a1918] text-white">
      <div className="absolute inset-x-0 top-0 h-1 overall-dark-matter" />
      <div className="flex min-h-[240px] items-end gap-3 px-5 pt-5">
        <div className="relative h-[190px] min-w-[46%] flex-1">{player.playerImage ? <Image src={player.playerImage} alt={player.name} fill sizes="280px" className="object-contain object-bottom" /> : <div className="flex h-full items-center justify-center font-display text-5xl">{player.name.split(" ").map((p: string) => p[0]).join("")}</div>}</div>
        <div className="w-[48%] pb-5">
          <span className="font-display text-[56px] font-extrabold leading-none">{player.overall}</span>
          <h2 className="mt-2 font-display text-[clamp(20px,2.3vw,30px)] leading-[.95] font-bold tracking-[-.04em]">{player.name}</h2>
          <p className="mt-2 font-plex text-[9px] leading-[1.5] text-white/60">{player.positions.join("/")} · {player.team}<br />{player.archetype ?? "BUILD UNLISTED"}</p>
          <button type="button" onClick={onChoose} className="mt-3 cursor-pointer rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-semibold hover:bg-white hover:text-[#1a1918]">Change player</button>
        </div>
      </div>
    </div>
  );
}

function Comparison() {
  const sp = useSearchParams();
  const router = useRouter();
  const [pickerSide, setPickerSide] = useState<1 | 2 | null>(null);
  const slug1 = sp.get("player1");
  const slug2 = sp.get("player2");
  const dossier1 = useQuery(api.dossier.getDossier, slug1 ? { slug: slug1, teamType: parseType(sp.get("type1")), team: sp.get("team1") ?? undefined } : "skip");
  const dossier2 = useQuery(api.dossier.getDossier, slug2 ? { slug: slug2, teamType: parseType(sp.get("type2")), team: sp.get("team2") ?? undefined } : "skip");

  const choose = (player: PickerPlayer) => {
    const params = new URLSearchParams(sp.toString());
    const side = pickerSide ?? (slug1 ? 2 : 1);
    params.set(`player${side}`, player.slug);
    params.set(`type${side}`, player.teamType);
    params.set(`team${side}`, player.team);
    router.replace(`/compare?${params.toString()}`, { scroll: false });
  };
  const ready = dossier1 && dossier2;
  const p1 = dossier1?.player;
  const p2 = dossier2?.player;
  const category2 = new Map(dossier2?.categories.map((category) => [category.key, category]));
  const badges1 = new Map((dossier1?.badges ?? []).map((badge) => [badge.slug, badge]));
  const badges2 = new Map((dossier2?.badges ?? []).map((badge) => [badge.slug, badge]));
  const allBadgeSlugs = [...new Set([...badges1.keys(), ...badges2.keys()])].sort();

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav width="wide" />
      <main className="mx-auto max-w-[1440px] px-[clamp(20px,4vw,48px)] pb-14">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="mb-2 font-plex text-[10px] tracking-[.14em] text-[#8a8577]">THE MATCHUP FILE</p><h1 className="font-display text-[clamp(34px,5vw,64px)] leading-[.9] font-bold tracking-[-.055em]">Compare players</h1></div>
          <p className="m-0 max-w-[420px] text-[13px] leading-[1.55] text-[#57534a]">A complete side-by-side read of physical profile, category shape, every rating and badge edge—not just overall.</p>
        </header>
        <section className="grid gap-3 md:grid-cols-2"><PlayerRail dossier={dossier1} side="left" onChoose={() => setPickerSide(1)} /><PlayerRail dossier={dossier2} side="right" onChoose={() => setPickerSide(2)} /></section>

        {ready && p1 && p2 && (
          <div className="mt-3 space-y-3">
            <section className="overflow-hidden rounded-[16px] border border-[#e5e2da] bg-white">
              <div className="border-b border-[#e5e2da] px-5 py-3 font-plex text-[9.5px] tracking-[.12em] text-[#8a8577]">TALE OF THE TAPE</div>
              {[{ label: "OVERALL", a: p1.overall, b: p2.overall }, { label: "HEIGHT", a: p1.height ?? "—", b: p2.height ?? "—" }, { label: "WEIGHT", a: p1.weight ?? "—", b: p2.weight ?? "—" }, { label: "WINGSPAN", a: p1.wingspan ?? "—", b: p2.wingspan ?? "—" }, { label: "BADGES", a: dossier1.badges.length, b: dossier2.badges.length }].map((row) => <div key={row.label} className="grid grid-cols-[1fr_120px_1fr] items-center border-b border-[#f1efe8] px-5 py-2.5 last:border-0"><b className="text-[18px] tabular-nums">{row.a}</b><span className="text-center font-plex text-[8.5px] text-[#8a8577]">{row.label}</span><b className="text-right text-[18px] tabular-nums">{row.b}</b></div>)}
            </section>

            <section className="rounded-[16px] border border-[#e5e2da] bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><span className="font-plex text-[9.5px] tracking-[.12em] text-[#8a8577]">CATEGORY SHAPE</span><span className="font-plex text-[8px] text-[#b5b0a1]">LONGER BAR = EDGE</span></div>
              <div className="space-y-3">
                {dossier1.categories.map((category) => { const other = category2.get(category.key); const a = category.score ?? 0; const b = other?.score ?? 0; return <div key={category.key} className="grid grid-cols-[minmax(80px,1fr)_110px_minmax(80px,1fr)] items-center gap-3"><div className="flex items-center justify-end gap-2"><b className="text-[13px] tabular-nums">{a}</b><span className="h-2 rounded-full bg-[#1a1918]" style={{ width: `${Math.max(4, a)}%` }} /></div><span className="text-center font-plex text-[8px] text-[#8a8577]">{CATEGORY_LABELS[category.key]?.toUpperCase()}</span><div className="flex items-center gap-2"><span className="h-2 rounded-full bg-[#b58a3d]" style={{ width: `${Math.max(4, b)}%` }} /><b className="text-[13px] tabular-nums">{b}</b></div></div>; })}
              </div>
            </section>

            <section className="overflow-hidden rounded-[16px] border border-[#e5e2da] bg-white">
              <div className="border-b border-[#e5e2da] px-5 py-3"><span className="font-plex text-[9.5px] tracking-[.12em] text-[#8a8577]">EVERY ATTRIBUTE</span></div>
              {(Object.entries(ATTRIBUTE_CATEGORIES) as [string, readonly string[]][]).map(([category, keys]) => <div key={category} className="border-b border-[#e5e2da] p-5 last:border-0"><h3 className="mb-3 font-display text-[20px] font-bold">{CATEGORY_LABELS[category] ?? category}</h3><div className="grid gap-x-7 gap-y-2 lg:grid-cols-2">{keys.map((key) => { const a = p1.attributes[key]; const b = p2.attributes[key]; const delta = (a ?? 0) - (b ?? 0); return <div key={key} className="grid grid-cols-[34px_1fr_34px] items-center gap-2 border-b border-[#f1efe8] py-1.5"><b className={cn("tabular-nums", delta > 0 && "text-[#0a7f3f]")}>{a ?? "—"}</b><span className="truncate text-center text-[11.5px] text-[#57534a]">{getAttributeDisplayName(key)}</span><b className={cn("text-right tabular-nums", delta < 0 && "text-[#b58a3d]")}>{b ?? "—"}</b></div>; })}</div></div>)}
            </section>

            <section className="rounded-[16px] border border-[#e5e2da] bg-white p-5">
              <div className="mb-4"><span className="font-plex text-[9.5px] tracking-[.12em] text-[#8a8577]">BADGE LEDGER · {allBadgeSlugs.filter((slug) => badges1.has(slug) && badges2.has(slug)).length} SHARED</span></div>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{allBadgeSlugs.map((slug) => { const a = badges1.get(slug); const b = badges2.get(slug); const name = a?.name ?? b?.name ?? slug; return <Link href={`/badges/${slug}`} key={slug} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-[10px] border border-[#e5e2da] px-3 py-2 text-[#1a1918] no-underline hover:border-[#1a1918]"><span className="truncate text-[11.5px] font-semibold">{name}</span>{a ? <span className={cn("rounded px-1.5 py-0.5 font-plex text-[7px] text-white", TIER_CLASS[a.tier])}>{a.tier.toUpperCase()}</span> : <span className="text-[#c6c0b2]">—</span>}{b ? <span className={cn("rounded px-1.5 py-0.5 font-plex text-[7px] text-white", TIER_CLASS[b.tier])}>{b.tier.toUpperCase()}</span> : <span className="text-[#c6c0b2]">—</span>}</Link>; })}</div>
            </section>
            <div className="flex justify-between"><Link href={`/players/${p1.slug}`} className="text-[12px] font-semibold text-[#1a1918]">← {p1.name} dossier</Link><Link href={`/players/${p2.slug}`} className="text-[12px] font-semibold text-[#1a1918]">{p2.name} dossier →</Link></div>
          </div>
        )}
      </main>
      <FooterStrip width="wide" />
      <PlayerPicker open={pickerSide !== null} onOpenChange={(open) => !open && setPickerSide(null)} onPick={choose} />
    </div>
  );
}

export default function ComparePage() { return <Suspense fallback={null}><Comparison /></Suspense>; }
