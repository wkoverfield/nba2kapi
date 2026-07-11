"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
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

function radarPoints(scores: number[], cx = 115, cy = 98, radius = 72) {
  return scores.map((score, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / scores.length;
    const r = radius * (score / 100);
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  }).join(" ");
}

function DualRadar({ a, b, aName, bName }: { a: number[]; b: number[]; aName: string; bName: string }) {
  const axes = ["OUT", "INS", "PLY", "ATH", "DEF", "REB"];
  const axisPoints = axes.map((label, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    return { label, x: 115 + Math.cos(angle) * 91, y: 101 + Math.sin(angle) * 84 };
  });
  return <div className="flex min-h-[280px] flex-col items-center justify-center"><b className="font-display text-[22px] tracking-[.06em] text-[#b5b0a1]">VS</b><svg viewBox="0 0 230 200" className="mt-2 w-full max-w-[260px] overflow-visible">{[.25,.5,.75,1].map((ring) => <polygon key={ring} points={radarPoints(Array(6).fill(ring * 100))} fill="none" stroke="#e5e2da" strokeWidth="1" />)}<polygon points={radarPoints(a)} fill="#1a1918" fillOpacity=".09" stroke="#1a1918" strokeWidth="2" /><polygon points={radarPoints(b)} fill="#188fff" fillOpacity=".09" stroke="#188fff" strokeWidth="2" />{axisPoints.map((point) => <text key={point.label} x={point.x} y={point.y} textAnchor="middle" className="fill-[#8a8577] font-plex text-[8px]">{point.label}</text>)}</svg><div className="flex gap-4 font-plex text-[8px]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-[#1a1918]" />{aName.split(" ").at(-1)}</span><span className="flex items-center gap-1.5 text-[#188fff]"><i className="h-2 w-2 rounded-[2px] bg-[#188fff]" />{bName.split(" ").at(-1)}</span></div></div>;
}

