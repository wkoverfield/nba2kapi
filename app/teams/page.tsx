"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses } from "@/lib/rating-colors";
import { getTeamAbbreviation, getTeamConference, formatTeamShortName } from "@/lib/team-abbr";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";

const ERA_TABS: { label: string; param: TeamType }[] = [
  { label: "Current", param: "curr" },
  { label: "Classic", param: "class" },
  { label: "All-Time", param: "allt" },
];

function TeamLogo({ src, team }: { src: string | null; team: string }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#f1efe8] font-display text-[10px] font-extrabold text-[#57534a]">
        {getTeamAbbreviation(team)}
      </div>
    );
  }
  return (
    <div className="relative h-[34px] w-[34px]">
      <Image
        src={src}
        alt={team}
        fill
        sizes="34px"
        className="object-contain"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

function Board() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eraParam = searchParams.get("era");
  const era: TeamType = ERA_TABS.some((t) => t.param === eraParam)
    ? (eraParam as TeamType)
    : "curr";
  const [hasApiKey, setHasApiKey] = useState(false);

  const board = useQuery(api.teams.getBoard, { teamType: era });

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  const setEra = (next: TeamType) =>
    router.replace(next === "curr" ? "/teams" : `/teams?era=${next}`, { scroll: false });

  // Bar widths normalized the way the design does: floor sits 1.5 below the
  // weakest roster so the spread reads clearly.
  const min = board && board.length ? Math.min(...board.map((t) => t.avgRating)) - 1.5 : 0;
  const max = board && board.length ? Math.max(...board.map((t) => t.avgRating)) : 1;

  const rowGrid =
    "grid grid-cols-[56px_44px_minmax(160px,1.2fr)_60px_minmax(180px,1.6fr)_60px_minmax(170px,1fr)] items-center gap-3 px-[22px]";

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav hasApiKey={hasApiKey} width="narrow" />

      <div className="mx-auto max-w-[1280px] px-[clamp(20px,4vw,48px)] pt-3.5">
        <div className="flex flex-wrap items-end justify-between gap-4 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          <div>
            <h1 className="m-0 font-display text-[clamp(30px,3.4vw,40px)] font-extrabold tracking-[-0.03em]">
              The board
            </h1>
            <p className="mt-1.5 mb-0 font-plex text-[10px] tracking-[0.1em] text-[#8a8577]">
              EVERY TEAM RANKED BY RATING STRENGTH — NOT STANDINGS
            </p>
          </div>
          <div className="flex gap-[3px] rounded-full border border-[#e5e2da] bg-white p-1">
            {ERA_TABS.map((t) => (
              <button
                key={t.param}
                type="button"
                onClick={() => setEra(t.param)}
                className={cn(
                  "cursor-pointer rounded-full px-4 py-[7px] text-[12.5px] font-semibold transition-[background,color,transform] duration-150 select-none active:scale-[0.97] motion-reduce:transition-none",
                  era === t.param ? "bg-[#1a1918] text-[#faf9f5]" : "text-[#57534a] hover:bg-[#f1efe8]"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-5 overflow-hidden rounded-2xl border border-[#e5e2da] bg-white animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
          style={{ animationDelay: "80ms" }}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className={cn(rowGrid, "border-b border-[#e5e2da] bg-[#faf9f5] py-[11px]")}>
                <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">RANK</span>
                <span />
                <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">TEAM</span>
                <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">CONF</span>
                <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">
                  ROSTER STRENGTH — AVG RATING OF FULL ROSTER
                </span>
                <span className="font-plex text-[8.5px] font-bold tracking-[0.08em] text-[#1a1918]">
                  AVG ↓
                </span>
                <span className="font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">
                  BEST PLAYER
                </span>
              </div>

              {board
                ? board.map((t, i) => (
                    <Link
                      key={t.team}
                      href={`/teams/${t.slug}?type=${era}`}
                      className={cn(
                        rowGrid,
                        "border-b border-[#f6f4ee] py-2.5 text-[#1a1918] no-underline transition-colors duration-100 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] hover:bg-[#faf8f2] active:scale-[0.995] motion-reduce:animate-none"
                      )}
                      style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
                    >
                      <span className="font-display text-[19px] font-extrabold text-[#b5b0a1]">
                        {i + 1}
                      </span>
                      <TeamLogo src={t.logo} team={t.team} />
                      <span className="overflow-hidden text-[14.5px] font-semibold text-ellipsis whitespace-nowrap">
                        {formatTeamShortName(t.team, era)}
                      </span>
                      <span className="font-plex text-[9px] text-[#b5b0a1]">
                        {getTeamConference(t.team) ?? "—"}
                      </span>
                      <div className="h-2 rounded-full bg-[#f1efe8]">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(to_right,#8a8577,#1a1918)] transition-[width] duration-400"
                          style={{
                            width: `${Math.round(((t.avgRating - min) / (max - min)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="font-plex text-[13px] font-bold tabular-nums">
                        {t.avgRating.toFixed(1)}
                      </span>
                      <div className="flex min-w-0 items-center gap-2">
                        <Headshot
                          src={t.bestPlayer.playerImage}
                          name={t.bestPlayer.name}
                          size={26}
                        />
                        <span className="flex-1 overflow-hidden text-[12px] font-semibold text-ellipsis whitespace-nowrap">
                          {t.bestPlayer.name}
                        </span>
                        <span
                          className={cn(
                            "inline-flex min-w-[30px] items-center justify-center rounded-[5px] px-1 py-0.5 text-[11px] font-bold text-white tabular-nums",
                            getRatingClasses(t.bestPlayer.overall).bg
                          )}
                        >
                          {t.bestPlayer.overall}
                        </span>
                      </div>
                    </Link>
                  ))
                : Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className={cn(rowGrid, "animate-pulse border-b border-[#f6f4ee] py-2.5")}>
                      <span className="h-5 w-6 rounded bg-[#f1efe8]" />
                      <div className="h-[34px] w-[34px] rounded-full bg-[#f1efe8]" />
                      <span className="h-3.5 w-3/4 rounded bg-[#f1efe8]" />
                      <span className="h-3 w-8 rounded bg-[#f1efe8]" />
                      <span className="h-2 rounded-full bg-[#f1efe8]" />
                      <span className="h-3.5 w-9 rounded bg-[#f1efe8]" />
                      <span className="h-[26px] w-2/3 rounded-full bg-[#f1efe8]" />
                    </div>
                  ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf9f5] px-[22px] py-2.5">
            <span className="font-plex text-[8.5px] text-[#b5b0a1]">
              CLICK A TEAM → DEPTH CHART · ← → CYCLES TEAMS FROM ANY TEAM PAGE
            </span>
            <span className="font-plex text-[8.5px] text-[#b5b0a1]">GET /api/teams?era={era}</span>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <FooterStrip width="narrow" />
      </div>
    </div>
  );
}

export default function TeamsPage() {
  return (
    <Suspense fallback={null}>
      <Board />
    </Suspense>
  );
}
