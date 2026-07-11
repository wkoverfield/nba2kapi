"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { SiteFooter } from "@/components/chrome/site-footer";
import { KeyDialog } from "@/components/chrome/key-dialog";
import { getRatingClasses, getRatingTier, getAttributeColor } from "@/lib/rating-colors";
import { getTeamAbbreviation } from "@/lib/team-abbr";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { CURRENT_GAME_VERSION } from "@/convex/gameVersion";
import { cn } from "@/lib/utils";

const RISE_IN =
  "animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none";

const MONO_LABEL = "font-plex text-[12px] tracking-[0.14em] text-[#8a8577]";

const PILL_CTA =
  "rounded-full bg-[#1a1918] text-[#faf9f5] no-underline font-semibold transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none cursor-pointer";

type DemoPlayer = {
  name: string;
  slug: string;
  team: string;
  teamType: "curr" | "class" | "allt";
  positions: string[];
  overall: number;
  playerImage: string | null;
  threePointShot: number | null;
};

const DEMO_POSITIONS = [
  { label: "guards", value: "guard", positions: ["PG", "SG"] },
  { label: "wings", value: "wing", positions: ["SG", "SF"] },
  { label: "bigs", value: "big", positions: ["PF", "C"] },
] as const;
const DEMO_ERAS = [
  { label: "any era", value: "all" },
  { label: "current", value: "curr" },
  { label: "classic", value: "class" },
  { label: "all-time", value: "allt" },
] as const;
const DEMO_THRESHOLDS = [80, 85, 90] as const;
const DEMO_SORTS = [
  { label: "overall", value: "overall" },
  { label: "3PT", value: "three_ball" },
] as const;

const BOARD_MINI = [
  { rank: 1, name: "Thunder", avg: "82.4", w: "96%" },
  { rank: 2, name: "Nuggets", avg: "81.1", w: "88%" },
  { rank: 3, name: "Celtics", avg: "80.9", w: "84%" },
];

const COURT_MINI = [
  { x: "16%", y: "50%", ovr: 96 },
  { x: "30%", y: "24%", ovr: 99 },
  { x: "30%", y: "76%", ovr: 98 },
  { x: "70%", y: "24%", ovr: 98 },
  { x: "70%", y: "76%", ovr: 97 },
  { x: "84%", y: "50%", ovr: 95 },
];

const ENDPOINTS = [
  { path: "GET /api/players", note: "filter, sort, paginate", href: "/docs/endpoints/players" },
  { path: "GET /api/players/bulk", note: "whole dataset, one call", href: "/docs/endpoints/players" },
  { path: "GET /api/players/slug/:slug", note: "one player, full detail", href: "/docs/endpoints/players" },
  { path: "GET /api/teams/:team/roster", note: "full team rosters", href: "/docs/endpoints/teams" },
];

function weekOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + 1) / 7);
}

function timeAgo(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function OvrChip({ ovr, size = "md" }: { ovr: number; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex w-[38px] items-center justify-center rounded-[6px] font-bold text-white tabular-nums",
        size === "md" ? "py-1 text-[14px]" : "py-[3px] text-[12px]",
        getRatingClasses(ovr).bg
      )}
    >
      {ovr}
    </span>
  );
}

function SlotChevron() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#b5b0a1"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function QuerySlot({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 border-0 border-b-2 border-dashed border-[#d9d4c7] bg-transparent px-[3px] pb-px font-[inherit] font-extrabold text-[#1a1918] transition-colors hover:border-[#1a1918] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1a1918]"
    >
      {children}
      <SlotChevron />
    </button>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className={cn(MONO_LABEL, "mb-3.5")}>{eyebrow}</div>
      <h2 className="m-0 font-display text-[clamp(30px,3.2vw,40px)] font-bold tracking-[-0.03em] text-[#1a1918]">
        {title}
      </h2>
    </div>
  );
}

