"use client";

import Link from "next/link";
import { Headshot } from "@/components/ui/headshot";
import { getRatingClasses, getAttributeColor } from "@/lib/rating-colors";
import { getTeamAbbreviation } from "@/lib/team-abbr";
import {
  ATTRIBUTE_SHORT_LABELS,
  CATEGORY_SHORT_LABELS,
  ORDERED_ATTRIBUTES,
} from "@/lib/attribute-labels";
import { getAttributeDisplayName } from "@/lib/attribute-normalizer";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";

export type TablePlayer = {
  name: string;
  slug: string;
  team: string;
  teamType: TeamType;
  positions?: string[];
  height?: string | null;
  overall: number;
  playerImage?: string | null;
  attributes?: Record<string, number>;
};

function shortTeam(p: TablePlayer): string {
  const abbr = getTeamAbbreviation(p.team);
  if (p.teamType === "class") {
    const match = p.team.match(/^\d{4}-(\d{2})\s/);
    return match ? `${abbr} '${match[1]}` : abbr;
  }
  if (p.teamType === "allt") return `${abbr} A-T`;
  return abbr;
}

function eraTag(teamType: TeamType) {
  if (teamType === "class") return { label: "CLASSIC", color: "#9a6700" };
  if (teamType === "allt") return { label: "ALL-TIME", color: "#9a6700" };
  return { label: "CURRENT", color: "#8a8577" };
}

/**
 * Full-attribute player table: sticky player column, every attribute as a
 * color-coded column, horizontal scroll. Shared by the playground results
 * and team rosters (taste ruling: show ALL the information).
 */
