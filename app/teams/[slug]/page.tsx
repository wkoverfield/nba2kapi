"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses, getAttributeColor } from "@/lib/rating-colors";
import {
  formatTeamNickname,
  formatTeamShortName,
  getTeamConference,
} from "@/lib/team-abbr";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";
const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
const POSITION_LABELS: Record<string, string> = {
  PG: "PG — POINT GUARD",
  SG: "SG — SHOOTING GUARD",
  SF: "SF — SMALL FORWARD",
  PF: "PF — POWER FORWARD",
  C: "C — CENTER",
};

type RosterPlayer = {
  name: string;
  slug: string;
  overall: number;
  positions?: string[];
  height?: string;
  playerImage?: string;
  attributes?: Record<string, number>;
  badges?: { total?: number; hallOfFame?: number; gold?: number; silver?: number; bronze?: number };
};

/**
 * Assign a roster to five position columns. Primary position wins; an empty
 * column steals the best bench player who can play it.
 */
function buildDepthChart(roster: RosterPlayer[]) {
  const sorted = [...roster].sort((a, b) => b.overall - a.overall);
  const columns: Record<string, RosterPlayer[]> = { PG: [], SG: [], SF: [], PF: [], C: [] };
  for (const p of sorted) {
    const primary = p.positions?.find((pos) => pos in columns);
    columns[primary ?? "SF"].push(p);
  }
  for (const pos of POSITIONS) {
    if (columns[pos].length > 0) continue;
    // Steal the strongest bench player able to play this spot.
    let candidate: { from: string; index: number } | null = null;
    for (const from of POSITIONS) {
      columns[from].forEach((p, index) => {
        if (index === 0) return; // never steal a starter
        if (!p.positions?.includes(pos)) return;
        if (!candidate || p.overall > columns[candidate.from][candidate.index].overall) {
          candidate = { from, index };
        }
      });
    }
    if (candidate !== null) {
      const c: { from: string; index: number } = candidate;
      columns[pos].push(columns[c.from].splice(c.index, 1)[0]);
    }
  }
  return columns;
}

/** Data-driven strength / neutral / weakness reads. */
function teamReads(roster: RosterPlayer[]) {
  const sorted = [...roster].sort((a, b) => b.overall - a.overall);
  const reads: { title: string; color: string; body: string }[] = [];

  // Lens 1: top end
  const [a, b, c] = sorted;
  if (a && b) {
    const topAvg = (a.overall + b.overall) / 2;
    const drop = c ? b.overall - c.overall : 0;
    const color = topAvg >= 93 ? "#0a7f3f" : topAvg >= 88 ? "#9a6700" : "#c03a2b";
    const title = topAvg >= 93 ? "ELITE TOP END" : topAvg >= 88 ? "SOLID TOP END" : "NO STAR POWER";
    reads.push({
      title,
      color,
      body: `${a.name} (${a.overall}) and ${b.name} (${b.overall}) lead${
        c ? `, ${drop >= 8 ? `then a ${drop}-point drop to` : "ahead of"} ${c.name} at ${c.overall}` : ""
      }.`,
    });
  }

  // Lens 2: shooting
  const shooters = roster
    .map((p) => ({ name: p.name, tpt: p.attributes?.threePointShot }))
    .filter((p): p is { name: string; tpt: number } => typeof p.tpt === "number")
    .sort((x, y) => y.tpt - x.tpt);
  if (shooters.length) {
    const best = shooters[0];
    const over85 = shooters.filter((s) => s.tpt >= 85).length;
    const color = over85 >= 3 ? "#0a7f3f" : over85 >= 1 ? "#9a6700" : "#c03a2b";
    const title = over85 >= 3 ? "REAL SHOOTING" : over85 >= 1 ? "AVERAGE SHOOTING" : "CRAMPED SPACING";
    reads.push({
      title,
      color,
      body: `${over85} player${over85 === 1 ? "" : "s"} shoot${over85 === 1 ? "s" : ""} 85+ from three; ${best.name} is the best at ${best.tpt}.`,
    });
  }

  // Lens 3: rim protection
  const bigs = roster.filter((p) => p.positions?.some((pos) => pos === "PF" || pos === "C"));
  const anchors = bigs
    .map((p) => ({ name: p.name, int: p.attributes?.interiorDefense }))
    .filter((p): p is { name: string; int: number } => typeof p.int === "number")
    .sort((x, y) => y.int - x.int);
  const centers = roster.filter((p) => p.positions?.includes("C")).length;
  if (anchors.length) {
    const best = anchors[0];
    const color = best.int >= 90 ? "#0a7f3f" : best.int >= 80 ? "#9a6700" : "#c03a2b";
    const title = best.int >= 90 ? "PAINT PROTECTED" : best.int >= 80 ? "SERVICEABLE RIM PROTECTION" : "THIN RIM PROTECTION";
    reads.push({
      title,
      color,
      body: `${best.name} anchors the paint at ${best.int} interior defense; ${centers} true center${centers === 1 ? "" : "s"} on the roster.`,
    });
  }

  return reads;
}

