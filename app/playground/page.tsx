"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvex, useQuery } from "convex/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { PlayerTable, type TablePlayer } from "@/components/ui/player-table";
import { ATTRIBUTE_PARAM_ALIASES } from "@/convex/_validation";
import { ATTRIBUTE_CATEGORIES } from "@/convex/attributeCategories";
import { ATTRIBUTE_SHORT_LABELS } from "@/lib/attribute-labels";
import { getAttributeDisplayName } from "@/lib/attribute-normalizer";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ---- vocabulary -------------------------------------------------------------

const POS_OPTIONS = [
  { value: "any", label: "anyone" },
  { value: "guard", label: "guards" },
  { value: "wing", label: "wings" },
  { value: "big", label: "bigs" },
  { value: "PG", label: "PGs" },
  { value: "SG", label: "SGs" },
  { value: "SF", label: "SFs" },
  { value: "PF", label: "PFs" },
  { value: "C", label: "Cs" },
];
const POS_GROUPS: Record<string, string[]> = {
  guard: ["PG", "SG"],
  wing: ["SG", "SF"],
  big: ["PF", "C"],
};

const ERA_OPTIONS = [
  { value: "all", label: "any era" },
  { value: "curr", label: "the current league" },
  { value: "class", label: "the classics" },
  { value: "allt", label: "the all-time teams" },
] as const;
type Era = (typeof ERA_OPTIONS)[number]["value"];

const THRESHOLDS = [60, 70, 75, 80, 85, 90, 95];

// camelCase attribute → snake alias for URLs (friendly aliases win)
const CAMEL_TO_SNAKE: Record<string, string> = {};
for (const [snake, camel] of Object.entries(ATTRIBUTE_PARAM_ALIASES)) {
  CAMEL_TO_SNAKE[camel] = snake;
}

const PAGE_SIZE = 50;

type Filter = { key: string; gte: number } | null;

type QueryState = {
  pos: string;
  era: Era;
  filter: Filter;
  sortKey: string; // "overall" | attribute key
  sortDir: "asc" | "desc";
  team: string | null;
  search: string | null;
  page: number;
};

const SHOWCASE: QueryState = {
  pos: "guard",
  era: "all",
  filter: { key: "threePointShot", gte: 85 },
  sortKey: "overall",
  sortDir: "desc",
  team: null,
  search: null,
  page: 0,
};

const SAVED_QUERIES: { label: string; state: QueryState }[] = [
  {
    label: "Lockdown wings, any era",
    state: { pos: "wing", era: "all", filter: { key: "perimeterDefense", gte: 85 }, sortKey: "perimeterDefense", sortDir: "desc", team: null, search: null, page: 0 },
  },
  {
    label: "Bigs who shoot 80+",
    state: { pos: "big", era: "all", filter: { key: "threePointShot", gte: 80 }, sortKey: "threePointShot", sortDir: "desc", team: null, search: null, page: 0 },
  },
  {
    label: "'96 Bulls full roster",
    state: { pos: "any", era: "class", filter: null, sortKey: "overall", sortDir: "desc", team: "1995-96 Chicago Bulls", search: null, page: 0 },
  },
];

// ---- URL <-> state ----------------------------------------------------------

