"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses, getAttributeColor } from "@/lib/rating-colors";
import { getTeamAbbreviation } from "@/lib/team-abbr";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ---- Sentence slots -------------------------------------------------------

const POS_SLOTS = [
  { label: "guards", param: "guard", positions: ["PG", "SG"] as string[] | null },
  { label: "wings", param: "wing", positions: ["SG", "SF"] as string[] | null },
  { label: "bigs", param: "big", positions: ["PF", "C"] as string[] | null },
  { label: "anyone", param: "any", positions: null },
];

const ERA_SLOTS = [
  { label: "any era", param: "all" },
  { label: "the current league", param: "curr" },
  { label: "the classics", param: "class" },
];

const THREE_SLOTS = [
  { label: "3PT ≥ 80", v: 80 },
  { label: "3PT ≥ 85", v: 85 },
  { label: "3PT ≥ 90", v: 90 },
  { label: "any 3PT", v: 0 },
];

type SortKey = "overall" | "tpt" | "spd" | "dnk" | "def";
const SORT_KEYS: SortKey[] = ["overall", "tpt", "spd", "dnk", "def"];
const SORT_LABELS: Record<SortKey, string> = {
  overall: "overall",
  tpt: "three ball",
  spd: "speed",
  dnk: "dunking",
  def: "defense",
};
const SORT_URL_NAMES: Record<SortKey, string> = {
  overall: "overall",
  tpt: "three_ball",
  spd: "speed",
  dnk: "driving_dunk",
  def: "perimeter_defense",
};

type PlaygroundPlayer = {
  name: string;
  slug: string;
  team: string;
  teamType: "curr" | "class" | "allt";
  positions: string[];
  overall: number;
  playerImage: string | null;
  threePointShot: number | null;
  speed: number | null;
  drivingDunk: number | null;
  perimeterDefense: number | null;
};

const ATTR_OF: Record<Exclude<SortKey, "overall">, (p: PlaygroundPlayer) => number | null> = {
  tpt: (p) => p.threePointShot,
  spd: (p) => p.speed,
  dnk: (p) => p.drivingDunk,
  def: (p) => p.perimeterDefense,
};

const SAVED_QUERIES = [
  { label: "Lockdown wings, any era", pos: 1, era: 0, three: 3, sortKey: "def" as SortKey, team: null },
  { label: "7-footers who shoot 80+", pos: 2, era: 0, three: 0, sortKey: "tpt" as SortKey, team: null },
  { label: "'96 Bulls full roster", pos: 3, era: 2, three: 3, sortKey: "overall" as SortKey, team: "1995-96 Chicago Bulls" },
];

const ROW_LIMIT = 50;

// ---- Helpers ---------------------------------------------------------------

function sortValue(p: PlaygroundPlayer, key: SortKey): number | null {
  return key === "overall" ? p.overall : ATTR_OF[key](p);
}

function shortTeam(p: PlaygroundPlayer): string {
  const abbr = getTeamAbbreviation(p.team);
  if (p.teamType === "class") {
    const match = p.team.match(/^\d{4}-(\d{2})\s/);
    return match ? `${abbr} '${match[1]}` : abbr;
  }
  if (p.teamType === "allt") return `${abbr} A-T`;
  return abbr;
}

function eraTag(teamType: PlaygroundPlayer["teamType"]) {
  if (teamType === "class") return { label: "CLASSIC", color: "#9a6700" };
  if (teamType === "allt") return { label: "ALL-TIME", color: "#9a6700" };
  return { label: "CURRENT", color: "#8a8577" };
}

function OvrChip({ ovr }: { ovr: number }) {
  return (
    <span
      className={cn(
        "inline-flex w-[38px] items-center justify-center rounded-[6px] py-[3px] text-[12px] font-bold text-white tabular-nums",
        getRatingClasses(ovr).bg
      )}
    >
      {ovr}
    </span>
  );
}

