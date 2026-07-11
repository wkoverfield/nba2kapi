"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Search, SlidersHorizontal, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses } from "@/lib/rating-colors";
import { getRatingTier } from "@/lib/rating-colors";
import { getAttributeDisplayName } from "@/lib/attribute-normalizer";
import { ATTRIBUTE_CATEGORIES } from "@/convex/attributeCategories";
import { getTeamAbbreviation } from "@/lib/team-abbr";
import { parseLineupFromURL, lineupToURLParams, type LineupPlayer } from "@/lib/lineup-url";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";

type PoolPlayer = {
  name: string;
  slug: string;
  team: string;
  teamType: TeamType;
  positions: string[];
  overall: number;
  playerImage: string | null;
  attributes: Record<string, number>;
  badges: { name: string; tier: string }[];
  threePointShot: number | null;
  speed: number | null;
  drivingDunk: number | null;
  perimeterDefense: number | null;
  cats: {
    ins: number | null;
    out: number | null;
    ply: number | null;
    ath: number | null;
    reb: number | null;
    def: number | null;
  };
};

const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

// Court spot geometry from the design (viewBox 100 x 56), left half; the
// right half mirrors x.
const SPOTS = [
  { pos: "PG", x: 36, y: 25 },
  { pos: "SG", x: 27, y: 7 },
  { pos: "SF", x: 27, y: 43 },
  { pos: "PF", x: 15, y: 39 },
  { pos: "C", x: 10, y: 18 },
];

const CATS = ["ins", "out", "ply", "ath", "reb", "def"] as const;
const ATTRIBUTE_KEYS = [...new Set(Object.values(ATTRIBUTE_CATEGORIES).flat())];
const RATING_TIERS = ["Dark Matter", "Galaxy Opal", "Pink Diamond", "Diamond", "Amethyst", "Ruby", "Sapphire", "Emerald", "Gold", "Silver", "Bronze"];
const BADGE_TIERS = ["Legendary", "Hall of Fame", "Gold", "Silver", "Bronze"];
const CAT_LABELS: Record<(typeof CATS)[number], string> = {
  ins: "INSIDE",
  out: "OUTSIDE",
  ply: "PLAYMAKING",
  ath: "ATHLETICISM",
  reb: "REBOUNDING",
  def: "DEFENSE",
};

type Side = "yours" | "opps";
type Slots = (PoolPlayer | null)[];

function lastName(name: string) {
  const parts = name.split(" ").filter(Boolean);
  return (parts[parts.length - 1] ?? name).toUpperCase();
}

function primarySlot(p: PoolPlayer): number {
  const idx = POSITIONS.indexOf((p.positions[0] ?? "") as (typeof POSITIONS)[number]);
  if (idx >= 0) return idx;
  const second = POSITIONS.indexOf((p.positions[1] ?? "") as (typeof POSITIONS)[number]);
  return second >= 0 ? second : 2;
}

function avgOf(list: PoolPlayer[], f: (p: PoolPlayer) => number | null): number | null {
  const vals = list.map(f).filter((n): n is number => n !== null);
  return vals.length ? Math.round(vals.reduce((s, n) => s + n, 0) / vals.length) : null;
}

function eraColor(t: TeamType) {
  return t === "curr" ? "#8a8577" : "#9a6700";
}

function shortMeta(p: PoolPlayer) {
  const abbr = getTeamAbbreviation(p.team);
  const era = p.teamType === "curr" ? abbr : p.teamType === "class" ? `${abbr} CLASSIC` : `${abbr} A-T`;
  return `${p.positions.join("/")} · ${era}`;
}

function MiniOvr({ ovr }: { ovr: number }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[28px] items-center justify-center rounded-[5px] px-1 py-0.5 text-[11px] font-bold text-white",
        getRatingClasses(ovr).bg
      )}
    >
      {ovr}
    </span>
  );
}