function stateFromParams(sp: URLSearchParams): QueryState {
  const known = ["position", "era", "sort", "team", "search", "cursor"];
  const hasGte = [...sp.keys()].some(
    (k) => k.endsWith("_gte") && ATTRIBUTE_PARAM_ALIASES[k.slice(0, -4)]
  );
  const isDeepLink = known.some((k) => sp.has(k)) || hasGte;
  if (!isDeepLink) return SHOWCASE;

  const posRaw = sp.get("position");
  const pos =
    posRaw && POS_OPTIONS.some((o) => o.value === posRaw)
      ? posRaw
      : posRaw && POS_OPTIONS.some((o) => o.value === posRaw.toUpperCase())
        ? posRaw.toUpperCase()
        : "any";

  const eraRaw = sp.get("era");
  const era: Era = ERA_OPTIONS.some((o) => o.value === eraRaw) ? (eraRaw as Era) : "all";

  let filter: Filter = null;
  for (const [key, value] of sp.entries()) {
    if (!key.endsWith("_gte")) continue;
    const attr = ATTRIBUTE_PARAM_ALIASES[key.slice(0, -4)];
    const num = Number(value);
    if (attr && Number.isFinite(num)) {
      filter = { key: attr, gte: num };
      break;
    }
  }

  const [sortField, sortDirRaw] = (sp.get("sort") ?? "").split(":");
  const sortKey =
    sortField === "overall" ? "overall" : (ATTRIBUTE_PARAM_ALIASES[sortField] ?? "overall");

  const cursor = Number(sp.get("cursor"));
  return {
    pos,
    era,
    filter,
    sortKey,
    sortDir: sortDirRaw === "asc" ? "asc" : "desc",
    team: sp.get("team"),
    search: sp.get("search"),
    page: Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor / PAGE_SIZE) : 0,
  };
}

function paramsFromState(s: QueryState): string {
  const params = new URLSearchParams();
  if (s.pos !== "any") params.set("position", s.pos);
  params.set("era", s.era);
  if (s.filter)
    params.set(`${CAMEL_TO_SNAKE[s.filter.key] ?? s.filter.key}_gte`, String(s.filter.gte));
  if (s.team) params.set("team", s.team);
  if (s.search) params.set("search", s.search);
  params.set(
    "sort",
    `${s.sortKey === "overall" ? "overall" : (CAMEL_TO_SNAKE[s.sortKey] ?? s.sortKey)}:${s.sortDir}`
  );
  if (s.page > 0) params.set("cursor", String(s.page * PAGE_SIZE));
  return params.toString();
}

// ---- slot menus ---------------------------------------------------------------

const MENU_CONTENT =
  "z-50 max-h-[340px] min-w-[210px] overflow-y-auto rounded-xl border border-[#e5e2da] bg-white p-1 font-body shadow-[0_24px_48px_-20px_rgba(26,25,24,0.35)]";
