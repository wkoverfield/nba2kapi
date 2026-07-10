"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses, getRatingTier, getAttributeColor } from "@/lib/rating-colors";
import { getTeamAbbreviation, formatTeamNickname } from "@/lib/team-abbr";
import { ATTRIBUTE_CATEGORIES } from "@/convex/attributeCategories";
import { getAttributeDisplayName } from "@/lib/attribute-normalizer";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";

const CARD_LABEL = "font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]";

const CATEGORY_LABELS: Record<string, string> = {
  outsideScoring: "OUTSIDE",
  insideScoring: "INSIDE",
  playmaking: "PLAYMAKING",
  athleticism: "ATHLETICISM",
  defending: "DEFENSE",
  rebounding: "REBOUNDING",
};

const MATRIX_LABELS: Record<string, string> = {
  outsideScoring: "OUTSIDE SCORING",
  insideScoring: "INSIDE SCORING",
  playmaking: "PLAYMAKING",
  athleticism: "ATHLETICISM",
  defending: "DEFENDING",
  rebounding: "REBOUNDING",
};

const RADAR_AXES: { key: string; label: string }[] = [
  { key: "overall", label: "OVR" },
  { key: "insideScoring", label: "INS" },
  { key: "outsideScoring", label: "OUT" },
  { key: "athleticism", label: "ATH" },
  { key: "playmaking", label: "PLY" },
  { key: "rebounding", label: "REB" },
  { key: "defending", label: "DEF" },
];

// Attributes too generic to headline as signature stats or scouting reads
const SIGNATURE_EXCLUDE = new Set([
  "stamina",
  "durability",
  "hustle",
  "hands",
  "offensiveConsistency",
  "defensiveConsistency",
]);

const TIER_ORDER = ["Legendary", "Hall of Fame", "Gold", "Silver", "Bronze"];
const TIER_STYLES: Record<string, string> = {
  Legendary: "overall-dark-matter",
  "Hall of Fame": "overall-amethyst",
  Gold: "overall-gold",
  Silver: "overall-silver",
  Bronze: "bg-[linear-gradient(#a9743b,#6d4420)]",
};

const TIER_CUTOFFS = [99, 97, 95, 92, 90, 87, 84, 80, 75, 70];

function slugifyTeam(team: string) {
  return team.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function shortPlayerLabel(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].toUpperCase();
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`.toUpperCase();
}

function pctColor(pct: number) {
  return pct >= 85 ? "#0a7f3f" : pct >= 50 ? "#9a6700" : "#c03a2b";
}

function ordinal(n: number) {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${rem10 === 1 ? "st" : rem10 === 2 ? "nd" : rem10 === 3 ? "rd" : "th"}`;
}