function CourtDiagram({ matchupMode, guardLines }: { matchupMode: boolean; guardLines: { x1: number; y1: number; x2: number; y2: number }[] }) {
  const line = "#c8a978";
  const soft = "#decba7";
  return (
    <svg viewBox={`0 0 ${matchupMode ? 94 : 47} 50`} className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <pattern id="wood-planks" width="9.4" height="5" patternUnits="userSpaceOnUse">
          <rect width="9.4" height="5" fill="#f4e4c3" />
          <path d="M0 5H9.4 M9.4 0V5" stroke="#ead5ad" strokeWidth="0.12" />
          <path d="M4.7 0V5" stroke="#f8edd5" strokeWidth="0.08" />
        </pattern>
      </defs>
      <rect x="0.25" y="0.25" width={matchupMode ? 93.5 : 46.5} height="49.5" rx="0.7" fill="url(#wood-planks)" stroke={line} strokeWidth="0.5" />

      {/* Left basket and half-court: dimensions use feet on a 94 × 50 NBA floor. */}
      <rect x="0.25" y="17" width="18.75" height="16" fill="#ecd5a9" fillOpacity="0.42" stroke={line} strokeWidth="0.38" />
      <circle cx="19" cy="25" r="6" fill="none" stroke={line} strokeWidth="0.38" />
      <path d="M19 19 A6 6 0 0 1 19 31" fill="none" stroke={line} strokeWidth="0.38" strokeDasharray="0.8 0.8" />
      <line x1="4" y1="22" x2="4" y2="28" stroke={line} strokeWidth="0.55" />
      <circle cx="5.25" cy="25" r="0.75" fill="none" stroke={line} strokeWidth="0.45" />
      <path d="M5.25 21 A4 4 0 0 1 5.25 29" fill="none" stroke={line} strokeWidth="0.38" />
      <path d="M0.25 3 H14 M14 3 A23.75 23.75 0 0 1 14 47 M14 47 H0.25" fill="none" stroke={line} strokeWidth="0.45" />
      <line x1="0.25" y1="22" x2="4" y2="22" stroke={soft} strokeWidth="0.25" />
      <line x1="0.25" y1="28" x2="4" y2="28" stroke={soft} strokeWidth="0.25" />

      {matchupMode && (
        <>
          <line x1="47" y1="0.25" x2="47" y2="49.75" stroke={line} strokeWidth="0.45" />
          <circle cx="47" cy="25" r="6" fill="none" stroke={line} strokeWidth="0.38" />
          <rect x="75" y="17" width="18.75" height="16" fill="#ecd5a9" fillOpacity="0.42" stroke={line} strokeWidth="0.38" />
          <circle cx="75" cy="25" r="6" fill="none" stroke={line} strokeWidth="0.38" />
          <path d="M75 19 A6 6 0 0 0 75 31" fill="none" stroke={line} strokeWidth="0.38" strokeDasharray="0.8 0.8" />
          <line x1="90" y1="22" x2="90" y2="28" stroke={line} strokeWidth="0.55" />
          <circle cx="88.75" cy="25" r="0.75" fill="none" stroke={line} strokeWidth="0.45" />
          <path d="M88.75 21 A4 4 0 0 0 88.75 29" fill="none" stroke={line} strokeWidth="0.38" />
          <path d="M93.75 3 H80 M80 3 A23.75 23.75 0 0 0 80 47 M80 47 H93.75" fill="none" stroke={line} strokeWidth="0.45" />
        </>
      )}

      {matchupMode && guardLines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#967d58" strokeWidth="0.22" strokeDasharray="0.8 1.1" />
      ))}
    </svg>
  );
}

// ---- Court pieces -----------------------------------------------------------