const MENU_ITEM =
  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[#1a1918] outline-none select-none data-[highlighted]:bg-[#f1efe8]";
const MENU_LABEL = "px-3 pt-2 pb-1 font-plex text-[7.5px] tracking-[0.12em] text-[#b5b0a1]";

function SlotTrigger({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1.5 border-b-2 border-dashed border-[#d9d4c7] px-[3px] pb-px font-extrabold text-[#1a1918] transition-[border-color] duration-150 outline-none select-none hover:border-[#1a1918] data-[state=open]:border-[#1a1918]"
      >
        {children}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b5b0a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </DropdownMenu.Trigger>
  );
}

function Check({ on }: { on: boolean }) {
  return on ? <span className="text-[10px] text-[#0a7f3f]">●</span> : null;
}

function AttributeMenuItems({
  current,
  onPick,
}: {
  current: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <>
      {(Object.entries(ATTRIBUTE_CATEGORIES) as [string, readonly string[]][]).map(
        ([category, keys]) => (
          <div key={category}>
            <div className={MENU_LABEL}>{category.replace(/([A-Z])/g, " $1").toUpperCase()}</div>
            {keys.map((key) => (
              <DropdownMenu.Item key={key} className={MENU_ITEM} onSelect={() => onPick(key)}>
                <span>
                  {getAttributeDisplayName(key)}{" "}
                  <span className="font-plex text-[8px] text-[#b5b0a1]">
                    {ATTRIBUTE_SHORT_LABELS[key]}
                  </span>
                </span>
                <Check on={current === key} />
              </DropdownMenu.Item>
            ))}
          </div>
        )
      )}
    </>
  );
}

// ---- page -------------------------------------------------------------------

function filterLabel(filter: Filter): string {
  if (!filter) return "no attribute floor";
  return `${ATTRIBUTE_SHORT_LABELS[filter.key] ?? filter.key} ≥ ${filter.gte}`;
}

function sortLabel(sortKey: string): string {
  return sortKey === "overall" ? "overall" : getAttributeDisplayName(sortKey).toLowerCase();
}

function Playground() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const convex = useConvex();
  const [q, setQ] = useState<QueryState>(() => stateFromParams(searchParams));
  const [copied, setCopied] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  // Two-way URL sync. lastSyncedRef remembers the last string either side
  // agreed on, so an externally-changed URL (back/forward, in-app link) is
  // adopted into state instead of being clobbered by a stale mirror write.
  const lastSyncedRef = useRef(searchParams.toString());
  useEffect(() => {
    const urlNow = searchParams.toString();
    const stateNow = paramsFromState(q);
    if (urlNow === stateNow) {
      lastSyncedRef.current = urlNow;
      return;
    }
    if (urlNow !== lastSyncedRef.current) {
      lastSyncedRef.current = urlNow;
      setQ(stateFromParams(new URLSearchParams(urlNow)));
    } else {
      lastSyncedRef.current = stateNow;
      router.replace(`/playground?${stateNow}`, { scroll: false });
    }
  }, [q, router, searchParams]);

  const queryArgs = useMemo(
    () => ({
      teamType: q.era === "all" ? undefined : q.era,
      positions: POS_GROUPS[q.pos] ?? (q.pos !== "any" ? [q.pos] : undefined),
      attributeFilters: q.filter ? [{ key: q.filter.key, gte: q.filter.gte }] : undefined,
      sortBy:
        q.sortKey === "overall"
          ? (`overall-${q.sortDir}` as "overall-asc" | "overall-desc")
          : undefined,
      sortByAttribute: q.sortKey !== "overall" ? { key: q.sortKey, dir: q.sortDir } : undefined,
      search: q.search ?? undefined,
      teams: q.team ? [q.team] : undefined,
      limit: PAGE_SIZE,
      offset: q.page * PAGE_SIZE,
    }),
    [q]
  );

  const result = useQuery(api.players.getAllFiltered, queryArgs) as
    | { players: TablePlayer[]; totalCount: number; hasMore: boolean }
    | undefined;

  // Keep the previous page rendered while the next loads (no flash). The
  // page number is cached WITH the result so stale rows keep their own
  // ranks/footer instead of borrowing the incoming page's.
  const lastGood = useRef<{ data: NonNullable<typeof result>; page: number } | undefined>(
    undefined
  );
  if (result) lastGood.current = { data: result, page: q.page };
  const shown = result ? { data: result, page: q.page } : lastGood.current;
  const data = shown?.data;
  const shownPage = shown?.page ?? 0;
  const updating = result === undefined && lastGood.current !== undefined;

  const requestUrl = `/api/players?${paramsFromState(q)}`;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;

  const set = (patch: Partial<QueryState>) =>
    setQ((s) => ({ ...s, ...patch, page: patch.page ?? 0 }));

  const onSort = (key: string) =>
    setQ((s) => ({
      ...s,
      sortKey: key,
      sortDir: s.sortKey === key ? (s.sortDir === "desc" ? "asc" : "desc") : "desc",
      page: 0,
    }));

  const copyUrl = () => {
    navigator.clipboard.writeText(`https://api.nba2kapi.com${requestUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const fetchAll = async () => {
    const full = await convex.query(api.players.getAllFiltered, {
      ...queryArgs,
      limit: 2000,
      offset: 0,
    });
    return full.players as TablePlayer[];
  };

  const exportCsv = async () => {
    const players = await fetchAll();
    const attrKeys = Object.values(ATTRIBUTE_CATEGORIES).flat();
    const header = [
      "name",
      "slug",
      "team",
      "era",
      "positions",
      "height",
      "overall",
      ...attrKeys.map((k) => CAMEL_TO_SNAKE[k] ?? k),
    ].join(",");
    const lines = players.map((p) =>
      [
        `"${p.name.replace(/"/g, '""')}"`,
        p.slug,
        `"${p.team.replace(/"/g, '""')}"`,
        p.teamType,
        `"${(p.positions ?? []).join("/")}"`,
        p.height ?? "",
        p.overall,
        ...attrKeys.map((k) => p.attributes?.[k] ?? ""),
      ].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nba2kapi-query.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${players.length} players — every attribute included`);
  };

  const copyJson = async () => {
    const players = await fetchAll();
    const payload = {
      success: true,
      count: players.length,
      results: players.map((p) => ({
        name: p.name,
        slug: p.slug,
        team: p.team,
        era: p.teamType,
        positions: p.positions ?? [],
        overall: p.overall,
        attributes: p.attributes ?? {},
      })),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success(`Response JSON copied (${players.length} players)`);
  };

  const first = data?.players[0];

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav hasApiKey={hasApiKey} width="wide" />

      {/* Query card */}
      <div className="mx-auto max-w-[1440px] animate-[rise-in_400ms_cubic-bezier(0.23,1,0.32,1)_both] px-[clamp(20px,4vw,48px)] pt-2 motion-reduce:animate-none">
        <div className="rounded-2xl border border-[#e5e2da] bg-white p-[clamp(16px,2.5vw,24px)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]">
              QUERY
            </span>
          </div>

          <div className="font-display text-[clamp(19px,2.2vw,25px)] leading-[1.75] font-semibold tracking-[-0.02em] text-[#57534a]">
            Show me{" "}
            <DropdownMenu.Root>
              <SlotTrigger>{POS_OPTIONS.find((o) => o.value === q.pos)?.label}</SlotTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={MENU_CONTENT} sideOffset={6} align="start">
                  <div className={MENU_LABEL}>GROUPS</div>
                  {POS_OPTIONS.slice(0, 4).map((o) => (
                    <DropdownMenu.Item
                      key={o.value}
                      className={MENU_ITEM}
                      onSelect={() => set({ pos: o.value })}
                    >
                      {o.label} <Check on={q.pos === o.value} />
                    </DropdownMenu.Item>
                  ))}
                  <div className={MENU_LABEL}>EXACT POSITION</div>
                  {POS_OPTIONS.slice(4).map((o) => (
                    <DropdownMenu.Item
                      key={o.value}
                      className={MENU_ITEM}
                      onSelect={() => set({ pos: o.value })}
                    >
                      {o.label} <Check on={q.pos === o.value} />
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>{" "}
            from{" "}
            <DropdownMenu.Root>
              <SlotTrigger>{ERA_OPTIONS.find((o) => o.value === q.era)?.label}</SlotTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={MENU_CONTENT} sideOffset={6} align="start">
                  {ERA_OPTIONS.map((o) => (
                    <DropdownMenu.Item
                      key={o.value}
                      className={MENU_ITEM}
                      onSelect={() => set({ era: o.value })}
                    >
                      {o.label} <Check on={q.era === o.value} />
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>{" "}
            with{" "}
            <DropdownMenu.Root>
              <SlotTrigger>{filterLabel(q.filter)}</SlotTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className={cn(MENU_CONTENT, "min-w-[260px]")}
                  sideOffset={6}
                  align="start"
                >
                  <div className={MENU_LABEL}>FLOOR</div>
                  <div className="flex flex-wrap gap-1 px-2 pb-1.5">
                    {THRESHOLDS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() =>
                          set({ filter: { key: q.filter?.key ?? "threePointShot", gte: t } })
                        }
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-0.5 font-plex text-[9px] font-bold",
                          q.filter?.gte === t
                            ? "border-[#1a1918] bg-[#1a1918] text-[#faf9f5]"
                            : "border-[#e5e2da] bg-[#faf9f5] text-[#57534a] hover:border-[#1a1918]"
                        )}
                      >
                        ≥{t}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => set({ filter: null })}
                      className={cn(
                        "cursor-pointer rounded-full border px-2.5 py-0.5 font-plex text-[9px] font-bold",
                        !q.filter
                          ? "border-[#1a1918] bg-[#1a1918] text-[#faf9f5]"
                          : "border-[#e5e2da] bg-[#faf9f5] text-[#57534a] hover:border-[#1a1918]"
                      )}
                    >
                      NONE
                    </button>
                  </div>
                  <AttributeMenuItems
                    current={q.filter?.key ?? null}
                    onPick={(key) => set({ filter: { key, gte: q.filter?.gte ?? 85 } })}
                  />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            , ranked by{" "}
            <DropdownMenu.Root>
              <SlotTrigger>{sortLabel(q.sortKey)}</SlotTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={MENU_CONTENT} sideOffset={6} align="start">
                  <DropdownMenu.Item
                    className={MENU_ITEM}
                    onSelect={() => set({ sortKey: "overall", sortDir: "desc" })}
                  >
                    overall <Check on={q.sortKey === "overall"} />
                  </DropdownMenu.Item>
                  <AttributeMenuItems
                    current={q.sortKey === "overall" ? null : q.sortKey}
                    onPick={(key) => set({ sortKey: key, sortDir: "desc" })}
                  />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
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

      {/* Meta strip: count + chips + saved queries + exports */}
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2.5 px-[clamp(20px,4vw,48px)] pt-3.5">
        <span className="font-plex text-[10px] tracking-[0.08em] text-[#8a8577]">
          <b className="text-[#1a1918]">{data ? `${data.totalCount} MATCH` : "LOADING"}</b>
          {updating && " · UPDATING…"}
        </span>
        {q.team && (
          <button
            type="button"
            onClick={() => set({ team: null })}
            className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-2.5 py-0.5 font-plex text-[9px] tracking-[0.08em] text-[#57534a] hover:border-[#1a1918]"
          >
            TEAM: {q.team.toUpperCase()} ✕
          </button>
        )}
        {q.search && (
          <button
            type="button"
            onClick={() => set({ search: null })}
            className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-2.5 py-0.5 font-plex text-[9px] tracking-[0.08em] text-[#57534a] hover:border-[#1a1918]"
          >
            NAME: &quot;{q.search.toUpperCase()}&quot; ✕
          </button>
        )}
        <span className="mx-1 hidden h-4 w-px bg-[#e5e2da] sm:block" />
        <span className="font-plex text-[8.5px] tracking-[0.1em] text-[#b5b0a1]">SAVED</span>
        {SAVED_QUERIES.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setQ(s.state)}
            className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-3 py-1 text-[11px] font-semibold text-[#1a1918] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
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

      {/* Response drawer — visible, above the table */}
      <div className="mx-auto max-w-[1440px] px-[clamp(20px,4vw,48px)] pt-2.5">
        <div className="overflow-hidden rounded-[12px] bg-[#1a1918]">
          <button
            type="button"
            onClick={() => setResponseOpen((o) => !o)}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2"
          >
            <span className="font-plex text-[9px] tracking-[0.1em] text-white/60">RESPONSE</span>
            <span className="font-plex text-[8.5px] text-[#6ee7a0]">
              {data ? `200 OK · ${data.totalCount} RESULTS` : "LOADING…"}
            </span>
            <span className="ml-auto font-plex text-[8.5px] text-white/60">
              {responseOpen ? "▾ HIDE JSON" : "▸ VIEW JSON"}
            </span>
          </button>
          {responseOpen && (
            <pre className="m-0 overflow-x-auto border-t border-white/10 px-4 py-3 font-plex text-[10px] leading-[1.65] text-white/85">
              {"{\n  "}
              <span className="text-[#8ab4f8]">&quot;success&quot;</span>
              {": true,\n  "}
              <span className="text-[#8ab4f8]">&quot;count&quot;</span>
              {`: ${data?.totalCount ?? 0},\n  `}
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
                  <span className="text-[#8ab4f8]">&quot;attributes&quot;</span>
                  {": { "}
                  <span className="text-[#8ab4f8]">&quot;threePointShot&quot;</span>
                  {": "}
                  <span className="text-[#b79ce0]">
                    {first.attributes?.threePointShot ?? "null"}
                  </span>
                  {", "}
                  <span className="text-white/40">
                    …{Object.keys(first.attributes ?? {}).length} fields
                  </span>
                  {" }\n    },\n    "}
                  <span className="text-white/40">
                    …{Math.max(0, (data?.totalCount ?? 1) - 1)} more
                  </span>
                  {"\n"}
                </>
              ) : (
                <span className="text-white/40">{"    …\n"}</span>
              )}
              {"  ],\n  "}
              <span className="text-[#8ab4f8]">&quot;meta&quot;</span>
              {": { "}
              <span className="text-[#8ab4f8]">&quot;pagination&quot;</span>
              {`: { `}
              <span className="text-[#8ab4f8]">&quot;total&quot;</span>
              {`: ${data?.totalCount ?? 0}, `}
              <span className="text-[#8ab4f8]">&quot;limit&quot;</span>
              {`: ${PAGE_SIZE} } }\n}`}
            </pre>
          )}
        </div>
      </div>

      {/* Full-attribute table */}
      <div className="mx-auto max-w-[1440px] px-[clamp(20px,4vw,48px)] pt-2.5 pb-12">
        <div
          className={cn(
            "overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white transition-opacity duration-150",
            updating && "opacity-60"
          )}
        >
          <PlayerTable
            players={data?.players ?? []}
            rankOffset={shownPage * PAGE_SIZE}
            queriedKey={q.filter?.key ?? null}
            sortKey={q.sortKey}
            sortDir={q.sortDir}
            onSort={onSort}
            playerHref={(p) =>
              `/players/${p.slug}?type=${p.teamType}&team=${encodeURIComponent(p.team)}`
            }
            emptyText="NO PLAYERS MATCH — LOOSEN A SLOT"
            loading={!data}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1efe8] bg-[#faf9f5] px-4 py-2">
            <span className="font-plex text-[8.5px] text-[#b5b0a1]">
              {q.filter ? "TINTED = QUERIED COLUMN · " : ""}CLICK ANY COLUMN TO SORT · CLICK A
              PLAYER → DOSSIER
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={q.page === 0}
                onClick={() => setQ((s) => ({ ...s, page: Math.max(0, s.page - 1) }))}
                className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-2.5 py-0.5 font-plex text-[9px] font-bold text-[#57534a] disabled:cursor-default disabled:opacity-40 [&:not(:disabled)]:hover:border-[#1a1918]"
              >
                ‹ PREV
              </button>
              <span className="font-plex text-[8.5px] text-[#8a8577]">
                {data
                  ? `SHOWING ${data.totalCount === 0 ? 0 : shownPage * PAGE_SIZE + 1}–${Math.min((shownPage + 1) * PAGE_SIZE, data.totalCount)} OF ${data.totalCount} · PAGE ${Math.min(shownPage + 1, totalPages)}/${totalPages}`
                  : "…"}
              </span>
              <button
                type="button"
                disabled={!data?.hasMore}
                onClick={() => setQ((s) => ({ ...s, page: s.page + 1 }))}
                className="cursor-pointer rounded-full border border-[#e5e2da] bg-white px-2.5 py-0.5 font-plex text-[9px] font-bold text-[#57534a] disabled:cursor-default disabled:opacity-40 [&:not(:disabled)]:hover:border-[#1a1918]"
              >
                NEXT ›
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2.5 mb-0 font-plex text-[8.5px] text-[#b5b0a1]">
          TIP: ADD <code className="text-[#8a8577]">?fields=name,overall</code> TO ANY CALL TO TRIM
          THE PAYLOAD.
        </p>
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