function PlayerDossier() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const typeParam = searchParams.get("type");
  const teamParam = searchParams.get("team");
  const requestedType: TeamType | undefined =
    typeParam === "curr" || typeParam === "class" || typeParam === "allt" ? typeParam : undefined;

  const [hasApiKey, setHasApiKey] = useState(false);
  const dossier = useQuery(api.dossier.getDossier, {
    slug,
    teamType: requestedType,
    team: teamParam ?? undefined,
  });

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  const player = dossier?.player;
  const era = (player?.teamType ?? requestedType ?? "curr") as TeamType;

  // Roster cycling
  const rosterIndex = useMemo(() => {
    if (!dossier) return -1;
    return dossier.roster.findIndex((p) => p.slug === slug);
  }, [dossier, slug]);
  const prevPlayer =
    dossier && rosterIndex >= 0
      ? dossier.roster[(rosterIndex - 1 + dossier.roster.length) % dossier.roster.length]
      : null;
  const nextPlayer =
    dossier && rosterIndex >= 0
      ? dossier.roster[(rosterIndex + 1) % dossier.roster.length]
      : null;

  const teamQuery = player ? `&team=${encodeURIComponent(player.team)}` : "";

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft" && prevPlayer) router.push(`/players/${prevPlayer.slug}?type=${era}${teamQuery}`);
      if (e.key === "ArrowRight" && nextPlayer) router.push(`/players/${nextPlayer.slug}?type=${era}${teamQuery}`);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevPlayer, nextPlayer, era, teamQuery, router]);

  // Signature stats: three best interesting attributes
  const signature = useMemo(() => {
    if (!dossier) return [];
    return Object.entries(dossier.attrStats)
      .filter(([key]) => !SIGNATURE_EXCLUDE.has(key))
      .sort((a, b) => b[1].value - a[1].value || b[1].pct - a[1].pct)
      .slice(0, 3)
      .map(([key, s]) => ({
        key,
        value: s.value,
        label: getAttributeDisplayName(key).toUpperCase(),
        note: `${ordinal(s.pct).toUpperCase()} PCTL${dossier.primaryPosition ? ` · ${dossier.primaryPosition}` : ""}`,
      }));
  }, [dossier]);

  // Scouting read: best / worst by cohort percentile
  const { pros, cons } = useMemo(() => {
    if (!dossier) return { pros: [], cons: [] };
    const entries = Object.entries(dossier.attrStats)
      .filter(([key]) => !SIGNATURE_EXCLUDE.has(key))
      .sort((a, b) => b[1].pct - a[1].pct);
    const pos = dossier.primaryPosition ?? "position";
    const line = ([key, s]: (typeof entries)[number]) =>
      `${getAttributeDisplayName(key)} ${s.value} — ${ordinal(s.pct)} percentile among ${pos}s.`;
    return {
      pros: entries.slice(0, 3).map(line),
      cons: entries.slice(-3).reverse().map(line),
    };
  }, [dossier]);

  // History chart geometry
  const historyChart = useMemo(() => {
    if (!dossier || dossier.history.length < 2) return null;
    const values = dossier.history.map((h) => h.overall);
    const min = Math.min(...values) - 0.5;
    const max = Math.max(...values) + 0.5;
    const sx = (i: number) => 24 + (i / (values.length - 1)) * 372;
    const sy = (v: number) => 130 - ((v - min) / (max - min)) * 105;
    const cutoff = TIER_CUTOFFS.find((c) => c > min && c <= max + 0.5) ?? null;
    const labelIdx = [0, Math.floor((values.length - 1) / 2), values.length - 1];
    return {
      line: values.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" "),
      dots: values.map((v, i) => ({ x: sx(i), y: sy(v) })),
      band: cutoff !== null ? { y: sy(cutoff), label: `${cutoff} — ${getRatingTier(cutoff).toUpperCase()}` } : null,
      ticks: [...new Set(labelIdx)].map((i) => ({
        x: sx(i),
        label: dossier.history[i].date.slice(5).replace("-", "/"),
      })),
      delta: values[values.length - 1] - values[0],
    };
  }, [dossier]);

  // Radar geometry
  const radar = useMemo(() => {
    if (!dossier || !player) return null;
    const byKey = Object.fromEntries(dossier.categories.map((c) => [c.key, c.score]));
    const axes = RADAR_AXES.map((a) => ({
      ...a,
      value: a.key === "overall" ? player.overall : (byKey[a.key] as number | null),
    }));
    const cx = 105;
    const cy = 92;
    const r = 62;
    const pt = (i: number, rr: number) => {
      const angle = ((i * (360 / axes.length) - 90) * Math.PI) / 180;
      return { x: +(cx + rr * Math.cos(angle)).toFixed(1), y: +(cy + rr * Math.sin(angle)).toFixed(1) };
    };
    const rings = [0.5, 1].map((f) =>
      axes.map((_, i) => {
        const p = pt(i, r * f);
        return `${p.x},${p.y}`;
      }).join(" ")
    );
    const dots = axes.map((a, i) => pt(i, ((a.value ?? 0) / 99) * r));
    const path = dots.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
    const ticks = axes.map((a, i) => {
      const p = pt(i, r + 14);
      const dx = p.x - cx;
      return {
        label: a.label,
        value: a.value ?? "—",
        x: p.x,
        y: p.y,
        anchor: (Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end") as "middle" | "start" | "end",
      };
    });
    return { rings, dots, path, ticks };
  }, [dossier, player]);

  const badgeShelf = useMemo(() => {
    if (!dossier) return [];
    const byTier = new Map<string, { name: string; slug: string }[]>();
    for (const b of dossier.badges) {
      if (!byTier.has(b.tier)) byTier.set(b.tier, []);
      byTier.get(b.tier)!.push(b);
    }
    return TIER_ORDER.filter((t) => byTier.has(t)).map((t) => ({
      tier: t,
      chips: byTier.get(t)!,
    }));
  }, [dossier]);

  const percRows = useMemo(() => {
    if (!dossier || !player) return [];
    return [
      { label: "OVERALL", pct: dossier.overallPct },
      ...dossier.categories
        .filter((c) => c.pct !== null)
        .map((c) => ({ label: CATEGORY_LABELS[c.key], pct: c.pct as number })),
    ];
  }, [dossier, player]);

  if (dossier === null) {
    return (
      <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
        <TopNav hasApiKey={hasApiKey} />
        <div className="py-24 text-center">
          <h1 className="m-0 font-display text-[28px] font-extrabold">Player not found</h1>
          <p className="mt-2 text-[14px] text-[#8a8577]">
            No player matches &quot;{slug}&quot;.{" "}
            <Link href="/playground" className="text-[#1a1918] underline">
              Search the playground
            </Link>
            .
          </p>
        </div>
        <FooterStrip />
      </div>
    );
  }

  const abbr = player ? getTeamAbbreviation(player.team) : "";
  const tier = player ? getRatingTier(player.overall) : "";
  const teamSlug = player ? slugifyTeam(player.team) : "";
  const badgesTotal = player?.badgeCounts?.total ?? dossier?.badges.length ?? 0;
  const pillClass =
    "inline-flex items-center gap-2 rounded-full border border-[#e5e2da] bg-white no-underline transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none";

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#fffdf8,#faf9f5_400px)] font-body text-[#1a1918]">
      <TopNav hasApiKey={hasApiKey} />

      <div className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2">
        {/* Back + roster cycling */}
        <div className="flex flex-wrap items-center justify-between gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          {player ? (
            <Link
              href={`/teams/${teamSlug}?type=${era}`}
              className="inline-flex items-center gap-2 font-plex text-[10.5px] tracking-[0.1em] text-[#8a8577] no-underline transition-colors duration-150 hover:text-[#1a1918]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
              {formatTeamNickname(player.team, era).toUpperCase()} DEPTH CHART
            </Link>
          ) : (
            <span className="h-4 w-44 animate-pulse rounded bg-[#f1efe8]" />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {prevPlayer && (
              <Link href={`/players/${prevPlayer.slug}?type=${era}${teamQuery}`} className={cn(pillClass, "py-1.5 pr-3.5 pl-2.5")}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
                <span className="font-plex text-[10px] tracking-[0.06em] text-[#57534a]">
                  {shortPlayerLabel(prevPlayer.name)} · {prevPlayer.overall}
                </span>
              </Link>
            )}
            {nextPlayer && (
              <Link href={`/players/${nextPlayer.slug}?type=${era}${teamQuery}`} className={cn(pillClass, "py-1.5 pr-2.5 pl-3.5")}>
                <span className="font-plex text-[10px] tracking-[0.06em] text-[#57534a]">
                  {shortPlayerLabel(nextPlayer.name)} · {nextPlayer.overall}
                </span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8a8577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            )}
            <span className="font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]">
              CYCLE THE ROSTER · ← →
            </span>
          </div>
        </div>

        {/* Tier card + right column */}
        <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-[22px]">
          {/* MyTeam tier card */}
          <div
            className={cn(
              "relative min-h-[460px] max-w-[420px] overflow-hidden rounded-[22px] shadow-[0_30px_50px_-24px_rgba(26,25,24,0.45)] animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none",
              player ? getRatingClasses(player.overall).bg : "bg-[#f1efe8]"
            )}
            style={{ animationDelay: "60ms" }}
          >
            {player && (
              <>
                <div className="absolute top-5 left-[22px] z-[2]">
                  <div className="font-plex text-[9.5px] tracking-[0.14em] text-white/85">
                    {tier.toUpperCase()} · {player.positions.join("/")} · {abbr}
                  </div>
                  <div className="mt-1.5 font-display text-[76px] leading-none font-extrabold text-white [text-shadow:0_3px_16px_rgba(0,0,0,0.35)]">
                    {player.overall}
                  </div>
                </div>
                {player.playerImage && (
                  <Image
                    src={player.playerImage}
                    alt={player.name}
                    width={560}
                    height={410}
                    className="absolute bottom-[74px] left-1/2 z-[1] h-auto w-[130%] max-w-none -translate-x-1/2"
                  />
                )}
                <div className="absolute right-0 bottom-0 left-0 z-[2] bg-[linear-gradient(to_top,rgba(10,10,14,0.88),rgba(10,10,14,0))] px-[22px] pt-[18px] pb-4">
                  <div className="font-display text-[24px] leading-[1.05] font-bold tracking-[-0.02em] text-white">
                    {player.name}
                  </div>
                  <div className="mt-[7px] font-plex text-[9.5px] tracking-[0.1em] text-white/75">
                    {[player.height, player.weight, player.wingspan ? `${player.wingspan} WS` : null, `${badgesTotal} BADGES`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right column */}
          <div
            className="flex flex-col gap-3.5 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
            style={{ animationDelay: "120ms" }}
          >
            {/* Signature stats */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              {(signature.length ? signature : Array.from({ length: 3 }, () => null)).map((s, i) => (
                <div key={s?.key ?? i} className="rounded-[14px] border border-[#e5e2da] bg-white px-4 py-3.5">
                  {s ? (
                    <>
                      <div className="font-display text-[34px] leading-none font-bold">{s.value}</div>
                      <div className="mt-1.5 font-plex text-[9.5px] font-semibold tracking-[0.1em] text-[#1a1918]">
                        {s.label}
                      </div>
                      <div className="mt-0.5 font-plex text-[9px] text-[#8a8577]">{s.note}</div>
                    </>
                  ) : (
                    <div className="h-[64px] animate-pulse rounded bg-[#f1efe8]" />
                  )}
                </div>
              ))}
            </div>

            {/* Scouting read */}
            <div className="flex flex-1 flex-col justify-center rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
              <div className={cn(CARD_LABEL, "mb-2.5")}>THE SCOUTING READ</div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
                <div className="flex flex-col gap-2">
                  <div className="font-plex text-[8.5px] font-bold tracking-[0.12em] text-[#0a7f3f]">
                    STRENGTHS
                  </div>
                  {pros.map((line) => (
                    <div key={line} className="flex gap-2.5 text-[13px] leading-[1.5]">
                      <span className="font-plex font-bold text-[#0a7f3f]">+</span>
                      <span className="text-[#57534a]">{line}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="font-plex text-[8.5px] font-bold tracking-[0.12em] text-[#c03a2b]">
                    WEAKNESSES
                  </div>
                  {cons.map((line) => (
                    <div key={line} className="flex gap-2.5 text-[13px] leading-[1.5]">
                      <span className="font-plex font-bold text-[#c03a2b]">−</span>
                      <span className="text-[#57534a]">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Endpoint + actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3">
              <span className="font-plex text-[10px] text-[#57534a]">
                GET /api/players/slug/{slug}
              </span>
              <div className="flex gap-2">
                <Link
                  href={`/playground?era=${era === "curr" ? "curr" : era === "class" ? "class" : "all"}`}
                  className="rounded-full border border-[#e5e2da] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#1a1918] no-underline transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
                >
                  Compare
                </Link>
                <Link
                  href="/lineups"
                  className="rounded-full bg-[#1a1918] px-3 py-1.5 text-[11.5px] font-semibold text-[#faf9f5] no-underline transition-[background,transform] duration-150 hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
                >
                  → Whiteboard
                </Link>
              </div>
            </div>

            {/* Similar players */}
            {dossier && dossier.similar.length > 0 && (
              <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className={CARD_LABEL}>
                    STATISTICALLY SIMILAR{dossier.primaryPosition ? ` ${dossier.primaryPosition}S` : ""}
                  </span>
                  <span className="font-plex text-[9px] text-[#b5b0a1]">BY ATTRIBUTE PROFILE</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
                  {dossier.similar.map((sp) => (
                    <Link
                      key={`${sp.slug}-${sp.team}`}
                      href={`/players/${sp.slug}?type=${sp.teamType}&team=${encodeURIComponent(sp.team)}`}
                      className="flex items-center gap-[9px] rounded-[10px] border border-[#efece4] bg-[#faf9f5] px-2.5 py-[7px] text-[#1a1918] no-underline transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-[#1a1918] active:scale-[0.98] motion-reduce:transition-none"
                    >
                      <Headshot src={sp.playerImage} name={sp.name} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 overflow-hidden text-[11.5px] font-semibold text-ellipsis whitespace-nowrap">
                          {sp.name}
                        </p>
                        <p className="mt-px mb-0 font-plex text-[8.5px] text-[#8a8577]">
                          {sp.positions.join("/")} · {getTeamAbbreviation(sp.team)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex min-w-[27px] items-center justify-center rounded-[5px] px-1 py-0.5 text-[10.5px] font-bold text-white",
                          getRatingClasses(sp.overall).bg
                        )}
                      >
                        {sp.overall}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Visualizations */}
        <div
          className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3.5 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
          style={{ animationDelay: "200ms" }}
        >
          {/* Percentile bars */}
          <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
            <div className={cn(CARD_LABEL, "mb-2.5")}>
              PERCENTILE VS ALL {dossier?.primaryPosition ? `${dossier.primaryPosition}S` : "PLAYERS"}
              {dossier ? ` (${dossier.cohortSize})` : ""}
            </div>
            <div className="flex flex-col gap-2">
              {percRows.map((row) => (
                <div key={row.label} className="grid grid-cols-[86px_1fr_30px] items-center gap-2.5">
                  <span className="font-plex text-[8.5px] tracking-[0.06em] text-[#8a8577]">
                    {row.label}
                  </span>
                  <div className="relative h-1.5 rounded-full bg-[#f1efe8]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.pct}%`, background: pctColor(row.pct) }}
                    />
                    <div className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px bg-[#d9d4c7]" />
                  </div>
                  <span
                    className="text-right font-plex text-[10.5px] font-bold"
                    style={{ color: pctColor(row.pct) }}
                  >
                    {row.pct}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 font-plex text-[8px] text-[#b5b0a1]">| = LEAGUE MEDIAN</div>
          </div>

          {/* Rating history */}
          <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
            <div className={cn(CARD_LABEL, "mb-1.5")}>OVERALL — WEEKLY SCRAPES</div>
            {historyChart ? (
              <>
                <svg viewBox="0 0 396 150" className="block h-auto w-full overflow-visible">
                  {historyChart.band && (
                    <>
                      <line
                        x1="24"
                        x2="396"
                        y1={historyChart.band.y}
                        y2={historyChart.band.y}
                        stroke="#f9a205"
                        strokeWidth="1"
                        strokeDasharray="3 5"
                        opacity="0.6"
                      />
                      <text
                        x="392"
                        y={historyChart.band.y}
                        textAnchor="end"
                        dy="-4"
                        className="fill-[#b98404] font-plex text-[7.5px]"
                      >
                        {historyChart.band.label}
                      </text>
                    </>
                  )}
                  <polyline
                    points={historyChart.line}
                    fill="none"
                    stroke="#1a1918"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  {historyChart.dots.map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r="2.5" fill="#1a1918" />
                  ))}
                  {historyChart.ticks.map((t) => (
                    <text
                      key={t.label + t.x}
                      x={t.x}
                      y="146"
                      textAnchor="middle"
                      className="fill-[#b5b0a1] font-plex text-[8px]"
                    >
                      {t.label}
                    </text>
                  ))}
                </svg>
                <div className="mt-1.5 font-plex text-[8px] text-[#b5b0a1]">
                  {historyChart.delta >= 0 ? "+" : ""}
                  {historyChart.delta} OVER {dossier!.history.length} SNAPSHOTS · GET
                  /api/players/:id/history
                </div>
              </>
            ) : (
              <div className="flex h-[150px] items-center justify-center font-plex text-[9px] text-[#b5b0a1]">
                {dossier ? "HISTORY ACCRUES WEEKLY — NOT ENOUGH SNAPSHOTS YET" : "…"}
              </div>
            )}
          </div>

          {/* Category radar */}
          <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
            <div className={cn(CARD_LABEL, "mb-1")}>CATEGORY RADAR</div>
            <div className="flex justify-center">
              {radar ? (
                <svg width="210" height="184" viewBox="0 0 210 184" className="overflow-visible">
                  {radar.rings.map((ring) => (
                    <polygon key={ring} points={ring} fill="none" stroke="#e5e2da" strokeWidth="1" />
                  ))}
                  <path d={radar.path} fill="#1a1918" fillOpacity="0.08" stroke="#1a1918" strokeWidth="2" />
                  {radar.dots.map((d, i) => (
                    <circle key={i} cx={d.x} cy={d.y} r="2.5" fill="#1a1918" />
                  ))}
                  {radar.ticks.map((t) => (
                    <text
                      key={t.label}
                      x={t.x}
                      y={t.y}
                      textAnchor={t.anchor}
                      className="fill-[#8a8577] font-plex text-[8.5px]"
                    >
                      {t.label} <tspan className="fill-[#1a1918] font-bold">{t.value}</tspan>
                    </text>
                  ))}
                </svg>
              ) : (
                <div className="h-[184px] w-[210px] animate-pulse rounded bg-[#f1efe8]" />
              )}
            </div>
          </div>
        </div>

        {/* Badge shelf fallback: tier counts only, when named badges are absent */}
        {badgeShelf.length === 0 && player?.badgeCounts && badgesTotal > 0 && (
          <div
            className="mt-3.5 rounded-[14px] border border-[#e5e2da] bg-white px-5 py-4 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
            style={{ animationDelay: "260ms" }}
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <span className={CARD_LABEL}>BADGES — {badgesTotal} TOTAL</span>
              <span className="font-plex text-[9px] text-[#b5b0a1]">BY TIER</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["LEGENDARY", player.badgeCounts.legendary, TIER_STYLES.Legendary],
                  ["HALL OF FAME", player.badgeCounts.hallOfFame, TIER_STYLES["Hall of Fame"]],
                  ["GOLD", player.badgeCounts.gold, TIER_STYLES.Gold],
                  ["SILVER", player.badgeCounts.silver, TIER_STYLES.Silver],
                  ["BRONZE", player.badgeCounts.bronze, TIER_STYLES.Bronze],
                ] as const
              )
                .filter(([, count]) => typeof count === "number" && count > 0)
                .map(([label, count, style]) => (
                  <span
                    key={label}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-[5px] font-plex text-[8.5px] font-bold tracking-[0.08em] text-white",
                      style
                    )}
                  >
                    {label} · {count}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Badge shelf */}
        {badgeShelf.length > 0 && (
          <div
            className="mt-3.5 rounded-[14px] border border-[#e5e2da] bg-white px-5 py-4 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
            style={{ animationDelay: "260ms" }}
          >
            <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className={CARD_LABEL}>BADGES — {badgesTotal} TOTAL</span>
              <span className="font-plex text-[9px] text-[#b5b0a1]">
                FROM GET /api/players/slug/{slug}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {badgeShelf.map((row) => (
                <div key={row.tier} className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
                  <span
                    className={cn(
                      "inline-flex w-[120px] shrink-0 items-center justify-center gap-1.5 rounded-full py-[5px] font-plex text-[8.5px] font-bold tracking-[0.08em] text-white",
                      TIER_STYLES[row.tier] ?? "bg-[#8a8577]"
                    )}
                  >
                    {row.tier.toUpperCase()} · {row.chips.length}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.chips.map((c) => (
                      <span
                        key={c.slug}
                        className="rounded-full border border-[#e5e2da] bg-[#faf9f5] px-3 py-1 text-[12px] font-semibold text-[#1a1918]"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attribute matrix */}
        <div
          className="mt-3.5 mb-12 rounded-[14px] border border-[#e5e2da] bg-white px-5 py-4 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
          style={{ animationDelay: "320ms" }}
        >
          <div className={cn(CARD_LABEL, "mb-3")}>
            FULL ATTRIBUTE MATRIX — 40+ FIELDS, ALL FROM ONE CALL · HOVER FOR THE POSITION AVERAGE
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
            {Object.entries(ATTRIBUTE_CATEGORIES).map(([cat, keys]) => {
              const rows = keys
                .map((k) => ({ key: k, stat: dossier?.attrStats[k] }))
                .filter((r) => r.stat);
              if (!rows.length) return null;
              return (
                <div key={cat}>
                  <div className="mb-2 font-plex text-[8.5px] tracking-[0.1em] text-[#b5b0a1]">
                    {MATRIX_LABELS[cat]}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {rows.map(({ key, stat }) => (
                      <div
                        key={key}
                        title={`${dossier!.primaryPosition ?? "League"} avg ${stat!.avg} · ${ordinal(stat!.pct)} percentile`}
                        className="-mx-1 flex cursor-default items-center justify-between gap-1.5 rounded-[6px] px-1 py-px transition-colors duration-100 hover:bg-[#faf8f2]"
                      >
                        <span className="font-plex text-[9px] text-[#8a8577]">
                          {getAttributeDisplayName(key).toUpperCase()}
                        </span>
                        <span
                          className="text-[13.5px] font-bold tabular-nums"
                          style={{ color: getAttributeColor(stat!.value) }}
                        >
                          {stat!.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <FooterStrip />
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={null}>
      <PlayerDossier />
    </Suspense>
  );
}