function OvrChip({ ovr, size = "sm" }: { ovr: number; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[6px] font-bold text-white tabular-nums",
        size === "md" ? "min-w-[34px] rounded-[7px] px-[5px] py-1 text-[14px]" : "min-w-[27px] rounded-[5px] px-1 py-0.5 text-[10.5px]",
        getRatingClasses(ovr).bg
      )}
    >
      {ovr}
    </span>
  );
}

function TeamLogo({ src, team, size }: { src: string | null; team: string; size: number }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) return null;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={team}
        fill
        sizes={`${size}px`}
        className="object-contain"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

function attr(p: RosterPlayer, key: string): number | null {
  return typeof p.attributes?.[key] === "number" ? p.attributes[key] : null;
}

function AttrCell({ value }: { value: number | null }) {
  return (
    <span
      className="text-center text-[12.5px] font-bold tabular-nums"
      style={{ color: value === null ? "#b5b0a1" : getAttributeColor(value) }}
    >
      {value ?? "—"}
    </span>
  );
}

function TeamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const typeParam = searchParams.get("type");
  const era: TeamType = typeParam === "class" || typeParam === "allt" ? typeParam : "curr";

  const [view, setView] = useState<"depth" | "table">("depth");
  const [hasApiKey, setHasApiKey] = useState(false);

  const teamInfo = useQuery(api.teams.getTeamBySlug, { slug, teamType: era });
  const roster = useQuery(
    api.players.getPlayersByTeam,
    teamInfo?.name ? { team: teamInfo.name, teamType: era } : "skip"
  ) as RosterPlayer[] | undefined;
  const board = useQuery(api.teams.getBoard, { teamType: era });

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  const boardIndex = board?.findIndex((t) => t.slug === slug) ?? -1;
  const prevTeam = board && boardIndex >= 0 ? board[(boardIndex - 1 + board.length) % board.length] : null;
  const nextTeam = board && boardIndex >= 0 ? board[(boardIndex + 1) % board.length] : null;

  // 2K-style ←/→ team cycling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft" && prevTeam) router.push(`/teams/${prevTeam.slug}?type=${era}`);
      if (e.key === "ArrowRight" && nextTeam) router.push(`/teams/${nextTeam.slug}?type=${era}`);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevTeam, nextTeam, era, router]);

  const depth = useMemo(() => (roster ? buildDepthChart(roster) : null), [roster]);

  // Exactly one 6th man: the single best bench player (reference identity —
  // OVR ties and duplicate names must not multiply the tag).
  const sixthMan = useMemo(() => {
    if (!depth) return null;
    let best: RosterPlayer | null = null;
    for (const pos of POSITIONS) {
      for (const p of depth[pos].slice(1)) {
        if (!best || p.overall > best.overall) best = p;
      }
    }
    return best;
  }, [depth]);
  const reads = useMemo(() => (roster ? teamReads(roster) : []), [roster]);
  const tableRows = useMemo(
    () => (roster ? [...roster].sort((a, b) => b.overall - a.overall) : []),
    [roster]
  );

  const logo = useMemo(() => {
    const withLogo = roster?.find((p) => (p as RosterPlayer & { teamImg?: string }).teamImg);
    return (withLogo as (RosterPlayer & { teamImg?: string }) | undefined)?.teamImg ?? null;
  }, [roster]);

  const avg = roster && roster.length ? Math.round((roster.reduce((s, p) => s + p.overall, 0) / roster.length) * 10) / 10 : null;
  const rated90 = roster ? roster.filter((p) => p.overall >= 90).length : 0;
  const bestOverall = tableRows[0]?.overall;

  const exportCsv = () => {
    if (!roster || !teamInfo) return;
    const header = "name,slug,positions,height,overall,three_ball,speed,driving_dunk,perimeter_defense,badges";
    const lines = tableRows.map((p) =>
      [
        `"${p.name.replace(/"/g, '""')}"`,
        p.slug,
        `"${(p.positions ?? []).join("/")}"`,
        p.height ?? "",
        p.overall,
        attr(p, "threePointShot") ?? "",
        attr(p, "speed") ?? "",
        attr(p, "drivingDunk") ?? "",
        attr(p, "perimeterDefense") ?? "",
        p.badges?.total ?? "",
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-roster.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${tableRows.length} players`);
  };

  const notFoundState = teamInfo === null;

  const pillClass =
    "inline-flex items-center gap-2 rounded-full border border-[#e5e2da] bg-white no-underline transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none";

  const tableGrid =
    "grid grid-cols-[40px_30px_minmax(160px,1.4fr)_56px_56px_66px_repeat(4,50px)_70px] items-center gap-2.5 px-[18px]";

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav hasApiKey={hasApiKey} />

      <div className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2">
        {/* Back + cycling */}
        <div className="flex flex-wrap items-center justify-between gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          <Link
            href={era === "curr" ? "/teams" : `/teams?era=${era}`}
            className="inline-flex items-center gap-2 font-plex text-[10.5px] tracking-[0.1em] text-[#8a8577] no-underline transition-colors duration-150 hover:text-[#1a1918]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
            BACK TO THE BOARD
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {prevTeam && (
              <Link href={`/teams/${prevTeam.slug}?type=${era}`} className={cn(pillClass, "py-1.5 pr-3.5 pl-2.5")}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <TeamLogo src={prevTeam.logo} team={prevTeam.team} size={20} />
                <span className="font-plex text-[10px] tracking-[0.06em] text-[#57534a]">
                  <b className="text-[#1a1918]">
                    #{((boardIndex - 1 + (board?.length ?? 1)) % (board?.length ?? 1)) + 1}
                  </b>{" "}
                  {formatTeamNickname(prevTeam.team, era).toUpperCase()}
                </span>
              </Link>
            )}
            {nextTeam && (
              <Link href={`/teams/${nextTeam.slug}?type=${era}`} className={cn(pillClass, "py-1.5 pr-2.5 pl-3.5")}>
                <span className="font-plex text-[10px] tracking-[0.06em] text-[#57534a]">
                  <b className="text-[#1a1918]">#{((boardIndex + 1) % (board?.length ?? 1)) + 1}</b>{" "}
                  {formatTeamNickname(nextTeam.team, era).toUpperCase()}
                </span>
                <TeamLogo src={nextTeam.logo} team={nextTeam.team} size={20} />
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            )}
            <span className="font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]">OR ← → KEYS</span>
          </div>
        </div>

        {notFoundState ? (
          <div className="py-24 text-center">
            <h1 className="m-0 font-display text-[28px] font-extrabold">Team not found</h1>
            <p className="mt-2 text-[14px] text-[#8a8577]">
              No {era === "curr" ? "current" : era === "class" ? "classic" : "all-time"} team matches
              &quot;{slug}&quot;.
            </p>
          </div>
        ) : (
          <>
            {/* Identity + stat cards */}
            <div
              className="mt-[18px] flex flex-wrap items-center justify-between gap-[18px] animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
              style={{ animationDelay: "60ms" }}
            >
              <div className="flex items-center gap-4">
                {logo && <TeamLogo src={logo} team={teamInfo?.name ?? slug} size={58} />}
                <div>
                  <h1 className="m-0 font-display text-[clamp(26px,3vw,36px)] leading-none font-extrabold tracking-[-0.03em]">
                    {teamInfo?.name ?? "…"}
                  </h1>
                  <p className="mt-1.5 mb-0 font-plex text-[9.5px] tracking-[0.1em] text-[#8a8577]">
                    {era === "curr" ? "CURRENT" : era === "class" ? "CLASSIC" : "ALL-TIME"} ·{" "}
                    {teamInfo?.name ? (getTeamConference(teamInfo.name) ?? "—") : "—"} ·{" "}
                    <b className="text-[#1a1918]">
                      {boardIndex >= 0 ? `#${boardIndex + 1} ON THE BOARD` : "ON THE BOARD"}
                    </b>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="rounded-xl border border-[#e5e2da] bg-white px-4 py-2.5">
                  <div className="font-display text-[22px] leading-none font-extrabold">
                    {avg ?? "—"}
                  </div>
                  <div className="mt-[3px] font-plex text-[7.5px] tracking-[0.08em] text-[#8a8577]">
                    ROSTER AVG
                  </div>
                </div>
                <div className="rounded-xl border border-[#e5e2da] bg-white px-4 py-2.5">
                  <div className="font-display text-[22px] leading-none font-extrabold">
                    {roster?.length ?? "—"}
                  </div>
                  <div className="mt-[3px] font-plex text-[7.5px] tracking-[0.08em] text-[#8a8577]">
                    PLAYERS
                  </div>
                </div>
                <div className="rounded-xl border border-[#e5e2da] bg-white px-4 py-2.5">
                  <div className="font-display text-[22px] leading-none font-extrabold">{rated90}</div>
                  <div className="mt-[3px] font-plex text-[7.5px] tracking-[0.08em] text-[#8a8577]">
                    RATED 90+
                  </div>
                </div>
                <span className="rounded-full border border-[#e5e2da] bg-white px-3.5 py-2 font-plex text-[9.5px] text-[#8a8577]">
                  GET /api/teams/{slug}/roster{era !== "curr" ? `?teamType=${era}` : ""}
                </span>
              </div>
            </div>

            {/* View toggle */}
            <div
              className="mt-[26px] flex flex-wrap items-center justify-between gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
              style={{ animationDelay: "120ms" }}
            >
              <span className="font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]">
                {view === "depth"
                  ? "DEPTH CHART — TOP CARD IS THE STARTER, ROWS BELOW ARE THE DEPTH IN ORDER"
                  : "FULL ROSTER — EVERY COLUMN MAPS TO AN API FIELD"}
              </span>
              <div className="flex gap-[3px] rounded-full border border-[#e5e2da] bg-white p-1">
                {(["depth", "table"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={cn(
                      "cursor-pointer rounded-full px-4 py-[7px] text-[12.5px] font-semibold transition-[background,color,transform] duration-150 select-none active:scale-[0.97] motion-reduce:transition-none",
                      view === v ? "bg-[#1a1918] text-[#faf9f5]" : "text-[#57534a] hover:bg-[#f1efe8]"
                    )}
                  >
                    {v === "depth" ? "Depth chart" : "Table"}
                  </button>
                ))}
              </div>
            </div>

            {/* Depth chart */}
            {view === "depth" && (
              <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                {POSITIONS.map((pos, ci) => {
                  const players = depth?.[pos] ?? [];
                  const starter = players[0];
                  return (
                    <div
                      key={pos}
                      className="animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
                      style={{ animationDelay: `${140 + ci * 45}ms` }}
                    >
                      <div className="mb-2.5 rounded-full bg-[#f1efe8] py-[5px] text-center font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]">
                        {POSITION_LABELS[pos]}
                      </div>
                      {starter ? (
                        <Link
                          href={`/players/${starter.slug}`}
                          className="relative block overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white text-[#1a1918] no-underline transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-[#1a1918] hover:shadow-[0_14px_28px_-18px_rgba(26,25,24,0.3)] active:scale-[0.98] motion-reduce:transition-none"
                        >
                          <div className="relative h-[118px] bg-[#f1efe8]">
                            {starter.playerImage && (
                              <Image
                                src={starter.playerImage}
                                alt={starter.name}
                                fill
                                sizes="220px"
                                className="object-cover object-top"
                              />
                            )}
                            {starter.overall === bestOverall && (
                              <span className="absolute top-2 left-2 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#f5c518,#b8860b)] text-[11px] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
                                ★
                              </span>
                            )}
                            <span
                              className={cn(
                                "absolute top-2 right-2 inline-flex min-w-[34px] items-center justify-center rounded-[7px] px-[5px] py-1 text-[14px] font-bold text-white tabular-nums",
                                getRatingClasses(starter.overall).bg
                              )}
                            >
                              {starter.overall}
                            </span>
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="m-0 overflow-hidden text-[13.5px] font-bold text-ellipsis whitespace-nowrap">
                              {starter.name}
                            </p>
                            <p className="mt-[3px] mb-0 font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">
                              STARTER{starter.height ? ` · ${starter.height}` : ""}
                            </p>
                          </div>
                        </Link>
                      ) : (
                        <div className="rounded-[14px] border border-dashed border-[#e5e2da] py-10 text-center font-plex text-[9px] text-[#b5b0a1]">
                          {roster ? "NO PLAYER" : "…"}
                        </div>
                      )}
                      {players.slice(1).map((p, i) => {
                        const isSixth = p === sixthMan;
                        return (
                          <Link
                            key={`${p.slug}-${i}`}
                            href={`/players/${p.slug}`}
                            className={cn(
                              "mt-1.5 flex items-center gap-[9px] rounded-[11px] border border-[#e5e2da] bg-white text-[#1a1918] no-underline transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.98] motion-reduce:transition-none",
                              i === 0 ? "px-2.5 py-2" : "px-2.5 py-1.5"
                            )}
                          >
                            <Headshot src={p.playerImage} name={p.name} size={i === 0 ? 30 : 24} />
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "m-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap",
                                  i === 0 ? "text-[12.5px]" : "text-[11.5px]"
                                )}
                              >
                                {p.name}
                              </p>
                              <p
                                className="mt-px mb-0 font-plex text-[7.5px] tracking-[0.06em]"
                                style={{ color: isSixth ? "#9a6700" : "#8a8577" }}
                              >
                                {isSixth ? "6TH MAN" : i === 0 ? "2ND UNIT" : "DEPTH"}
                              </p>
                            </div>
                            <OvrChip ovr={p.overall} />
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table */}
            {view === "table" && (
              <div className="mt-3.5 overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white animate-[rise-in_300ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className={cn(tableGrid, "border-b border-[#e5e2da] bg-[#faf9f5] py-2.5")}>
                      <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">#</span>
                      <span />
                      <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">PLAYER</span>
                      <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">POS</span>
                      <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">HT</span>
                      <span className="font-plex text-[8.5px] font-bold tracking-[0.08em] text-[#1a1918]">OVR ↓</span>
                      {["3PT", "SPD", "DNK", "DEF"].map((h) => (
                        <span key={h} className="text-center font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">
                          {h}
                        </span>
                      ))}
                      <span className="text-right font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">BADGES</span>
                    </div>
                    {tableRows.map((p, i) => (
                      <Link
                        key={`${p.slug}-${i}`}
                        href={`/players/${p.slug}`}
                        className={cn(
                          tableGrid,
                          "border-b border-[#faf8f2] py-2 text-[#1a1918] no-underline transition-colors duration-100 hover:bg-[#faf8f2]"
                        )}
                      >
                        <span className="font-plex text-[10px] text-[#b5b0a1]">{i + 1}</span>
                        <Headshot src={p.playerImage} name={p.name} size={28} />
                        <span className="overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap">
                          {p.name}
                        </span>
                        <span className="font-plex text-[10px] text-[#57534a]">
                          {(p.positions ?? []).join("/")}
                        </span>
                        <span className="font-plex text-[10px] text-[#57534a]">{p.height ?? "—"}</span>
                        <span
                          className={cn(
                            "inline-flex w-[34px] items-center justify-center rounded-[6px] py-[3px] text-[12px] font-bold text-white tabular-nums",
                            getRatingClasses(p.overall).bg
                          )}
                        >
                          {p.overall}
                        </span>
                        <AttrCell value={attr(p, "threePointShot")} />
                        <AttrCell value={attr(p, "speed")} />
                        <AttrCell value={attr(p, "drivingDunk")} />
                        <AttrCell value={attr(p, "perimeterDefense")} />
                        <span className="text-right font-plex text-[10.5px] text-[#57534a]">
                          {p.badges?.total ?? "—"}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf9f5] px-[18px] py-[9px]">
                  <span className="font-plex text-[8.5px] text-[#b5b0a1]">CLICK A ROW → DOSSIER</span>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="cursor-pointer font-plex text-[8.5px] text-[#b5b0a1] transition-colors duration-150 hover:text-[#1a1918]"
                  >
                    EXPORT CSV
                  </button>
                </div>
              </div>
            )}

            {/* Team reads */}
            {reads.length > 0 && (
              <div
                className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
                style={{ animationDelay: "200ms" }}
              >
                {reads.map((r) => (
                  <div key={r.title} className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
                    <div
                      className="mb-1.5 font-plex text-[8.5px] font-bold tracking-[0.12em]"
                      style={{ color: r.color }}
                    >
                      {r.title}
                    </div>
                    <p className="m-0 text-[12.5px] leading-[1.55] text-[#57534a]">{r.body}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-12">
        <FooterStrip />
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <Suspense fallback={null}>
      <TeamPage />
    </Suspense>
  );
}