function PlayerRail({ dossier, side, onChoose, onPrev, onNext }: { dossier: ReturnType<typeof useQuery<typeof api.dossier.getDossier>>; side: "left" | "right"; onChoose: () => void; onPrev: () => void; onNext: () => void }) {
  if (!dossier) return <button type="button" onClick={onChoose} className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-[#d9d4c7] bg-white/55 text-center"><span className="font-display text-[46px] font-light text-[#c6c0b2]">+</span><b className="text-[14px]">Add {side === "left" ? "first" : "second"} player</b><span className="mt-1 font-plex text-[8.5px] text-[#8a8577]">SEARCH THE FULL DATABASE</span></button>;
  const player = dossier.player;
  return (
    <div className="relative min-h-[300px] overflow-hidden rounded-[18px] bg-[#1a1918] text-white shadow-[0_24px_44px_-24px_rgba(26,25,24,.55)]">
      <div className="absolute inset-x-0 top-0 h-1 overall-dark-matter" /><div className={cn("absolute top-4 z-20 flex gap-1.5", side === "left" ? "right-4" : "left-4")}><button type="button" onClick={onPrev} aria-label="Previous player" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#1a1918]"><ChevronLeft className="h-3.5 w-3.5" /></button><button type="button" onClick={onNext} aria-label="Next player" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[#1a1918]"><ChevronRight className="h-3.5 w-3.5" /></button></div>
      <div className={cn("absolute top-4 z-10", side === "left" ? "left-5" : "right-5 text-right")}><p className="font-plex text-[8px] tracking-[.12em] text-white/70">{player.positions.join("/")} · {player.teamType.toUpperCase()}</p><b className="font-display text-[56px] leading-none">{player.overall}</b></div>
      <div className="absolute inset-x-0 bottom-[48px] top-8">{player.playerImage ? <Image src={player.playerImage} alt={player.name} fill sizes="420px" className="object-contain object-bottom" /> : <div className="flex h-full items-center justify-center font-display text-5xl">{player.name.split(" ").map((p: string) => p[0]).join("")}</div>}</div>
      <button type="button" onClick={onChoose} className={cn("absolute inset-x-0 bottom-0 z-10 cursor-pointer bg-gradient-to-t from-black/95 to-black/0 px-5 pt-8 pb-4 text-left", side === "right" && "text-right")}><b className="block font-display text-[20px] leading-none">{player.name}</b><span className="mt-1 block font-plex text-[8px] text-white/65">{player.team} · CLICK TO CHANGE</span></button>
    </div>
  );
}

function Comparison() {
  const sp = useSearchParams();
  const router = useRouter();
  const [pickerSide, setPickerSide] = useState<1 | 2 | null>(null);
  const playerPool = useQuery(api.players.getPlaygroundPlayers, {}) as PickerPlayer[] | undefined;
  const slug1 = sp.get("player1");
  const slug2 = sp.get("player2");
  const dossier1 = useQuery(api.dossier.getDossier, slug1 ? { slug: slug1, teamType: parseType(sp.get("type1")), team: sp.get("team1") ?? undefined } : "skip");
  const dossier2 = useQuery(api.dossier.getDossier, slug2 ? { slug: slug2, teamType: parseType(sp.get("type2")), team: sp.get("team2") ?? undefined } : "skip");

  const setPlayer = (side: 1 | 2, player: PickerPlayer) => {
    const params = new URLSearchParams(sp.toString());
    params.set(`player${side}`, player.slug);
    params.set(`type${side}`, player.teamType);
    params.set(`team${side}`, player.team);
    router.replace(`/compare?${params.toString()}`, { scroll: false });
  };
  const choose = (player: PickerPlayer) => setPlayer(pickerSide ?? (slug1 ? 2 : 1), player);
  const cycle = (side: 1 | 2, direction: -1 | 1) => {
    if (!playerPool?.length) return;
    const slug = side === 1 ? slug1 : slug2;
    const current = playerPool.findIndex((player) => player.slug === slug);
    const next = playerPool[(Math.max(0, current) + direction + playerPool.length) % playerPool.length];
    setPlayer(side, next);
  };
  const swap = () => {
    if (!slug1 || !slug2) return;
    const params = new URLSearchParams(sp.toString());
    for (const key of ["player", "type", "team"]) {
      const one = params.get(`${key}1`);
      const two = params.get(`${key}2`);
      if (two) params.set(`${key}1`, two); else params.delete(`${key}1`);
      if (one) params.set(`${key}2`, one); else params.delete(`${key}2`);
    }
    router.replace(`/compare?${params.toString()}`, { scroll: false });
  };
  const ready = dossier1 && dossier2;
  const p1 = dossier1?.player;
  const p2 = dossier2?.player;
  const category2 = new Map(dossier2?.categories.map((category) => [category.key, category]));
  const badges1 = new Map((dossier1?.badges ?? []).map((badge) => [badge.slug, badge]));
  const badges2 = new Map((dossier2?.badges ?? []).map((badge) => [badge.slug, badge]));
  const allBadgeSlugs = [...new Set([...badges1.keys(), ...badges2.keys()])].sort();
  const shared = allBadgeSlugs.filter((slug) => badges1.has(slug) && badges2.has(slug));
  const only1 = allBadgeSlugs.filter((slug) => badges1.has(slug) && !badges2.has(slug));
  const only2 = allBadgeSlugs.filter((slug) => !badges1.has(slug) && badges2.has(slug));
  const tierWeight: Record<string, number> = { Legendary: 5, "Hall of Fame": 4, Gold: 3, Silver: 2, Bronze: 1 };
  const badgeScore = (badges: NonNullable<typeof dossier1>["badges"]) => badges.reduce((sum, badge) => sum + (tierWeight[badge.tier] ?? 0), 0);
  const score1 = dossier1 ? badgeScore(dossier1.badges) : 0;
  const score2 = dossier2 ? badgeScore(dossier2.badges) : 0;
  const wins = dossier1?.categories.reduce((acc, category) => { const b = category2.get(category.key)?.score ?? 0; if ((category.score ?? 0) > b) acc[0]++; else if ((category.score ?? 0) < b) acc[1]++; return acc; }, [0, 0]) ?? [0, 0];
  const verdict = p1 && p2 ? wins[0] === wins[1] ? `EVEN PROFILE · ${wins[0]} CATEGORY WINS EACH` : `${wins[0] > wins[1] ? p1.name : p2.name} HOLDS THE OVERALL EDGE · ${Math.max(...wins)}–${Math.min(...wins)} IN CATEGORY WINS` : "PICK TWO PLAYERS TO OPEN THE MATCHUP";
  const radar1 = dossier1?.categories.map((category) => category.score ?? 0) ?? [];
  const radar2 = dossier2?.categories.map((category) => category.score ?? 0) ?? [];
  const signatureKeys = p1 && p2 ? [...new Set([...Object.keys(p1.attributes), ...Object.keys(p2.attributes)])].filter((key) => !["stamina", "durability", "hustle", "hands", "offensiveConsistency", "defensiveConsistency"].includes(key)).sort((a, b) => Math.max(p2.attributes[b] ?? 0, p1.attributes[b] ?? 0) - Math.max(p2.attributes[a] ?? 0, p1.attributes[a] ?? 0)).slice(0, 5) : [];

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#fffdf8,#faf9f5_420px)] font-body text-[#1a1918]">
      <TopNav />
      <main className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3"><Link href={p1 ? `/players/${p1.slug}` : "/playground"} className="font-plex text-[9px] tracking-[.1em] text-[#8a8577] no-underline">← BACK TO DOSSIER</Link><button type="button" onClick={swap} disabled={!ready} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#e5e2da] bg-white px-3.5 py-2 font-plex text-[9px] tracking-[.06em] disabled:opacity-40"><ArrowLeftRight className="h-3 w-3" />SWAP SIDES</button></div>
        <header className="mt-4"><h1 className="font-display text-[clamp(34px,4vw,46px)] font-bold tracking-[-.04em]">Head to head</h1><p className="mt-1 font-plex text-[9px] tracking-[.1em] text-[#8a8577]">{verdict}</p></header>
        <section className="mt-5 grid items-stretch gap-4 lg:grid-cols-[minmax(250px,1fr)_260px_minmax(250px,1fr)]"><PlayerRail dossier={dossier1} side="left" onChoose={() => setPickerSide(1)} onPrev={() => cycle(1, -1)} onNext={() => cycle(1, 1)} />{ready && p1 && p2 ? <DualRadar a={radar1} b={radar2} aName={p1.name} bName={p2.name} /> : <div className="hidden items-center justify-center font-display text-[22px] text-[#b5b0a1] lg:flex">VS</div>}<PlayerRail dossier={dossier2} side="right" onChoose={() => setPickerSide(2)} onPrev={() => cycle(2, -1)} onNext={() => cycle(2, 1)} /></section>

        {ready && p1 && p2 && (
          <div className="mt-3 space-y-3">
            <section className="flex flex-wrap items-center gap-x-7 gap-y-2 px-1 py-2 font-plex"><span className="text-[8px] tracking-[.12em] text-[#b5b0a1]">TALE OF THE TAPE</span>{[{ label: "HEIGHT", a: p1.height, b: p2.height }, { label: "WINGSPAN", a: p1.wingspan, b: p2.wingspan }, { label: "WEIGHT", a: p1.weight, b: p2.weight }].map((row) => <span key={row.label} className="inline-flex items-baseline gap-2"><i className="text-[8px] tracking-[.1em] text-[#b5b0a1] not-italic">{row.label}</i><b className="text-[12px]">{row.a ?? "—"}</b><i className="text-[#cfc9bb] not-italic">/</i><b className="text-[12px] text-[#188fff]">{row.b ?? "—"}</b></span>)}</section>

            <section className="rounded-[16px] border border-[#e5e2da] bg-white p-5">
              <div className="mb-4 flex items-center justify-between"><span className="font-plex text-[9.5px] tracking-[.12em] text-[#8a8577]">CATEGORY BY CATEGORY</span><span className="font-plex text-[8px] text-[#b5b0a1]">WINNER IN INK · TIES IN AMBER</span></div>
              <div className="space-y-3">
                {dossier1.categories.map((category) => { const other = category2.get(category.key); const a = category.score ?? 0; const b = other?.score ?? 0; const tie = a === b; return <div key={category.key} className="grid grid-cols-[minmax(70px,1fr)_105px_minmax(70px,1fr)] items-center gap-3"><div className="flex items-center justify-end gap-2"><b className={cn("text-[12px] tabular-nums", a < b && "text-[#b5b0a1]")}>{a}</b><span className={cn("h-1.5 rounded-full", tie ? "bg-[#b58a3d]" : a > b ? "bg-[#1a1918]" : "bg-[#dedad0]")} style={{ width: `${Math.max(4, a)}%` }} /></div><span className="text-center font-plex text-[8px] text-[#8a8577]">{CATEGORY_LABELS[category.key]?.toUpperCase()}</span><div className="flex items-center gap-2"><span className={cn("h-1.5 rounded-full", tie ? "bg-[#b58a3d]" : b > a ? "bg-[#1a1918]" : "bg-[#dedad0]")} style={{ width: `${Math.max(4, b)}%` }} /><b className={cn("text-[12px] tabular-nums", b < a && "text-[#b5b0a1]")}>{b}</b></div></div>; })}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-3"><div className="rounded-[14px] border border-[#e5e2da] bg-white p-4"><p className="mb-3 font-plex text-[8.5px] tracking-[.12em] text-[#8a8577]">SIGNATURE STATS</p>{signatureKeys.map((key) => <div key={key} className="grid grid-cols-[28px_1fr_28px] border-b border-[#f1efe8] py-1.5 text-[10px]"><b>{p1.attributes[key] ?? "—"}</b><span className="text-center text-[#57534a]">{getAttributeDisplayName(key)}</span><b className="text-right text-[#188fff]">{p2.attributes[key] ?? "—"}</b></div>)}</div><div className="rounded-[14px] border border-[#e5e2da] bg-white p-4"><div className="flex justify-between"><p className="font-plex text-[8.5px] tracking-[.12em] text-[#8a8577]">WEIGHTED BADGES</p><span className="font-plex text-[7px] text-[#b5b0a1]">HOF×4 · GOLD×3 · SILVER×2 · BRONZE×1</span></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="h-2 rounded-full bg-[#1a1918]" /><b className="font-display text-[20px]">{score1} / {score2}</b><div className="h-2 rounded-full bg-[#188fff]" /></div><p className="mt-4 text-center font-plex text-[8px] text-[#8a8577]">{dossier1.badges.length} BADGES · {shared.length} SHARED · {dossier2.badges.length} BADGES</p></div><div className="rounded-[14px] border border-[#e5e2da] bg-white p-4"><p className="font-plex text-[8.5px] tracking-[.12em] text-[#8a8577]">THE TAKE</p><h3 className="mt-3 font-display text-[21px] leading-[1.05] font-bold">{wins[0] === wins[1] ? "Different strengths, even shape." : `${wins[0] > wins[1] ? p1.name : p2.name} wins more dimensions.`}</h3><p className="mt-2 text-[11px] leading-[1.5] text-[#57534a]">{verdict}</p></div></section>

            <section className="overflow-hidden rounded-[16px] border border-[#e5e2da] bg-white">
              <div className="grid grid-cols-[minmax(64px,130px)_minmax(150px,1fr)_minmax(64px,130px)] items-end border-b border-[#e5e2da] bg-[#faf9f5] px-4 py-3 sm:px-6">
                <span className="truncate font-plex text-[8px] font-bold tracking-[.08em]">{p1.name.split(" ").at(-1)?.toUpperCase()}</span>
                <span className="text-center font-plex text-[9px] tracking-[.12em] text-[#8a8577]">FULL ATTRIBUTE LEDGER</span>
                <span className="truncate text-right font-plex text-[8px] font-bold tracking-[.08em] text-[#188fff]">{p2.name.split(" ").at(-1)?.toUpperCase()}</span>
              </div>
              {(Object.entries(ATTRIBUTE_CATEGORIES) as [string, readonly string[]][]).map(([category, keys]) => (
                <div key={category} className="border-b border-[#e5e2da] last:border-0">
                  <div className="flex items-center justify-between bg-[#f7f5ef] px-4 py-2.5 sm:px-6">
                    <h3 className="font-display text-[16px] font-bold">{CATEGORY_LABELS[category] ?? category}</h3>
                    <span className="font-plex text-[7.5px] text-[#b5b0a1]">{keys.length} ATTRIBUTES</span>
                  </div>
                  <div>
                    {keys.map((key) => {
                      const a = p1.attributes[key];
                      const b = p2.attributes[key];
                      const aWins = a !== undefined && b !== undefined && a > b;
                      const bWins = a !== undefined && b !== undefined && b > a;
                      return (
                        <div key={key} className="grid grid-cols-[minmax(64px,130px)_minmax(150px,1fr)_minmax(64px,130px)] items-center border-t border-[#f1efe8] px-4 py-2 sm:px-6">
                          <b className={cn("text-[13px] tabular-nums", aWins ? "text-[#0a7f3f]" : "text-[#57534a]")}>{a ?? "—"}</b>
                          <span className="text-center text-[11.5px] text-[#57534a]">{getAttributeDisplayName(key)}</span>
                          <b className={cn("text-right text-[13px] tabular-nums", bWins ? "text-[#188fff]" : "text-[#57534a]")}>{b ?? "—"}</b>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-[16px] border border-[#e5e2da] bg-white p-5"><p className="mb-4 font-plex text-[9px] tracking-[.12em] text-[#8a8577]">BADGE BREAKDOWN</p><div className="grid gap-4 lg:grid-cols-3"><div><p className="mb-2 border-b border-[#e5e2da] pb-2 font-plex text-[8px]">{p1.name.toUpperCase()} ONLY · {only1.length}</p><div className="flex flex-wrap gap-1.5">{only1.map((slug) => { const badge = badges1.get(slug)!; return <Link key={slug} href={`/badges?badge=${slug}&tier=${encodeURIComponent(badge.tier)}`} className={cn("rounded-full px-2.5 py-1 font-plex text-[7px] text-white no-underline", TIER_CLASS[badge.tier])}>{badge.name}</Link>; })}</div></div><div className="border-x-0 border-[#e5e2da] lg:border-x lg:px-4"><p className="mb-2 border-b border-[#e5e2da] pb-2 font-plex text-[8px]">SHARED · {shared.length}</p><div className="space-y-1.5">{shared.map((slug) => { const a = badges1.get(slug)!; const b = badges2.get(slug)!; return <Link key={slug} href={`/badges?badge=${slug}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-[#1a1918] no-underline"><span className={cn("rounded px-1.5 py-0.5 font-plex text-[6px] text-white", TIER_CLASS[a.tier])}>{a.tier === "Hall of Fame" ? "HOF" : a.tier.toUpperCase()}</span><span className="truncate text-center text-[9px] font-semibold">{a.name}</span><span className={cn("rounded px-1.5 py-0.5 font-plex text-[6px] text-white", TIER_CLASS[b.tier])}>{b.tier === "Hall of Fame" ? "HOF" : b.tier.toUpperCase()}</span></Link>; })}</div></div><div><p className="mb-2 border-b border-[#e5e2da] pb-2 font-plex text-[8px] text-right">{p2.name.toUpperCase()} ONLY · {only2.length}</p><div className="flex flex-wrap justify-end gap-1.5">{only2.map((slug) => { const badge = badges2.get(slug)!; return <Link key={slug} href={`/badges?badge=${slug}&tier=${encodeURIComponent(badge.tier)}`} className={cn("rounded-full px-2.5 py-1 font-plex text-[7px] text-white no-underline", TIER_CLASS[badge.tier])}>{badge.name}</Link>; })}</div></div></div>
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