export default function Home() {
  const [showRegistration, setShowRegistration] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [demoPosition, setDemoPosition] = useState(0);
  const [demoEra, setDemoEra] = useState(0);
  const [demoThreshold, setDemoThreshold] = useState(1);
  const [demoSort, setDemoSort] = useState(0);
  const router = useRouter();

  const stats = useQuery(api.players.getStats);
  const topPlayers = useQuery(api.players.getAllFiltered, {
    teamType: "curr",
    sortBy: "overall-desc",
    limit: 9,
  });
  const demoPlayers = useQuery(api.players.getPlaygroundPlayers) as DemoPlayer[] | undefined;

  const demoResults = useMemo(() => {
    if (!demoPlayers) return [];
    const position = DEMO_POSITIONS[demoPosition];
    const era = DEMO_ERAS[demoEra].value;
    const threshold = DEMO_THRESHOLDS[demoThreshold];
    return demoPlayers
      .filter((p) => position.positions.some((pos) => p.positions.includes(pos)))
      .filter((p) => era === "all" || p.teamType === era)
      .filter((p) => (p.threePointShot ?? -1) >= threshold)
      .sort((a, b) =>
        DEMO_SORTS[demoSort].value === "overall"
          ? b.overall - a.overall || (b.threePointShot ?? 0) - (a.threePointShot ?? 0)
          : (b.threePointShot ?? 0) - (a.threePointShot ?? 0) || b.overall - a.overall
      );
  }, [demoPlayers, demoPosition, demoEra, demoThreshold, demoSort]);

  const teaserUrl = `/api/players?position=${DEMO_POSITIONS[demoPosition].value}&era=${DEMO_ERAS[demoEra].value}&three_ball_gte=${DEMO_THRESHOLDS[demoThreshold]}&sort=${DEMO_SORTS[demoSort].value}:desc`;

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  const handleGetApiKey = () => {
    if (hasApiKey) {
      router.push("/dashboard");
    } else {
      setShowRegistration(true);
    }
  };

  // Don't close the dialog or navigate here: the key is shown in full exactly
  // once on the dialog's second step, and its own buttons navigate onward.
  const handleRegistrationSuccess = () => {
    setHasApiKey(true);
  };

  const copyTeaserUrl = () => {
    navigator.clipboard
      .writeText(`https://api.nba2kapi.com${teaserUrl}`)
      .then(() => toast.success("Request URL copied"));
  };

  return (
    <>
      <div className="min-h-screen bg-[linear-gradient(to_bottom,#fffdf8,#faf9f5_600px)] font-body text-[#1a1918]">
        <TopNav onCtaClick={handleGetApiKey} hasApiKey={hasApiKey} />

        {/* Hero */}
        <div className="mx-auto grid max-w-[1360px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-start gap-[clamp(32px,5vw,72px)] px-[clamp(20px,4vw,48px)] pt-[clamp(32px,5vw,60px)] pb-[72px]">
          <div className="pt-5">
            <div className={cn(MONO_LABEL, "mb-6", RISE_IN)}>
              FREE REST API — NBA {CURRENT_GAME_VERSION} RATINGS
            </div>
            <h1
              className={cn(
                "mb-6 font-display text-[clamp(38px,4.6vw,62px)] leading-[1.04] font-bold tracking-[-0.035em]",
                RISE_IN
              )}
              style={{ animationDelay: "60ms" }}
            >
              <div>NBA 2K player data.</div>
              <div>One free API.</div>
            </h1>
            <p
              className={cn("mb-[34px] max-w-[460px] text-[18px] leading-[1.6] text-[#57534a]", RISE_IN)}
              style={{ animationDelay: "120ms" }}
            >
              Access comprehensive player attributes, team rosters, and ratings data —{" "}
              {stats?.totalPlayers ? `${stats.totalPlayers.toLocaleString()}` : "1,900+"} players
              across current, classic, and all-time rosters, updated weekly. Build with real NBA 2K
              data in minutes.
            </p>
            <div
              className={cn("mb-10 flex flex-wrap items-center gap-[18px]", RISE_IN)}
              style={{ animationDelay: "180ms" }}
            >
              <button
                type="button"
                onClick={handleGetApiKey}
                className={cn(PILL_CTA, "px-[26px] py-3.5 text-[15px]")}
              >
                {hasApiKey ? "View dashboard" : "Get an API key"}
              </button>
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText("curl https://api.nba2kapi.com/api/players")
                    .then(() => toast.success("curl command copied"))
                }
                title="Copy this command"
                className="cursor-pointer rounded-full border border-[#e5e2da] bg-[#f1efe8] px-[18px] py-3 font-plex text-[13px] text-[#57534a] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.98] motion-reduce:transition-none"
              >
                $ curl api.nba2kapi.com/api/players
                <span className="ml-1 inline-block h-3.5 w-[7px] translate-y-[2px] animate-[caret-blink_1.1s_step-end_infinite] bg-[#1a1918] motion-reduce:animate-none" />
              </button>
            </div>
            <div
              className={cn("flex flex-wrap gap-x-8 gap-y-[18px] font-plex text-[12px] text-[#8a8577]", RISE_IN)}
              style={{ animationDelay: "240ms" }}
            >
              <div>
                <span className="font-semibold text-[#1a1918]">
                  {stats?.totalPlayers ? stats.totalPlayers.toLocaleString() : "1,900+"}
                </span>{" "}
                players
              </div>
              <div>
                <span className="font-semibold text-[#1a1918]">{stats?.uniqueTeams ?? "100+"}</span>{" "}
                teams
              </div>
              <div>
                <span className="font-semibold text-[#1a1918]">40+</span> attributes
              </div>
              <div>
                <span className="font-semibold text-[#1a1918]">&lt;150ms</span> responses
              </div>
            </div>
          </div>

          {/* Live leaderboard card */}
          <div
            className="overflow-hidden rounded-2xl border border-[#e5e2da] bg-white shadow-[0_24px_48px_-24px_rgba(26,25,24,0.18)] animate-[rise-in_500ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
            style={{ animationDelay: "150ms" }}
          >
            <div className="flex items-center justify-between border-b border-[#efece4] px-5 py-3.5">
              <span className="font-plex text-[11px] tracking-[0.12em] text-[#8a8577]">
                TOP OVERALL — {CURRENT_GAME_VERSION} · WEEK {weekOfYear(new Date())}
              </span>
              <span className="font-plex text-[11px] text-[#b5b0a1]">LIVE</span>
            </div>
            {topPlayers
              ? topPlayers.players.map((p, i) => (
                  <Link
                    key={p.slug}
                    href={`/players/${p.slug}`}
                    className={cn(
                      "flex items-center gap-3.5 border-b border-[#f4f1ea] px-5 py-[9px] text-[#1a1918] no-underline transition-colors duration-100 hover:bg-[#faf8f2]",
                      RISE_IN
                    )}
                    style={{ animationDelay: `${250 + i * 35}ms` }}
                  >
                    <span className="w-[18px] font-plex text-[12px] text-[#b5b0a1]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="relative h-[30px] w-[30px] shrink-0 overflow-hidden rounded-full bg-[#f1efe8]">
                      {p.playerImage && (
                        // 2kratings blocks hotlinking, so serve through the
                        // Next image optimizer (same fix as the badge icons).
                        <Image
                          src={p.playerImage}
                          alt={p.name}
                          fill
                          sizes="30px"
                          className="object-cover object-top"
                        />
                      )}
                    </div>
                    <span className="flex-1 text-[14px] font-semibold">{p.name}</span>
                    <span className="font-plex text-[11px] text-[#b5b0a1]">
                      {getTeamAbbreviation(p.team)}
                    </span>
                    <span className="w-[84px] text-right text-[11px] text-[#8a8577]">
                      {getRatingTier(p.overall)}
                    </span>
                    <OvrChip ovr={p.overall} />
                  </Link>
                ))
              : Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-center gap-3.5 border-b border-[#f4f1ea] px-5 py-[9px]"
                  >
                    <span className="h-3 w-[18px] rounded bg-[#f1efe8]" />
                    <div className="h-[30px] w-[30px] shrink-0 rounded-full bg-[#f1efe8]" />
                    <span className="h-3.5 flex-1 rounded bg-[#f1efe8]" />
                    <span className="h-[26px] w-[38px] rounded-[6px] bg-[#f1efe8]" />
                  </div>
                ))}
            <div className="px-5 py-3 font-plex text-[11px] text-[#b5b0a1]">
              from GET /api/players?sort=overall:desc
              {stats?.lastUpdated ? ` · updated ${timeAgo(stats.lastUpdated)}` : ""}
            </div>
          </div>
        </div>

        {/* Playground teaser */}
        <div
          id="playground"
          className="mx-auto max-w-[1360px] border-t border-[#e5e2da] px-[clamp(20px,4vw,48px)] py-[clamp(48px,6vw,80px)]"
        >
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
            <SectionHeading eyebrow="THE PLAYGROUND" title="Explore NBA 2K player data" />
            <Link
              href="/playground"
              className="border-b border-[#1a1918] pb-0.5 font-plex text-[13px] font-medium text-[#1a1918] no-underline transition-colors duration-150 hover:text-[#57534a]"
            >
              Open the full playground →
            </Link>
          </div>

          <div className="mb-3.5 rounded-2xl border border-[#e5e2da] bg-white p-[clamp(16px,2.5vw,24px)]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]">
                QUERY — READS LIKE A SENTENCE, RUNS LIKE AN API
              </span>
              <Link
                href="/playground"
                className="border-b border-[#1a1918] pb-px font-plex text-[9.5px] tracking-[0.06em] text-[#1a1918] no-underline transition-colors duration-150 hover:text-[#57534a]"
              >
                TRY IT LIVE →
              </Link>
            </div>
            <div className="font-display text-[clamp(19px,2.2vw,25px)] leading-[1.7] font-semibold tracking-[-0.02em] text-[#57534a]">
              Show me{" "}
              <QuerySlot onClick={() => setDemoPosition((v) => (v + 1) % DEMO_POSITIONS.length)}>
                {DEMO_POSITIONS[demoPosition].label}
              </QuerySlot>{" "}
              from{" "}
              <QuerySlot onClick={() => setDemoEra((v) => (v + 1) % DEMO_ERAS.length)}>
                {DEMO_ERAS[demoEra].label}
              </QuerySlot>{" "}
              with{" "}
              <QuerySlot onClick={() => setDemoThreshold((v) => (v + 1) % DEMO_THRESHOLDS.length)}>
                3PT ≥ {DEMO_THRESHOLDS[demoThreshold]}
              </QuerySlot>
              , ranked by{" "}
              <QuerySlot onClick={() => setDemoSort((v) => (v + 1) % DEMO_SORTS.length)}>
                {DEMO_SORTS[demoSort].label}
              </QuerySlot>
            </div>
            <div className="mt-3.5 flex items-center overflow-hidden rounded-[10px] bg-[#1a1918]">
              <span className="shrink-0 bg-white/12 px-[13px] py-[9px] font-plex text-[9.5px] text-[#faf9f5]">
                GET
              </span>
              <span className="flex-1 overflow-hidden px-3.5 font-plex text-[11px] text-ellipsis whitespace-nowrap text-[#faf9f5]">
                {teaserUrl}
              </span>
              <button
                type="button"
                onClick={copyTeaserUrl}
                className="shrink-0 cursor-pointer border-l border-white/12 px-3.5 py-[9px] font-plex text-[9.5px] text-white/70 transition-colors duration-150 hover:text-white"
              >
                COPY
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e5e2da] bg-white">
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-[34px_30px_minmax(150px,1fr)_90px_54px_56px] items-center gap-3 border-b border-[#e5e2da] bg-[#faf9f5] px-5 py-2.5">
                  <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">#</span>
                  <span />
                  <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">
                    PLAYER
                  </span>
                  <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">ERA</span>
                  <span className="font-plex text-[8.5px] font-bold tracking-[0.08em] text-[#1a1918]">
                    OVR ↓
                  </span>
                  <span className="rounded-[5px] bg-[#f6f2e6] py-0.5 text-center font-plex text-[8.5px] font-bold tracking-[0.08em] text-[#1a1918]">
                    3PT ●
                  </span>
                </div>
                {demoResults.slice(0, 6).map((r, i) => (
                  <Link
                    key={`${r.slug}:${r.teamType}:${r.team}`}
                    href={`/players/${r.slug}?type=${r.teamType}&team=${encodeURIComponent(r.team)}`}
                    className="grid grid-cols-[34px_30px_minmax(150px,1fr)_90px_54px_56px] items-center gap-3 border-b border-[#faf8f2] px-5 py-2 text-[#1a1918] no-underline transition-colors duration-100 hover:bg-[#faf8f2]"
                  >
                    <span className="font-plex text-[10px] text-[#b5b0a1]">{i + 1}</span>
                    <div
                      className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[#f1efe8] font-display text-[10px] font-extrabold text-[#57534a]"
                    >
                      {r.playerImage ? (
                        <Image src={r.playerImage} alt="" fill sizes="28px" className="object-cover object-top" />
                      ) : r.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="overflow-hidden text-[13.5px] font-semibold text-ellipsis whitespace-nowrap">
                        {r.name}
                      </span>
                      <span className="whitespace-nowrap font-plex text-[8.5px] text-[#8a8577]">
                        {r.positions.join("/")} · {getTeamAbbreviation(r.team)}
                      </span>
                    </div>
                    <span
                      className="font-plex text-[8px] font-bold tracking-[0.08em]"
                      style={{ color: r.teamType === "curr" ? "#8a8577" : "#9a6700" }}
                    >
                      {r.teamType === "curr" ? "CURRENT" : r.teamType === "class" ? "CLASSIC" : "ALL-TIME"}
                    </span>
                    <OvrChip ovr={r.overall} size="sm" />
                    <span
                      className="rounded-[5px] bg-[#faf7ee] py-[3px] text-center text-[12.5px] font-bold tabular-nums"
                      style={{ color: getAttributeColor(r.threePointShot ?? 0) }}
                    >
                      {r.threePointShot ?? "—"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf9f5] px-5 py-[9px]">
              <span className="font-plex text-[8.5px] text-[#b5b0a1]">
                <b className="text-[#1a1918]">{demoResults.length} MATCH</b> · SHOWING {Math.min(6, demoResults.length)} · LIVE {CURRENT_GAME_VERSION} DATA
              </span>
              <span className="font-plex text-[8.5px] text-[#b5b0a1]">● = QUERIED COLUMN</span>
            </div>
          </div>
        </div>

        {/* Triptych */}
        <div className="mx-auto max-w-[1360px] border-t border-[#e5e2da] px-[clamp(20px,4vw,48px)] py-[clamp(48px,6vw,80px)]">
          <div className="mb-8">
            <SectionHeading eyebrow="THREE WAYS TO EXPLORE" title="One dataset. Three lenses." />
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
            <Link
              href="/playground"
              className="flex flex-col overflow-hidden rounded-2xl border border-[#e5e2da] bg-white text-[#1a1918] no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[#1a1918] hover:shadow-[0_18px_34px_-20px_rgba(26,25,24,0.32)] active:scale-[0.99] motion-reduce:transition-none"
            >
              <div className="flex h-[132px] flex-col justify-center gap-[7px] border-b border-[#efece4] bg-[#faf9f5] px-[18px] py-4">
                <div className="h-[9px] w-[70%] rounded-full bg-[#e5e2da]" />
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-11 rounded bg-[#1a1918]" />
                  <span className="h-3 w-[60px] rounded bg-[#d9d4c7]" />
                  <span className="h-3 w-[38px] rounded bg-[#d9d4c7]" />
                </div>
                <div className="flex h-[26px] items-center rounded-[7px] bg-[#1a1918] px-2.5">
                  <span className="font-plex text-[8px] text-[#6ee7a0]">
                    GET /api/players?era=all
                  </span>
                </div>
              </div>
              <div className="px-[18px] py-4">
                <h3 className="m-0 font-display text-[19px] font-bold tracking-[-0.02em]">
                  The Playground
                </h3>
                <p className="mt-1.5 mb-0 text-[13px] leading-[1.5] text-[#57534a]">
                  Build a query by writing a sentence — filter any attribute, mix eras, and read the
                  exact API call back.
                </p>
              </div>
            </Link>

            <Link
              href="/teams"
              className="flex flex-col overflow-hidden rounded-2xl border border-[#e5e2da] bg-white text-[#1a1918] no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[#1a1918] hover:shadow-[0_18px_34px_-20px_rgba(26,25,24,0.32)] active:scale-[0.99] motion-reduce:transition-none"
            >
              <div className="flex h-[132px] flex-col justify-center gap-[9px] border-b border-[#efece4] bg-[#faf9f5] px-[18px] py-4">
                {BOARD_MINI.map((b) => (
                  <div key={b.rank} className="flex items-center gap-2">
                    <span className="w-3 font-display text-[12px] font-extrabold text-[#b5b0a1]">
                      {b.rank}
                    </span>
                    <span className="w-[62px] text-[11px] font-semibold">{b.name}</span>
                    <div className="h-[5px] flex-1 rounded-full bg-[#e5e2da]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(to_right,#8a8577,#1a1918)]"
                        style={{ width: b.w }}
                      />
                    </div>
                    <span className="font-plex text-[9px] font-bold">{b.avg}</span>
                  </div>
                ))}
              </div>
              <div className="px-[18px] py-4">
                <h3 className="m-0 font-display text-[19px] font-bold tracking-[-0.02em]">
                  The Board
                </h3>
                <p className="mt-1.5 mb-0 text-[13px] leading-[1.5] text-[#57534a]">
                  Every team ranked by roster strength — open one to see the depth chart, or flip
                  through the league.
                </p>
              </div>
            </Link>

            <Link
              href="/lineups"
              className="flex flex-col overflow-hidden rounded-2xl border border-[#e5e2da] bg-white text-[#1a1918] no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-[#1a1918] hover:shadow-[0_18px_34px_-20px_rgba(26,25,24,0.32)] active:scale-[0.99] motion-reduce:transition-none"
            >
              <div className="relative h-[132px] overflow-hidden border-b border-[#efece4] bg-[#f6f4ee]">
                <svg
                  viewBox="0 0 100 40"
                  preserveAspectRatio="none"
                  className="absolute inset-0 h-full w-full"
                >
                  <line x1="50" y1="0" x2="50" y2="40" stroke="#d9d4c7" strokeWidth="0.4" />
                  <circle cx="50" cy="20" r="6" fill="none" stroke="#d9d4c7" strokeWidth="0.4" />
                  <path d="M 0 6 Q 22 20 0 34" fill="none" stroke="#d9d4c7" strokeWidth="0.4" />
                  <path d="M 100 6 Q 78 20 100 34" fill="none" stroke="#d9d4c7" strokeWidth="0.4" />
                  <line x1="30" y1="20" x2="70" y2="20" stroke="#b5b0a1" strokeWidth="0.4" strokeDasharray="1.5 2" />
                  <line x1="22" y1="11" x2="78" y2="11" stroke="#b5b0a1" strokeWidth="0.4" strokeDasharray="1.5 2" />
                  <line x1="22" y1="29" x2="78" y2="29" stroke="#b5b0a1" strokeWidth="0.4" strokeDasharray="1.5 2" />
                </svg>
                {COURT_MINI.map((c, i) => (
                  <span
                    key={i}
                    className="absolute flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-[#1a1918] bg-white font-plex text-[8px] font-bold text-[#1a1918] shadow-[0_2px_5px_-2px_rgba(26,25,24,0.4)]"
                    style={{ left: c.x, top: c.y }}
                  >
                    {c.ovr}
                  </span>
                ))}
              </div>
              <div className="px-[18px] py-4">
                <h3 className="m-0 font-display text-[19px] font-bold tracking-[-0.02em]">
                  The Whiteboard
                </h3>
                <p className="mt-1.5 mb-0 text-[13px] leading-[1.5] text-[#57534a]">
                  Drop any five on the court, add an opponent, and read the tale of the tape matchup
                  by matchup.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* API section */}
        <div
          id="api"
          className="mx-auto max-w-[1360px] border-t border-[#e5e2da] px-[clamp(20px,4vw,48px)] py-[clamp(48px,6vw,80px)]"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-start gap-[clamp(32px,5vw,64px)]">
            <div>
              <div className={cn(MONO_LABEL, "mb-3.5")}>THE API</div>
              <h2 className="mt-0 mb-[18px] font-display text-[clamp(30px,3.2vw,40px)] font-bold tracking-[-0.03em] text-[#1a1918]">
                One key.
                <br />
                Every endpoint.
              </h2>
              <p className="mt-0 mb-8 max-w-[400px] text-[16px] leading-[1.6] text-[#57534a]">
                Authenticated with a single header. ETag caching, rate-limit headers, and a public
                no-key endpoint for browser apps.
              </p>
              <div className="flex flex-col gap-2.5">
                {ENDPOINTS.map((e) => (
                  <Link
                    key={e.path}
                    href={e.href}
                    className="flex items-center gap-3 rounded-[10px] border border-[#e5e2da] bg-white px-4 py-3 no-underline transition-[border-color] duration-150 hover:border-[#1a1918]"
                  >
                    <span className="font-plex text-[12px] font-semibold text-[#1a1918]">
                      {e.path}
                    </span>
                    <span className="ml-auto text-[12.5px] text-[#8a8577]">{e.note}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl bg-[#1a1918] shadow-[0_32px_56px_-28px_rgba(26,25,24,0.5)]">
              <div className="flex items-center justify-between border-b border-[#faf9f5]/10 px-5 py-3.5">
                <span className="font-plex text-[11px] tracking-[0.12em] text-[#8a8577]">
                  GET /api/players/slug/lebron-james
                </span>
                <span className="font-plex text-[11px] text-[#8a8577]">200 · 142ms</span>
              </div>
              <div className="overflow-x-auto px-[22px] pt-5 pb-[26px] font-plex text-[13px] leading-[1.8] text-[#f1efe8]">
                <div>
                  <span className="text-[#8a8577]">$</span> curl
                  api.nba2kapi.com/api/players/slug/lebron-james \
                </div>
                <div className="pl-8">
                  -H <span className="text-[#d9bd7c]">&apos;X-API-Key: YOUR_KEY&apos;</span>
                </div>
                <div className="h-3" />
                <div>{"{"}</div>
                <div className="pl-4">
                  &quot;name&quot;: <span className="text-[#d9bd7c]">&quot;LeBron James&quot;</span>,
                </div>
                <div className="pl-4">
                  &quot;team&quot;:{" "}
                  <span className="text-[#d9bd7c]">&quot;Los Angeles Lakers&quot;</span>,
                </div>
                <div className="pl-4">
                  &quot;overall&quot;: <span className="text-[#b79ce0]">94</span>,
                </div>
                <div className="pl-4">
                  &quot;tier&quot;: <span className="text-[#d9bd7c]">&quot;Diamond&quot;</span>,
                </div>
                <div className="pl-4">
                  &quot;positions&quot;: [<span className="text-[#d9bd7c]">&quot;SF&quot;</span>,{" "}
                  <span className="text-[#d9bd7c]">&quot;PF&quot;</span>],
                </div>
                <div className="pl-4">
                  &quot;attributes&quot;: {"{"} &quot;passIQ&quot;:{" "}
                  <span className="text-[#b79ce0]">95</span>,{" "}
                  <span className="text-[#8a8577]">…40 more</span> {"}"},
                </div>
                <div className="pl-4">
                  &quot;badges&quot;: {"{"} &quot;total&quot;:{" "}
                  <span className="text-[#b79ce0]">14</span>,{" "}
                  <span className="text-[#8a8577]">…</span> {"}"}
                </div>
                <div>{"}"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div
          id="cta"
          className="border-t border-[#e5e2da] px-[clamp(20px,4vw,48px)] py-[clamp(56px,7vw,96px)] text-center"
        >
          <h2 className="mt-0 mb-4 font-display text-[clamp(32px,3.6vw,46px)] font-bold tracking-[-0.03em] text-[#1a1918]">
            Ready to build?
          </h2>
          <p className="mx-auto mt-0 mb-9 max-w-[440px] text-[17px] leading-[1.6] text-[#57534a]">
            Get your free API key and start integrating NBA 2K data into your application today.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-[18px]">
            <button
              type="button"
              onClick={handleGetApiKey}
              className={cn(PILL_CTA, "px-7 py-3.5 text-[15px]")}
            >
              {hasApiKey ? "View dashboard" : "Get an API key"}
            </button>
            <Link
              href="/docs"
              className="rounded-full border border-[#d9d4c7] bg-white px-7 py-3.5 text-[15px] font-semibold text-[#1a1918] no-underline transition-[background,transform] duration-150 ease-out hover:bg-[#f1efe8] active:scale-[0.97] motion-reduce:transition-none"
            >
              Read the docs
            </Link>
          </div>
        </div>

        <SiteFooter />
      </div>

      <KeyDialog
        open={showRegistration}
        onOpenChange={setShowRegistration}
        onSuccess={handleRegistrationSuccess}
      />
    </>
  );
}