function CourtSlot({
  side,
  index,
  spot,
  player,
  compareMode,
  pulsing,
  onRemove,
}: {
  side: Side;
  index: number;
  spot: { pos: string; x: number; y: number };
  player: PoolPlayer | null;
  compareMode: boolean;
  pulsing: boolean;
  onRemove: () => void;
}) {
  const x = compareMode ? (side === "yours" ? spot.x : 94 - spot.x) / 94 * 100 : spot.x / 47 * 100;
  const y = (spot.y / 50) * 100;
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${side}:${index}` });
  const drag = useDraggable({
    id: `chip:${side}:${index}`,
    data: { kind: "chip", side, index },
    disabled: !player,
  });

  return (
    <div
      ref={setNodeRef}
      className="absolute z-[2] -translate-x-1/2 -translate-y-1/2 text-center"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {player ? (
        <div
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          onClick={onRemove}
          title={`${player.name} — click to remove, drag to move`}
          className={cn(
            "cursor-grab touch-none animate-[pop-in_250ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none",
            drag.isDragging && "opacity-30"
          )}
        >
          <div
            className={cn(
              "relative mx-auto h-[clamp(38px,4.5vw,52px)] w-[clamp(38px,4.5vw,52px)] rounded-full border-2 bg-white shadow-[0_4px_12px_-4px_rgba(26,25,24,0.35)]",
              isOver ? "border-[#0a7f3f]" : "border-[#1a1918]"
            )}
          >
            <Headshot src={player.playerImage} name={player.name} size={48} className="h-full w-full" />
            <span
              className={cn(
                "absolute -top-[7px] -right-[9px] inline-flex min-w-[21px] items-center justify-center rounded-[5px] px-[3px] py-px text-[9px] font-bold text-white",
                getRatingClasses(player.overall).bg
              )}
            >
              {player.overall}
            </span>
          </div>
          <span className="mt-1 inline-block rounded-[4px] bg-white/90 px-[5px] py-px font-plex text-[7.5px] tracking-[0.06em] whitespace-nowrap text-[#57534a]">
            {lastName(player.name)}
          </span>
        </div>
      ) : (
        <div
          className={cn(
            "flex h-[clamp(38px,4.5vw,52px)] w-[clamp(38px,4.5vw,52px)] items-center justify-center rounded-full border-2 border-dashed bg-white/55 font-plex text-[8px] text-[#8a8577]",
            isOver
              ? "border-[#0a7f3f] bg-white/80"
              : pulsing
                ? "animate-[pulse-slot_2s_ease-in-out_infinite] border-[#b5b0a1] motion-reduce:animate-none"
                : "border-[#b5b0a1]"
          )}
        >
          {spot.pos}
        </div>
      )}
    </div>
  );
}

function PoolRow({ p, placed, onTap }: { p: PoolPlayer; placed: boolean; onTap: () => void }) {
  const drag = useDraggable({
    id: `pool:${p.slug}:${p.teamType}:${p.team}`,
    data: { kind: "pool", player: p },
    disabled: placed,
  });
  return (
    <div
      ref={drag.setNodeRef}
      {...drag.listeners}
      {...drag.attributes}
      onClick={placed ? undefined : onTap}
      className={cn(
        "flex touch-none items-center gap-2.5 border-b border-[#faf8f2] px-4 py-[7px] transition-colors duration-100",
        placed ? "opacity-35" : "cursor-grab hover:bg-[#faf8f2] active:scale-[0.99]",
        drag.isDragging && "opacity-30"
      )}
    >
      <Headshot src={p.playerImage} name={p.name} size={28} />
      <div className="min-w-0 flex-1">
        <p className="m-0 overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap">
          {p.name}
        </p>
        <p className="mt-px mb-0 font-plex text-[8px]" style={{ color: eraColor(p.teamType) }}>
          {shortMeta(p)}
        </p>
      </div>
      <MiniOvr ovr={p.overall} />
    </div>
  );
}

// ---- Page -------------------------------------------------------------------

const POOL_LIMIT = 40;

function Whiteboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasApiKey, setHasApiKey] = useState(false);
  const [yours, setYours] = useState<Slots>([null, null, null, null, null]);
  const [opps, setOpps] = useState<Slots>([null, null, null, null, null]);
  const [hydrated, setHydrated] = useState(false);
  const [q, setQ] = useState("");
  const [posF, setPosF] = useState("ALL");
  const [sortF, setSortF] = useState<"ovr" | "az">("ovr");
  const [eraF, setEraF] = useState<"all" | TeamType>("all");
  const [minOvr, setMinOvr] = useState(0);
  const [maxOvr, setMaxOvr] = useState(99);
  const [ratingTierF, setRatingTierF] = useState("all");
  const [attributeF, setAttributeF] = useState("all");
  const [attributeMin, setAttributeMin] = useState(80);
  const [badgeF, setBadgeF] = useState("all");
  const [badgeTierF, setBadgeTierF] = useState("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSide, setPickerSide] = useState<Side>("yours");
  const [matchupMode, setMatchupMode] = useState(false);
  const [dragging, setDragging] = useState<PoolPlayer | null>(null);
  // Browsers synthesize a click after pointerup, so a completed drag would
  // also fire the tap handlers (remove / tap-place). Swallow clicks that
  // land right after a drag ends.
  const lastDragEndRef = useRef(0);
  const guardedTap = (fn: () => void) => () => {
    if (Date.now() - lastDragEndRef.current < 300) return;
    fn();
  };

  const players = useQuery(api.players.getPlaygroundPlayers) as PoolPlayer[] | undefined;

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  // Hydrate slots from a shared URL once the pool is loaded (legacy-compatible
  // lineup1/lineup2 scheme; players land on their primary-position slot,
  // falling back to the first open one).
  useEffect(() => {
    if (!players || hydrated) return;
    const state = parseLineupFromURL(new URLSearchParams(searchParams.toString()));
    const resolve = (entry: LineupPlayer) =>
      players.find(
        (p) =>
          p.slug === entry.slug &&
          p.teamType === entry.teamType &&
          (!entry.team || p.team === entry.team)
      ) ??
      players.find((p) => p.slug === entry.slug) ??
      null;
    const fill = (entries: LineupPlayer[]): Slots => {
      const slots: Slots = [null, null, null, null, null];
      for (const entry of entries.slice(0, 5)) {
        const p = resolve(entry);
        if (!p) continue;
        let idx = primarySlot(p);
        if (slots[idx]) idx = slots.findIndex((s) => s === null);
        if (idx >= 0) slots[idx] = p;
      }
      return slots;
    };
    if (state.lineup1.length) setYours(fill(state.lineup1));
    if (state.lineup2?.length) {
      setOpps(fill(state.lineup2));
      setMatchupMode(true);
    }
    setHydrated(true);
  }, [players, hydrated, searchParams]);

  // Mirror slots back into the URL (shareable, legacy-compatible)
  useEffect(() => {
    if (!hydrated) return;
    const toEntries = (slots: Slots): LineupPlayer[] =>
      slots
        .filter((p): p is PoolPlayer => p !== null)
        .map((p) => ({ slug: p.slug, teamType: p.teamType, team: p.team }));
    const params = lineupToURLParams({
      lineup1: toEntries(yours),
      lineup2: matchupMode ? toEntries(opps) : [],
      filterTeamType: "curr",
    });
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace(next ? `/lineups?${next}` : "/lineups", { scroll: false });
    }
  }, [yours, opps, matchupMode, hydrated, router, searchParams]);

  const yoursFilled = yours.filter((p): p is PoolPlayer => p !== null);
  const oppsFilled = opps.filter((p): p is PoolPlayer => p !== null);
  const hasOpp = oppsFilled.length > 0;
  const yourOvr = avgOf(yoursFilled, (p) => p.overall);
  const oppOvr = avgOf(oppsFilled, (p) => p.overall);

  const placedKeys = useMemo(
    () =>
      new Set(
        [...yoursFilled, ...oppsFilled].map((p) => `${p.slug}:${p.teamType}:${p.team}`)
      ),
    [yoursFilled, oppsFilled]
  );

  const badgeOptions = useMemo(() => {
    if (!players) return [];
    return [...new Set(players.flatMap((p) => (p.badges ?? []).map((badge) => badge.name)))].sort();
  }, [players]);

  const pool = useMemo(() => {
    if (!players) return [];
    const query = q.trim().toLowerCase();
    return players
      .filter(
        (p) =>
          (posF === "ALL" || p.positions.includes(posF)) &&
          (eraF === "all" || p.teamType === eraF) &&
          p.overall >= minOvr && p.overall <= maxOvr &&
          (ratingTierF === "all" || getRatingTier(p.overall) === ratingTierF) &&
          (attributeF === "all" || (p.attributes?.[attributeF] ?? -1) >= attributeMin) &&
          (badgeF === "all" || (p.badges ?? []).some((badge) => badge.name === badgeF)) &&
          (badgeTierF === "all" || (p.badges ?? []).some((badge) => badge.tier === badgeTierF)) &&
          (!query || p.name.toLowerCase().includes(query))
      )
      .sort((a, b) => (sortF === "ovr" ? b.overall - a.overall : a.name.localeCompare(b.name)))
      .slice(0, POOL_LIMIT);
  }, [players, q, posF, eraF, minOvr, maxOvr, ratingTierF, attributeF, attributeMin, badgeF, badgeTierF, sortF]);

  const place = (side: Side, index: number, p: PoolPlayer) => {
    const setter = side === "yours" ? setYours : setOpps;
    setter((slots) => {
      const next = [...slots];
      next[index] = p;
      return next;
    });
  };

  const remove = (side: Side, index: number) => {
    const setter = side === "yours" ? setYours : setOpps;
    setter((slots) => {
      const next = [...slots];
      next[index] = null;
      return next;
    });
  };

  // The picker always targets the lineup the user explicitly opened it for.
  const tapPlace = (p: PoolPlayer) => {
    const idx = primarySlot(p);
    const slots = pickerSide === "yours" ? yours : opps;
    if (!slots[idx]) {
      place(pickerSide, idx, p);
      setPickerOpen(false);
      return;
    }
    const open = slots.findIndex((slot) => slot === null);
    if (open >= 0) {
      place(pickerSide, open, p);
      setPickerOpen(false);
      return;
    }
    toast(`${pickerSide === "yours" ? "Your" : "Opponent"} lineup is full — remove or replace a player first`);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.kind === "pool") setDragging(data.player as PoolPlayer);
    if (data?.kind === "chip") {
      const { side, index } = data as { side: Side; index: number };
      setDragging((side === "yours" ? yours : opps)[index]);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    lastDragEndRef.current = Date.now();
    const data = e.active.data.current;
    if (!data) return;
    const overId = e.over?.id as string | undefined;

    if (data.kind === "pool") {
      if (!overId?.startsWith("slot:")) return;
      const [, side, idxStr] = overId.split(":");
      place(side as Side, Number(idxStr), data.player as PoolPlayer);
      return;
    }

    if (data.kind === "chip") {
      const from = data as { side: Side; index: number };
      const moving = (from.side === "yours" ? yours : opps)[from.index];
      if (!moving) return;
      if (!overId?.startsWith("slot:")) {
        // dropped off-court → remove
        remove(from.side, from.index);
        return;
      }
      const [, toSideRaw, toIdxStr] = overId.split(":");
      const toSide = toSideRaw as Side;
      const toIndex = Number(toIdxStr);
      if (toSide === from.side && toIndex === from.index) return;
      const displaced = (toSide === "yours" ? yours : opps)[toIndex];
      place(toSide, toIndex, moving);
      if (displaced) place(from.side, from.index, displaced);
      else remove(from.side, from.index);
    }
  };

  // Tale of the tape
  const tape = useMemo(() => {
    const rows = [
      { label: "OVERALL", a: yourOvr, b: oppOvr },
      ...CATS.map((c) => ({
        label: CAT_LABELS[c],
        a: avgOf(yoursFilled, (p) => p.cats[c]),
        b: avgOf(oppsFilled, (p) => p.cats[c]),
      })),
    ];
    return rows.map((t) => {
      const aWins = t.a !== null && (!hasOpp || t.b === null || t.a >= t.b);
      const bWins = hasOpp && t.b !== null && (t.a === null || t.b >= t.a);
      return {
        ...t,
        aText: t.a ?? "—",
        bText: hasOpp ? (t.b ?? "—") : "—",
        aW: `${t.a ?? 0}%`,
        bW: hasOpp ? `${t.b ?? 0}%` : "0%",
        aC: aWins ? "#1a1918" : "#b5b0a1",
        bC: bWins ? "#1a1918" : "#b5b0a1",
        aBar: aWins ? "#1a1918" : "#c9c4b6",
        bBar: bWins ? "#1a1918" : "#c9c4b6",
      };
    });
  }, [yoursFilled, oppsFilled, yourOvr, oppOvr, hasOpp]);

  // Coach's / matchup read — data-driven
  const reads = useMemo(() => {
    if (yoursFilled.length === 0) {
      return [
        { tag: "START", c: "#8a8577", t: "Open the player picker and seat your five — mixing eras is the whole point." },
        { tag: "TIP", c: "#8a8577", t: "Use position, era, and rating filters to find the right fit; the analysis builds as you go." },
      ];
    }
    if (hasOpp) {
      const yo = yourOvr ?? 0;
      const oo = oppOvr ?? 0;
      return [
        {
          tag: yo >= oo ? "EDGE" : "TRAIL",
          c: yo >= oo ? "#0a7f3f" : "#c03a2b",
          t:
            yo >= oo
              ? `Your five carries the talent edge, ${yo} to ${oo} average overall.`
              : `They out-talent you ${oo} to ${yo} — you need the matchups to break right.`,
        },
        {
          tag: "WATCH",
          c: "#9a6700",
          t:
            oppsFilled.length < 5
              ? `Their five is incomplete (${oppsFilled.length}/5) — the tape firms up as spots fill.`
              : "All five duels are set. Playmaking and defense decide close tapes.",
        },
        { tag: "NOTE", c: "#8a8577", t: "Guard assignments default to position." },
      ];
    }
    const shooters = yoursFilled.filter((p) => (p.threePointShot ?? 0) >= 85);
    const playmakers = yoursFilled.filter((p) => (p.cats.ply ?? 0) >= 85);
    const bestReb = [...yoursFilled].sort((a, b) => (b.cats.reb ?? 0) - (a.cats.reb ?? 0))[0];
    const centers = yoursFilled.filter((p) => p.positions.includes("C"));
    return [
      {
        tag: "SPACING",
        c: shooters.length >= 3 ? "#0a7f3f" : shooters.length >= 1 ? "#9a6700" : "#c03a2b",
        t: shooters.length
          ? `${shooters.map((p) => lastName(p.name)).join(", ")} shoot${shooters.length === 1 ? "s" : ""} 85+ from deep.`
          : "Nobody placed shoots 85+ from three — the paint will be packed.",
      },
      {
        tag: "PLAYMAKING",
        c: playmakers.length >= 2 ? "#0a7f3f" : playmakers.length === 1 ? "#9a6700" : "#c03a2b",
        t: playmakers.length
          ? `${playmakers.length} player${playmakers.length === 1 ? "" : "s"} with 85+ playmaking — the ball moves.`
          : "No high-end creator yet — someone has to organize the offense.",
      },
      {
        tag: "GLASS",
        c: (bestReb?.cats.reb ?? 0) >= 85 ? "#0a7f3f" : (bestReb?.cats.reb ?? 0) >= 70 ? "#9a6700" : "#c03a2b",
        t: bestReb
          ? `${lastName(bestReb.name)} leads the glass at ${bestReb.cats.reb ?? "—"} rebounding; ${centers.length} true center${centers.length === 1 ? "" : "s"} placed.`
          : "No rebounding presence yet.",
      },
    ];
  }, [yoursFilled, oppsFilled, hasOpp, yourOvr, oppOvr]);

  const duels = useMemo(
    () =>
      SPOTS.map((s, i) => {
        const a = yours[i];
        const b = opps[i];
        if (!a || !b) return null;
        const edge = a.overall === b.overall ? "EVEN" : a.overall > b.overall ? "EDGE: YOU" : "EDGE: THEM";
        return {
          pos: s.pos,
          a,
          b,
          edge,
          eC: edge === "EVEN" ? "#9a6700" : edge === "EDGE: YOU" ? "#0a7f3f" : "#c03a2b",
        };
      }).filter((d): d is NonNullable<typeof d> => d !== null),
    [yours, opps]
  );

  const guardLines = SPOTS.map((s, i) =>
    yours[i] && opps[i] ? { x1: s.x + 2.5, y1: s.y, x2: 94 - s.x - 2.5, y2: s.y } : null
  ).filter((l): l is NonNullable<typeof l> => l !== null);

  const shareLineup = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => toast.success("Lineup URL copied — anyone can open it"));
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav hasApiKey={hasApiKey} width="wide" />

      <div className="mx-auto max-w-[1440px] px-[clamp(20px,4vw,48px)] pt-2 pb-12">
        <div className="flex flex-wrap items-center justify-between gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          <div>
            <div className="font-plex text-[9px] tracking-[0.12em] text-[#8a8577]">LINEUP LAB</div>
            <h1 className="mt-1 mb-0 font-display text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.03em]">
              {matchupMode ? "Build the matchup" : "Build your five"}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => { setPickerSide("yours"); setPickerOpen(true); }}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#1a1918] bg-white px-3.5 py-[7px] text-[11.5px] font-semibold transition-[background,transform] hover:bg-[#f1efe8] active:scale-[0.97]"
            >
              <Search className="h-3.5 w-3.5" /> Add player
            </button>
            {!matchupMode ? (
              <button
                type="button"
                onClick={() => setMatchupMode(true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#e5e2da] bg-white px-3.5 py-[7px] text-[11.5px] font-semibold transition-[border-color,transform] hover:border-[#1a1918] active:scale-[0.97]"
              >
                <UsersRound className="h-3.5 w-3.5" /> Add opponent
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setPickerSide("opps"); setPickerOpen(true); }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#e5e2da] bg-white px-3.5 py-[7px] text-[11.5px] font-semibold transition-[border-color,transform] hover:border-[#1a1918] active:scale-[0.97]"
              >
                <Search className="h-3.5 w-3.5" /> Add opponent player
              </button>
            )}
            {matchupMode && (
              <button
                type="button"
                onClick={() => { setOpps([null, null, null, null, null]); setMatchupMode(false); }}
                className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-3.5 py-[7px] text-[11.5px] font-semibold text-[#1a1918] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
              >
                Single lineup
              </button>
            )}
            {yoursFilled.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setYours([null, null, null, null, null]);
                  setOpps([null, null, null, null, null]);
                }}
                className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-3.5 py-[7px] text-[11.5px] font-semibold text-[#1a1918] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={shareLineup}
              className="cursor-pointer rounded-full bg-[#1a1918] px-3.5 py-[7px] text-[11.5px] font-semibold text-[#faf9f5] transition-[background,transform] duration-150 hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
            >
              Share lineup
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setDragging(null);
            lastDragEndRef.current = Date.now();
          }}
        >
          <div className="mt-4 grid items-start gap-3.5">
            {/* Player pool */}
            <div
              className="hidden overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white"
              style={{ animationDelay: "60ms" }}
            >
              <div className="border-b border-[#f1efe8] px-4 pt-[11px] pb-3">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="font-plex text-[9px] tracking-[0.1em] text-[#8a8577]">
                    PLAYER POOL — ANY ERA
                  </span>
                  <button
                    type="button"
                    onClick={() => setSortF((s) => (s === "ovr" ? "az" : "ovr"))}
                    className="cursor-pointer font-plex text-[8.5px] text-[#57534a] transition-colors duration-150 select-none hover:text-[#1a1918]"
                  >
                    SORT: {sortF === "ovr" ? "OVR" : "A–Z"} ⇅
                  </button>
                </div>
                <div className="mb-[9px] flex items-center gap-2 rounded-full border border-[#e5e2da] bg-[#faf9f5] px-3 py-2">
                  <Search className="h-[13px] w-[13px] text-[#8a8577]" strokeWidth={2} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search the pool…"
                    className="min-w-0 flex-1 border-none bg-transparent font-body text-[12.5px] text-[#1a1918] outline-none placeholder:text-[#b5b0a1]"
                  />
                </div>
                <div className="flex flex-wrap gap-[5px]">
                  {["ALL", ...POSITIONS].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setPosF(label)}
                      className={cn(
                        "cursor-pointer rounded-full border border-[#e5e2da] px-[11px] py-1 font-plex text-[8.5px] font-bold tracking-[0.06em] transition-[background,color,transform] duration-150 select-none active:scale-95 motion-reduce:transition-none",
                        posF === label
                          ? "bg-[#1a1918] text-[#faf9f5]"
                          : "bg-[#faf9f5] text-[#8a8577] hover:text-[#1a1918]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {players
                  ? pool.map((p) => (
                      <PoolRow
                        key={`${p.slug}:${p.teamType}:${p.team}`}
                        p={p}
                        placed={placedKeys.has(`${p.slug}:${p.teamType}:${p.team}`)}
                        onTap={guardedTap(() => tapPlace(p))}
                      />
                    ))
                  : Array.from({ length: 10 }, (_, i) => (
                      <div key={i} className="flex animate-pulse items-center gap-2.5 border-b border-[#faf8f2] px-4 py-[7px]">
                        <div className="h-7 w-7 rounded-full bg-[#f1efe8]" />
                        <div className="h-3.5 flex-1 rounded bg-[#f1efe8]" />
                        <div className="h-[20px] w-7 rounded-[5px] bg-[#f1efe8]" />
                      </div>
                    ))}
                {players && pool.length === 0 && (
                  <div className="px-4 py-[22px] text-center font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]">
                    NO PLAYERS MATCH — CLEAR THE FILTERS
                  </div>
                )}
              </div>
              <div className="px-4 py-[9px] font-plex text-[8px] leading-[1.6] text-[#b5b0a1]">
                DRAG OR TAP TO PLACE · TAP A CHIP TO REMOVE
              </div>
            </div>

            {/* Court + analysis */}
            <div className="min-w-0">
              <div
                className={cn(
                  "relative mx-auto overflow-hidden rounded-2xl border border-[#d9c49a] bg-[#f4e4c3] shadow-[0_22px_55px_-38px_rgba(81,59,29,0.7)] transition-[max-width,aspect-ratio] duration-500 ease-out animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:transition-none motion-reduce:animate-none",
                  matchupMode ? "aspect-[94/50] w-full max-w-none" : "aspect-[47/50] w-full max-w-[680px]"
                )}
                style={{ animationDelay: "100ms" }}
              >
                <CourtDiagram matchupMode={matchupMode} guardLines={guardLines} />

                <span className={cn("absolute top-2.5 font-plex text-[8.5px] tracking-[0.1em] text-[#b5b0a1]", matchupMode ? "left-3.5" : "left-1/2 -translate-x-1/2")}>
                  YOUR FIVE · {yoursFilled.length}/5
                  {yourOvr !== null && (
                    <>
                      {" · "}
                      <b className="text-[#1a1918]">{yourOvr} OVR</b>
                    </>
                  )}
                </span>
                {matchupMode && <span className="absolute top-2.5 right-3.5 font-plex text-[8.5px] tracking-[0.1em] text-[#b5b0a1]">
                  {hasOpp ? (
                    <>
                      THEIR FIVE · {oppsFilled.length}/5 ·{" "}
                      <b className="text-[#1a1918]">{oppOvr} OVR</b>
                    </>
                  ) : (
                    "OPEN HALF — ADD AN OPPONENT"
                  )}
                </span>}

                {SPOTS.map((spot, i) => (
                  <CourtSlot
                    key={`yours-${spot.pos}`}
                    side="yours"
                    index={i}
                    spot={spot}
                    player={yours[i]}
                    compareMode={matchupMode}
                    pulsing={false}
                    onRemove={guardedTap(() => remove("yours", i))}
                  />
                ))}
                {matchupMode && SPOTS.map((spot, i) => (
                  <CourtSlot
                    key={`opps-${spot.pos}`}
                    side="opps"
                    index={i}
                    spot={spot}
                    player={opps[i]}
                    compareMode={matchupMode}
                    pulsing={hasOpp}
                    onRemove={guardedTap(() => remove("opps", i))}
                  />
                ))}

                {!matchupMode && yoursFilled.length === 0 && (
                  <button type="button" onClick={() => { setPickerSide("yours"); setPickerOpen(true); }} className="absolute bottom-[8%] left-1/2 -translate-x-1/2 cursor-pointer rounded-full bg-[#1a1918] px-4 py-2 text-[11px] font-semibold text-white shadow-lg">
                    Choose your first player
                  </button>
                )}
              </div>

              {/* Tape + read */}
              <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
                <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-plex text-[9px] tracking-[0.12em] text-[#8a8577]">
                      {hasOpp ? "TALE OF THE TAPE" : "LINEUP COMPOSITION"}
                    </span>
                    <span className="font-plex text-[8.5px] text-[#b5b0a1]">
                      {hasOpp ? "YOU ← → THEM" : "YOUR FIVE ONLY"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-[9px]">
                    {tape.map((t) => (
                      <div key={t.label} className="grid grid-cols-[34px_1fr_84px_1fr_34px] items-center gap-2">
                        <span className="text-right font-plex text-[10.5px] font-bold" style={{ color: t.aC }}>
                          {t.aText}
                        </span>
                        <div className="relative h-1.5 rounded-full bg-[#f1efe8]">
                          <div
                            className="absolute top-0 right-0 h-full rounded-full transition-[width] duration-350"
                            style={{ width: t.aW, background: t.aBar }}
                          />
                        </div>
                        <span className="text-center font-plex text-[7.5px] tracking-[0.06em] text-[#8a8577]">
                          {t.label}
                        </span>
                        <div className="relative h-1.5 rounded-full bg-[#f1efe8]">
                          <div
                            className="absolute top-0 left-0 h-full rounded-full transition-[width] duration-350"
                            style={{ width: t.bW, background: t.bBar }}
                          />
                        </div>
                        <span className="font-plex text-[10.5px] font-bold" style={{ color: t.bC }}>
                          {t.bText}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5">
                  <div className="mb-3 font-plex text-[9px] tracking-[0.12em] text-[#8a8577]">
                    {hasOpp ? "THE MATCHUP READ" : "THE COACH'S READ"}
                  </div>
                  <div className="flex flex-col gap-[9px]">
                    {reads.map((r) => (
                      <div key={r.tag + r.t} className="flex gap-2.5 text-[12.5px] leading-[1.55]">
                        <span
                          className="shrink-0 pt-0.5 font-plex text-[9px] font-bold"
                          style={{ color: r.c }}
                        >
                          {r.tag}
                        </span>
                        <span className="text-[#57534a]">{r.t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Duels */}
              {hasOpp && duels.length > 0 && (
                <div className="mt-3 overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white animate-[rise-in_300ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
                  <div className="flex items-center justify-between border-b border-[#f1efe8] px-[18px] py-[11px]">
                    <span className="font-plex text-[9px] tracking-[0.12em] text-[#8a8577]">
                      THE DUELS — WHO GUARDS WHO
                    </span>
                    <span className="font-plex text-[8.5px] text-[#b5b0a1]">DEFAULT: BY POSITION</span>
                  </div>
                  {duels.map((d) => (
                    <div
                      key={d.pos}
                      className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-[#faf8f2] px-[18px] py-[9px]"
                    >
                      <span className="w-5 font-plex text-[8.5px] tracking-[0.08em] text-[#b5b0a1]">
                        {d.pos}
                      </span>
                      <span className="text-[12.5px] font-bold">{lastName(d.a.name)}</span>
                      <span
                        className={cn(
                          "inline-flex min-w-[26px] items-center justify-center rounded-[5px] px-1 py-0.5 text-[10px] font-bold text-white",
                          getRatingClasses(d.a.overall).bg
                        )}
                      >
                        {d.a.overall}
                      </span>
                      <span className="font-plex text-[8.5px] text-[#b5b0a1]">VS</span>
                      <span
                        className={cn(
                          "inline-flex min-w-[26px] items-center justify-center rounded-[5px] px-1 py-0.5 text-[10px] font-bold text-white",
                          getRatingClasses(d.b.overall).bg
                        )}
                      >
                        {d.b.overall}
                      </span>
                      <span className="text-[12.5px] font-bold">{lastName(d.b.name)}</span>
                      <span className="ml-auto font-plex text-[8.5px] font-bold" style={{ color: d.eC }}>
                        {d.edge}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {pickerOpen && (
            <div
              className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center bg-[#1a1918]/35 backdrop-blur-[2px] lg:items-stretch lg:justify-end lg:bg-transparent lg:backdrop-blur-none"
              role="dialog"
              aria-modal="true"
              aria-label={`Choose a player for ${pickerSide === "yours" ? "your lineup" : "the opponent"}`}
            >
              <div className="pointer-events-auto flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-[22px] border border-[#d9d4c7] bg-[#fffdf8] shadow-[0_30px_80px_-24px_rgba(26,25,24,0.55)] lg:my-3 lg:mr-3 lg:max-h-none lg:w-[440px] lg:rounded-[22px]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e5e2da] px-5 py-4">
                  <div>
                    <div className="font-plex text-[9px] tracking-[0.12em] text-[#8a8577]">
                      {pickerSide === "yours" ? "YOUR FIVE" : "OPPONENT"} · PLAYER PICKER
                    </div>
                    <h2 className="mt-1 mb-0 font-display text-[24px] font-bold tracking-[-0.025em]">Find the right player</h2>
                  </div>
                  <button type="button" onClick={() => setPickerOpen(false)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#e5e2da] bg-white hover:border-[#1a1918]" aria-label="Close player picker">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="border-b border-[#e5e2da] bg-white px-5 py-4">
                  <div className="flex items-center gap-2 rounded-full border border-[#d9d4c7] bg-[#faf9f5] px-4 py-3">
                    <Search className="h-4 w-4 text-[#8a8577]" />
                    <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any player or legend…" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] outline-none placeholder:text-[#b5b0a1]" />
                    <span className="font-plex text-[8px] text-[#b5b0a1]">{pool.length} SHOWN</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5 font-plex text-[8px] tracking-[0.08em] text-[#8a8577]"><SlidersHorizontal className="h-3 w-3" /> POSITION</div>
                      <div className="flex flex-wrap gap-1.5">
                        {["ALL", ...POSITIONS].map((label) => <button key={label} type="button" onClick={() => setPosF(label)} className={cn("cursor-pointer rounded-full border px-2.5 py-1 font-plex text-[8px] font-bold", posF === label ? "border-[#1a1918] bg-[#1a1918] text-white" : "border-[#e5e2da] bg-[#faf9f5] text-[#8a8577]")}>{label}</button>)}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">ERA</div>
                      <div className="flex flex-wrap gap-1.5">
                        {([['all','ALL'],['curr','CURRENT'],['class','CLASSIC'],['allt','ALL-TIME']] as const).map(([value,label]) => <button key={value} type="button" onClick={() => setEraF(value)} className={cn("cursor-pointer rounded-full border px-2.5 py-1 font-plex text-[8px] font-bold", eraF === value ? "border-[#1a1918] bg-[#1a1918] text-white" : "border-[#e5e2da] bg-[#faf9f5] text-[#8a8577]")}>{label}</button>)}
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">CARD TIER</span>
                      <select value={ratingTierF} onChange={(e) => setRatingTierF(e.target.value)} className="h-9 w-full rounded-[9px] border border-[#e5e2da] bg-[#faf9f5] px-2.5 text-[11px] outline-none focus:border-[#1a1918]">
                        <option value="all">Any tier</option>
                        {RATING_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                      </select>
                    </label>
                    <div>
                      <span className="mb-1.5 block font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">OVERALL RANGE</span>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <input aria-label="Minimum overall" type="number" min="0" max="99" value={minOvr} onChange={(e) => setMinOvr(Math.min(Number(e.target.value), maxOvr))} className="h-9 min-w-0 rounded-[9px] border border-[#e5e2da] bg-[#faf9f5] px-2.5 text-[11px] outline-none focus:border-[#1a1918]" />
                        <span className="font-plex text-[8px] text-[#b5b0a1]">TO</span>
                        <input aria-label="Maximum overall" type="number" min="0" max="99" value={maxOvr} onChange={(e) => setMaxOvr(Math.max(Number(e.target.value), minOvr))} className="h-9 min-w-0 rounded-[9px] border border-[#e5e2da] bg-[#faf9f5] px-2.5 text-[11px] outline-none focus:border-[#1a1918]" />
                      </div>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">SPECIFIC ATTRIBUTE</span>
                      <select value={attributeF} onChange={(e) => setAttributeF(e.target.value)} className="h-9 w-full rounded-[9px] border border-[#e5e2da] bg-[#faf9f5] px-2.5 text-[11px] outline-none focus:border-[#1a1918]">
                        <option value="all">Any attribute</option>
                        {ATTRIBUTE_KEYS.map((key) => <option key={key} value={key}>{getAttributeDisplayName(key)}</option>)}
                      </select>
                    </label>
                    <label className={cn("block", attributeF === "all" && "opacity-45")}>
                      <span className="mb-1.5 block font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">ATTRIBUTE MIN · {attributeMin}</span>
                      <input disabled={attributeF === "all"} type="range" min="25" max="99" value={attributeMin} onChange={(e) => setAttributeMin(Number(e.target.value))} className="w-full accent-[#1a1918]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">SPECIFIC BADGE</span>
                      <select value={badgeF} onChange={(e) => setBadgeF(e.target.value)} className="h-9 w-full rounded-[9px] border border-[#e5e2da] bg-[#faf9f5] px-2.5 text-[11px] outline-none focus:border-[#1a1918]">
                        <option value="all">Any badge</option>
                        {badgeOptions.map((badge) => <option key={badge} value={badge}>{badge}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-plex text-[8px] tracking-[0.08em] text-[#8a8577]">BADGE TIER</span>
                      <select value={badgeTierF} onChange={(e) => setBadgeTierF(e.target.value)} className="h-9 w-full rounded-[9px] border border-[#e5e2da] bg-[#faf9f5] px-2.5 text-[11px] outline-none focus:border-[#1a1918]">
                        <option value="all">Any badge tier</option>
                        {BADGE_TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <button type="button" onClick={() => { setQ(""); setPosF("ALL"); setEraF("all"); setMinOvr(0); setMaxOvr(99); setRatingTierF("all"); setAttributeF("all"); setAttributeMin(80); setBadgeF("all"); setBadgeTierF("all"); }} className="cursor-pointer border-0 bg-transparent font-plex text-[8px] text-[#8a8577] underline underline-offset-4">CLEAR FILTERS</button>
                    <button type="button" onClick={() => setSortF((s) => s === "ovr" ? "az" : "ovr")} className="cursor-pointer border-0 bg-transparent font-plex text-[8px] text-[#57534a]">SORT · {sortF === "ovr" ? "OVR ↓" : "A–Z"}</button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-white">
                  {players ? pool.map((p) => (
                    <PoolRow key={`${p.slug}:${p.teamType}:${p.team}`} p={p} placed={placedKeys.has(`${p.slug}:${p.teamType}:${p.team}`)} onTap={guardedTap(() => tapPlace(p))} />
                  )) : Array.from({ length: 8 }, (_, i) => <div key={i} className="h-12 animate-pulse border-b border-[#faf8f2] bg-[#f1efe8]" />)}
                  {players && pool.length === 0 && <div className="px-5 py-16 text-center font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]">NO MATCHES · TRY WIDENING THE FILTERS</div>}
                </div>
                <div className="border-t border-[#e5e2da] bg-[#faf9f5] px-5 py-3 font-plex text-[8px] text-[#8a8577]">DRAG ONTO A COURT SLOT · TAP TO AUTO-PLACE · VERSIONS STAY SEPARATE BY ERA + TEAM</div>
              </div>
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {dragging && (
              <div className="pointer-events-none flex items-center gap-2 rounded-full border-2 border-[#1a1918] bg-white px-2 py-1 shadow-[0_8px_20px_-8px_rgba(26,25,24,0.5)]">
                <Headshot src={dragging.playerImage} name={dragging.name} size={26} />
                <span className="text-[11.5px] font-bold">{lastName(dragging.name)}</span>
                <MiniOvr ovr={dragging.overall} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <FooterStrip width="wide" />
    </div>
  );
}

export default function LineupsPage() {
  return (
    <Suspense fallback={null}>
      <Whiteboard />
    </Suspense>
  );
}