export function PlayerTable({
  players,
  rankOffset = 0,
  queriedKey,
  sortKey,
  sortDir,
  onSort,
  playerHref,
  emptyText = "NO PLAYERS MATCH",
  loading = false,
}: {
  players: TablePlayer[];
  rankOffset?: number;
  /** Attribute column to tint as "the queried column". */
  queriedKey?: string | null;
  /** Current sort: "overall" or an attribute key. */
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  playerHref: (p: TablePlayer) => string;
  emptyText?: string;
  loading?: boolean;
}) {
  const arrow = (key: string) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const headBtn = (key: string, label: string, extra?: string) => (
    <button
      type="button"
      onClick={onSort ? () => onSort(key) : undefined}
      title={key === "overall" ? "Overall" : getAttributeDisplayName(key)}
      className={cn(
        "w-full cursor-pointer text-center font-plex text-[8px] tracking-[0.04em] whitespace-nowrap transition-colors duration-150 select-none",
        sortKey === key ? "font-bold text-[#1a1918]" : "text-[#b5b0a1] hover:text-[#1a1918]",
        extra
      )}
    >
      {label}
      {arrow(key)}
    </button>
  );

  // Category group boundaries for the top header band
  const groups: { category: string; span: number }[] = [];
  for (const { category } of ORDERED_ATTRIBUTES) {
    const last = groups[groups.length - 1];
    if (last && last.category === category) last.span++;
    else groups.push({ category, span: 1 });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse" style={{ minWidth: 720 + ORDERED_ATTRIBUTES.length * 44 }}>
        <thead>
          <tr>
            <th className="sticky left-0 z-[3] border-b border-[#e5e2da] bg-[#faf9f5]" colSpan={2} />
            <th className="border-b border-[#e5e2da] bg-[#faf9f5]" colSpan={2} />
            {groups.map((g) => (
              <th
                key={g.category}
                colSpan={g.span}
                className="border-b border-l border-[#e5e2da] bg-[#faf9f5] px-1 py-1 text-center font-plex text-[7px] font-normal tracking-[0.1em] text-[#b5b0a1]"
              >
                {CATEGORY_SHORT_LABELS[g.category]}
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 z-[3] w-[220px] min-w-[220px] border-b border-[#e5e2da] bg-[#faf9f5] px-4 py-2 text-left font-plex text-[8.5px] font-normal tracking-[0.08em] text-[#b5b0a1] shadow-[4px_0_8px_-4px_rgba(26,25,24,0.08)]">
              PLAYER
            </th>
            <th className="w-[52px] border-b border-[#e5e2da] bg-[#faf9f5] px-1 py-2 font-plex text-[8.5px] font-normal tracking-[0.08em] text-[#b5b0a1]">
              POS
            </th>
            <th className="w-[44px] border-b border-[#e5e2da] bg-[#faf9f5] px-1 py-2 font-plex text-[8.5px] font-normal tracking-[0.08em] text-[#b5b0a1]">
              HT
            </th>
            <th className="w-[52px] border-b border-[#e5e2da] bg-[#faf9f5] px-1 py-2">
              {headBtn("overall", "OVR")}
            </th>
            {ORDERED_ATTRIBUTES.map(({ key }) => (
              <th
                key={key}
                className={cn(
                  "w-[44px] border-b border-[#e5e2da] bg-[#faf9f5] px-0.5 py-2",
                  queriedKey === key && "bg-[#f6f2e6]"
                )}
              >
                {headBtn(key, ATTRIBUTE_SHORT_LABELS[key] ?? key.slice(0, 3).toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 10 }, (_, i) => (
                <tr key={i} className="animate-pulse border-b border-[#faf8f2]">
                  <td className="sticky left-0 z-[2] bg-white px-4 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-[#f1efe8]" />
                      <div className="h-3.5 w-32 rounded bg-[#f1efe8]" />
                    </div>
                  </td>
                  <td colSpan={3 + ORDERED_ATTRIBUTES.length}>
                    <div className="mx-4 h-3 rounded bg-[#f1efe8]" />
                  </td>
                </tr>
              ))
            : players.map((p, i) => {
                const era = eraTag(p.teamType);
                return (
                  <tr key={`${p.slug}-${p.teamType}-${p.team}`} className="group border-b border-[#faf8f2]">
                    <td className="sticky left-0 z-[2] bg-white px-4 py-1.5 shadow-[4px_0_8px_-4px_rgba(26,25,24,0.08)] group-hover:bg-[#faf8f2]">
                      <Link
                        href={playerHref(p)}
                        className="flex min-w-0 items-center gap-2.5 text-[#1a1918] no-underline"
                      >
                        <span className="w-6 shrink-0 font-plex text-[9px] text-[#b5b0a1]">
                          {rankOffset + i + 1}
                        </span>
                        <Headshot src={p.playerImage} name={p.name} size={28} />
                        <span className="min-w-0">
                          <span className="block overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap">
                            {p.name}
                          </span>
                          <span
                            className="block font-plex text-[7.5px] tracking-[0.06em]"
                            style={{ color: era.color }}
                          >
                            {shortTeam(p)} · {era.label}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-1 py-1.5 text-center font-plex text-[9px] whitespace-nowrap text-[#57534a] group-hover:bg-[#faf8f2]">
                      {(p.positions ?? []).join("/")}
                    </td>
                    <td className="px-1 py-1.5 text-center font-plex text-[9px] whitespace-nowrap text-[#57534a] group-hover:bg-[#faf8f2]">
                      {p.height ?? "—"}
                    </td>
                    <td className="px-1 py-1.5 text-center group-hover:bg-[#faf8f2]">
                      <span
                        className={cn(
                          "inline-flex w-[34px] items-center justify-center rounded-[6px] py-[3px] text-[11.5px] font-bold text-white tabular-nums",
                          getRatingClasses(p.overall).bg
                        )}
                      >
                        {p.overall}
                      </span>
                    </td>
                    {ORDERED_ATTRIBUTES.map(({ key }) => {
                      const v = p.attributes?.[key];
                      return (
                        <td
                          key={key}
                          className={cn(
                            "px-0.5 py-1.5 text-center text-[11.5px] font-bold tabular-nums group-hover:bg-[#faf8f2]",
                            queriedKey === key && "bg-[#faf7ee]"
                          )}
                          style={{ color: typeof v === "number" ? getAttributeColor(v) : "#d9d4c7" }}
                        >
                          {typeof v === "number" ? v : "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          {!loading && players.length === 0 && (
            <tr>
              <td
                colSpan={4 + ORDERED_ATTRIBUTES.length}
                className="px-4 py-10 text-center font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]"
              >
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