function AttrCell({ value, highlighted = false }: { value: number | null; highlighted?: boolean }) {
  return (
    <span
      className={cn(
        "text-center text-[12.5px] font-bold tabular-nums",
        highlighted && "rounded-[5px] bg-[#faf7ee] py-[3px]"
      )}
      style={{ color: value === null ? "#b5b0a1" : getAttributeColor(value) }}
    >
      {value ?? "—"}
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

function Slot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 border-b-2 border-dashed border-[#d9d4c7] px-[3px] pb-px font-extrabold text-[#1a1918] transition-[border-color] duration-150 select-none hover:border-[#1a1918] active:scale-[0.98]"
    >
      {label}
      <SlotChevron />
    </button>
  );
}

// ---- URL <-> state ----------------------------------------------------------

type QueryState = {
  pos: number;
  era: number;
  three: number;
  sortKey: SortKey;
  sortDir: -1 | 1;
  team: string | null;
  search: string | null;
};

function stateFromParams(sp: URLSearchParams): QueryState {
  // Pristine /playground gets the design's showcase defaults. A URL that
  // carries any query param is a deep link — unspecified slots must stay
  // wide open ("anyone" / "any era" / "any 3PT") so the link isn't narrowed.
  const isDeepLink = ["position", "era", "three_ball_gte", "sort", "team", "search"].some((k) => sp.has(k));
  if (!isDeepLink) {
    return { pos: 0, era: 0, three: 1, sortKey: "overall", sortDir: -1, team: null, search: null };
  }
  const posIdx = POS_SLOTS.findIndex((s) => s.param === sp.get("position"));
  const eraIdx = ERA_SLOTS.findIndex((s) => s.param === sp.get("era"));
  const threeIdx = sp.has("three_ball_gte")
    ? THREE_SLOTS.findIndex((s) => s.v === Number(sp.get("three_ball_gte")))
    : -1;
  const [sortField, sortDir] = (sp.get("sort") ?? "").split(":");
  const sortKey =
    (Object.entries(SORT_URL_NAMES).find(([, url]) => url === sortField)?.[0] as SortKey) ??
    "overall";
  return {
    pos: posIdx >= 0 ? posIdx : 3,
    era: eraIdx >= 0 ? eraIdx : 0,
    three: threeIdx >= 0 ? threeIdx : 3,
    sortKey,
    sortDir: sortDir === "asc" ? 1 : -1,
    team: sp.get("team"),
    search: sp.get("search"),
  };
}

function paramsFromState(s: QueryState): string {
  const params = new URLSearchParams();
  const pos = POS_SLOTS[s.pos];
  if (pos.param !== "any") params.set("position", pos.param);
  params.set("era", ERA_SLOTS[s.era].param);
  if (THREE_SLOTS[s.three].v > 0) params.set("three_ball_gte", String(THREE_SLOTS[s.three].v));
  if (s.team) params.set("team", s.team);
  if (s.search) params.set("search", s.search);
  params.set("sort", `${SORT_URL_NAMES[s.sortKey]}:${s.sortDir === -1 ? "desc" : "asc"}`);
  return params.toString();
}

// ---- Page -----------------------------------------------------------------

function Playground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState<QueryState>(() => stateFromParams(searchParams));
  const [copied, setCopied] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  const players = useQuery(api.players.getPlaygroundPlayers) as PlaygroundPlayer[] | undefined;

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  // Keep the URL shareable: mirror the sentence into query params.
  useEffect(() => {
    const qs = paramsFromState(q);
    if (qs !== searchParams.toString()) {
      router.replace(`/playground?${qs}`, { scroll: false });
    }
  }, [q, router, searchParams]);

  const requestUrl = `/api/players?${paramsFromState(q)}`;

  const filtered = useMemo(() => {
    if (!players) return [];
    const pos = POS_SLOTS[q.pos];
    const era = ERA_SLOTS[q.era].param;
    const minThree = THREE_SLOTS[q.three].v;
    const sign = q.sortDir;
    return players
      .filter((p) => {
        if (pos.positions && !p.positions.some((x) => pos.positions!.includes(x))) return false;
        if (era !== "all" && p.teamType !== era) return false;
        if (minThree > 0 && (p.threePointShot === null || p.threePointShot < minThree)) return false;
        if (q.team && p.team !== q.team) return false;
        if (q.search && !p.name.toLowerCase().includes(q.search.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const av = sortValue(a, q.sortKey);
        const bv = sortValue(b, q.sortKey);
        if (av === null && bv === null) return b.overall - a.overall;
        if (av === null) return 1;
        if (bv === null) return -1;
        const d = sign === -1 ? bv - av : av - bv;
        return d !== 0 ? d : b.overall - a.overall;
      });
  }, [players, q]);

  const rows = filtered.slice(0, ROW_LIMIT);
  const first = filtered[0];

  const cycle = (key: "pos" | "era" | "three", len: number) => () =>
    setQ((s) => ({ ...s, [key]: (s[key] + 1) % len, team: null }));

  const cycleSort = () =>
    setQ((s) => ({
      ...s,
      sortKey: SORT_KEYS[(SORT_KEYS.indexOf(s.sortKey) + 1) % SORT_KEYS.length],
      sortDir: -1,
    }));

  const sortBy = (key: SortKey) => () =>
    setQ((s) => ({
      ...s,
      sortKey: key,
      sortDir: s.sortKey === key ? ((-s.sortDir) as -1 | 1) : -1,
    }));

  const arrow = (key: SortKey) => (q.sortKey === key ? (q.sortDir === -1 ? " ↓" : " ↑") : "");
  const headColor = (key: SortKey) => (q.sortKey === key ? "#1a1918" : "#b5b0a1");

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://api.nba2kapi.com${requestUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const exportCsv = () => {
    const header = "name,slug,team,era,overall,three_ball,speed,driving_dunk,perimeter_defense";
    const lines = filtered.map((p) =>
      [
        `"${p.name.replace(/"/g, '""')}"`,
        p.slug,
        `"${p.team.replace(/"/g, '""')}"`,
        p.teamType,
        p.overall,
        p.threePointShot ?? "",
        p.speed ?? "",
        p.drivingDunk ?? "",
        p.perimeterDefense ?? "",
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nba2kapi-query.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} players`);
  };

  const copyJson = () => {
    const payload = {
      success: true,
      count: filtered.length,
      results: filtered.map((p) => ({
        name: p.name,
        slug: p.slug,
        team: p.team,
        era: p.teamType,
        overall: p.overall,
        three_ball: p.threePointShot,
        speed: p.speed,
        driving_dunk: p.drivingDunk,
        perimeter_defense: p.perimeterDefense,
      })),
    };
    navigator.clipboard
      .writeText(JSON.stringify(payload, null, 2))
      .then(() => toast.success("Response JSON copied"));
  };

  const applySaved = (s: (typeof SAVED_QUERIES)[number]) =>
    setQ({ pos: s.pos, era: s.era, three: s.three, sortKey: s.sortKey, sortDir: -1, team: s.team, search: null });

  const monoHead = "font-plex text-[8.5px] tracking-[0.08em]";
  const rowGrid =
    "grid grid-cols-[34px_30px_minmax(150px,1fr)_80px_54px_54px_repeat(3,46px)] items-center gap-2.5 px-4";

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav hasApiKey={hasApiKey} width="wide" />

      {/* Query card */}
      <div className="mx-auto max-w-[1440px] animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] px-[clamp(20px,4vw,48px)] pt-2 motion-reduce:animate-none">
        <div className="rounded-2xl border border-[#e5e2da] bg-white p-[clamp(16px,2.5vw,24px)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]">
              QUERY — CLICK ANY SLOT TO CHANGE IT
            </span>
            <span className="font-plex text-[9px] text-[#b5b0a1]">SAVED QUERIES →</span>
          </div>
          <div className="font-display text-[clamp(19px,2.2vw,25px)] leading-[1.7] font-semibold tracking-[-0.02em] text-[#57534a]">
            Show me <Slot label={POS_SLOTS[q.pos].label} onClick={cycle("pos", POS_SLOTS.length)} />{" "}
            from <Slot label={ERA_SLOTS[q.era].label} onClick={cycle("era", ERA_SLOTS.length)} />{" "}
            with{" "}
            <Slot label={THREE_SLOTS[q.three].label} onClick={cycle("three", THREE_SLOTS.length)} />
            , ranked by <Slot label={SORT_LABELS[q.sortKey]} onClick={cycleSort} />
          </div>
          <div className="mt-3.5 flex items-center overflow-hidden rounded-[10px] bg-[#1a1918]">
            <span className="shrink-0 bg-white/12 px-[13px] py-[9px] font-plex text-[9.5px] text-[#faf9f5]">
              GET
            </span>
            <span className="flex-1 overflow-hidden px-3.5 font-plex text-[11px] text-ellipsis whitespace-nowrap text-[#faf9f5]">
              {requestUrl}
            </span>
            <button
              type="button"
              onClick={copyUrl}
              className="shrink-0 cursor-pointer border-l border-white/12 px-3.5 py-[9px] font-plex text-[9.5px] text-white/70 transition-colors duration-150 hover:text-white"
            >
              {copied ? "COPIED ✓" : "COPY"}
            </button>
          </div>
        </div>
      </div>

      {/* Meta strip */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 px-[clamp(20px,4vw,48px)] pt-3.5">
        <span className="flex flex-wrap items-center gap-2 font-plex text-[10px] tracking-[0.08em] text-[#8a8577]">
          <span>
            <b className="text-[#1a1918]">{players ? `${filtered.length} MATCH` : "LOADING"}</b> ·
            CACHED 1H
          </span>
          {q.team && (
            <button
              type="button"
              onClick={() => setQ((s) => ({ ...s, team: null }))}
              className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-2.5 py-0.5 font-plex text-[9px] tracking-[0.08em] text-[#57534a] hover:border-[#1a1918]"
              title="Clear team filter"
            >
              TEAM: {q.team.toUpperCase()} ✕
            </button>
          )}
          {q.search && (
            <button
              type="button"
              onClick={() => setQ((s) => ({ ...s, search: null }))}
              className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-2.5 py-0.5 font-plex text-[9px] tracking-[0.08em] text-[#57534a] hover:border-[#1a1918]"
              title="Clear name search"
            >
              NAME: &quot;{q.search.toUpperCase()}&quot; ✕
            </button>
          )}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-[13px] py-1.5 text-[11.5px] font-semibold text-[#1a1918] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={copyJson}
            className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-[13px] py-1.5 text-[11.5px] font-semibold text-[#1a1918] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
          >
            Copy JSON
          </button>
        </div>
      </div>

      {/* Results + rail */}
      <div className="mx-auto grid max-w-[1440px] grid-cols-[repeat(auto-fit,minmax(min(100%,620px),1fr))] items-start gap-3.5 px-[clamp(20px,4vw,48px)] pt-2.5 pb-12">
        {/* Table */}
        <div
          className="overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
          style={{ animationDelay: "80ms" }}
        >
          <div className="overflow-x-auto">
            <div className="min-w-[655px]">
              <div className={cn(rowGrid, "border-b border-[#e5e2da] bg-[#faf9f5] py-[9px]")}>
                <span className={cn(monoHead, "text-[#b5b0a1]")}>#</span>
                <span />
                <span className={cn(monoHead, "text-[#b5b0a1]")}>PLAYER</span>
                <span className={cn(monoHead, "text-[#b5b0a1]")}>ERA</span>
                <button
                  type="button"
                  onClick={sortBy("overall")}
                  className={cn(monoHead, "cursor-pointer text-left font-bold select-none")}
                  style={{ color: headColor("overall") }}
                >
                  OVR{arrow("overall")}
                </button>
                <button
                  type="button"
                  onClick={sortBy("tpt")}
                  className={cn(
                    monoHead,
                    "cursor-pointer rounded-[5px] bg-[#f6f2e6] py-0.5 text-center font-bold text-[#1a1918] select-none"
                  )}
                >
                  3PT{arrow("tpt")} ●
                </button>
                {(["spd", "dnk", "def"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={sortBy(key)}
                    className={cn(
                      monoHead,
                      "cursor-pointer text-center transition-colors duration-150 select-none hover:text-[#1a1918]"
                    )}
                    style={{ color: headColor(key) }}
                  >
                    {key.toUpperCase()}
                    {arrow(key)}
                  </button>
                ))}
              </div>

              {players
                ? rows.map((p, i) => {
                    const era = eraTag(p.teamType);
                    return (
                      <Link
                        key={`${p.slug}-${p.teamType}-${p.team}`}
                        href={`/players/${p.slug}?type=${p.teamType}&team=${encodeURIComponent(p.team)}`}
                        className={cn(
                          rowGrid,
                          "border-b border-[#faf8f2] py-[7px] text-[#1a1918] no-underline transition-colors duration-100 hover:bg-[#faf8f2]"
                        )}
                      >
                        <span className="font-plex text-[10px] text-[#b5b0a1]">{i + 1}</span>
                        <Headshot src={p.playerImage} name={p.name} size={28} />
                        <div className="flex min-w-0 items-baseline gap-2">
                          <span className="overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap">
                            {p.name}
                          </span>
                          <span className="whitespace-nowrap font-plex text-[8.5px] text-[#8a8577]">
                            {p.positions.join("/")} · {shortTeam(p)}
                          </span>
                        </div>
                        <span
                          className="font-plex text-[8px] font-bold tracking-[0.08em]"
                          style={{ color: era.color }}
                        >
                          {era.label}
                        </span>
                        <OvrChip ovr={p.overall} />
                        <AttrCell value={p.threePointShot} highlighted />
                        <AttrCell value={p.speed} />
                        <AttrCell value={p.drivingDunk} />
                        <AttrCell value={p.perimeterDefense} />
                      </Link>
                    );
                  })
                : Array.from({ length: 12 }, (_, i) => (
                    <div
                      key={i}
                      className={cn(rowGrid, "animate-pulse border-b border-[#faf8f2] py-[7px]")}
                    >
                      <span className="h-3 w-4 rounded bg-[#f1efe8]" />
                      <div className="h-7 w-7 rounded-full bg-[#f1efe8]" />
                      <span className="h-3.5 w-2/3 rounded bg-[#f1efe8]" />
                      <span className="h-3 w-12 rounded bg-[#f1efe8]" />
                      <span className="h-[22px] w-[38px] rounded-[6px] bg-[#f1efe8]" />
                      <span className="h-[22px] rounded-[5px] bg-[#f1efe8]" />
                      <span className="h-3 rounded bg-[#f1efe8]" />
                      <span className="h-3 rounded bg-[#f1efe8]" />
                      <span className="h-3 rounded bg-[#f1efe8]" />
                    </div>
                  ))}

              {players && rows.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <div className="font-display text-[17px] font-bold">No players match</div>
                  <div className="mt-1 text-[12.5px] text-[#8a8577]">
                    Loosen a slot — try &quot;any 3PT&quot; or &quot;any era&quot;.
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#faf9f5] px-4 py-2">
            <span className="font-plex text-[8.5px] text-[#b5b0a1]">
              ● = QUERIED COLUMN · CLICK A COLUMN TO SORT · CLICK A ROW → DOSSIER
            </span>
            <span className="font-plex text-[8.5px] text-[#b5b0a1]">
              SHOWING {rows.length} OF {filtered.length}
            </span>
          </div>
        </div>

        {/* Right rail */}
        <div
          className="flex flex-col gap-2.5 animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
          style={{ animationDelay: "140ms" }}
        >
          <div className="rounded-[14px] bg-[#1a1918] px-4 py-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-plex text-[9px] tracking-[0.1em] text-white/60">RESPONSE</span>
              <span className="font-plex text-[8.5px] text-[#6ee7a0]">
                {players ? "200 OK · LIVE" : "LOADING…"}
              </span>
            </div>
            <pre className="m-0 overflow-hidden font-plex text-[10px] leading-[1.65] text-white/85">
              {"{\n  "}
              <span className="text-[#8ab4f8]">&quot;success&quot;</span>
              {": true,\n  "}
              <span className="text-[#8ab4f8]">&quot;count&quot;</span>
              {`: ${filtered.length},\n  `}
              <span className="text-[#8ab4f8]">&quot;results&quot;</span>
              {": [\n"}
              {first ? (
                <>
                  {"    {\n      "}
                  <span className="text-[#8ab4f8]">&quot;name&quot;</span>
                  {": "}
                  <span className="text-[#e6b36a]">&quot;{first.name}&quot;</span>
                  {",\n      "}
                  <span className="text-[#8ab4f8]">&quot;slug&quot;</span>
                  {": "}
                  <span className="text-[#e6b36a]">&quot;{first.slug}&quot;</span>
                  {",\n      "}
                  <span className="text-[#8ab4f8]">&quot;overall&quot;</span>
                  {": "}
                  <span className="text-[#b79ce0]">{first.overall}</span>
                  {",\n      "}
                  <span className="text-[#8ab4f8]">&quot;three_ball&quot;</span>
                  {": "}
                  <span className="text-[#b79ce0]">{first.threePointShot ?? "null"}</span>
                  {",\n      "}
                  <span className="text-[#8ab4f8]">&quot;era&quot;</span>
                  {": "}
                  <span className="text-[#e6b36a]">&quot;{first.teamType}&quot;</span>
                  {"\n    },\n    "}
                  <span className="text-white/40">…{Math.max(0, filtered.length - 1)} more</span>
                  {"\n"}
                </>
              ) : (
                <span className="text-white/40">{"    …\n"}</span>
              )}
              {"  ]\n}"}
            </pre>
          </div>

          <div className="rounded-[14px] border border-[#e5e2da] bg-white px-4 py-3">
            <div className="mb-2 font-plex text-[9px] tracking-[0.1em] text-[#8a8577]">
              TRIM THE PAYLOAD
            </div>
            <p className="m-0 text-[11.5px] leading-[1.5] text-[#57534a]">
              Add{" "}
              <span className="rounded-[5px] border border-[#e5e2da] bg-[#faf9f5] px-[5px] py-px font-plex text-[10px]">
                ?fields=name,overall
              </span>{" "}
              to get only the columns you need.
            </p>
          </div>

          <div className="rounded-[14px] border border-[#e5e2da] bg-white px-4 py-3">
            <div className="mb-2 font-plex text-[9px] tracking-[0.1em] text-[#8a8577]">
              SAVED QUERIES
            </div>
            <div className="flex flex-col items-start gap-1.5">
              {SAVED_QUERIES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => applySaved(s)}
                  className="cursor-pointer text-left text-[11.5px] font-semibold text-[#1a1918] transition-colors duration-150 hover:text-[#57534a]"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <FooterStrip width="wide" />
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={null}>
      <Playground />
    </Suspense>
  );
}
