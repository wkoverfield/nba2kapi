/**
 * Player filtering, sorting, and pagination shared by the public API
 * (players.getAllFiltered, server side) and the site's Playground (browser
 * side, over the pool from /api/pool). One implementation so both surfaces
 * answer the same query the same way.
 *
 * Pure: no Convex imports, never mutates its input.
 */
import { slugify } from "./slug";

export type TeamType = "curr" | "class" | "allt";
export type SortBy = "overall-desc" | "overall-asc" | "name-asc" | "name-desc";

export type PlayerFilterArgs = {
  search?: string;
  teamType?: TeamType;
  teams?: string[];
  positions?: string[];
  minOverall?: number;
  maxOverall?: number;
  sortBy?: SortBy;
  attributeFilters?: { key: string; gte?: number; lte?: number }[];
  sortByAttribute?: { key: string; dir: "asc" | "desc" };
  badgeSlug?: string;
  badgeTier?: string;
  limit?: number;
  offset?: number;
};

type BadgeEntry = { name: string; tier?: string | null; slug?: string };

/** The fields a player needs for filtering; full documents and pool rows both qualify. */
export type FilterablePlayer = {
  name: string;
  team: string;
  teamType: TeamType;
  overall: number;
  positions?: string[] | null;
  attributes?: Record<string, number> | null;
  badges?: BadgeEntry[] | { list?: BadgeEntry[] | null } | null;
};

export type FilterResult<T> = { players: T[]; totalCount: number; hasMore: boolean };

function badgeEntries(p: FilterablePlayer): BadgeEntry[] {
  const b = p.badges;
  if (!b) return [];
  if (Array.isArray(b)) return b;
  return b.list ?? [];
}

export function filterPlayers<T extends FilterablePlayer>(
  input: readonly T[],
  args: PlayerFilterArgs
): FilterResult<T> {
  let players: T[] = [...input];

  if (args.teamType !== undefined) {
    players = players.filter((p) => p.teamType === args.teamType);
  }
  if (args.teams && args.teams.length > 0) {
    players = players.filter((p) => args.teams!.includes(p.team));
  }
  if (args.search) {
    const searchLower = args.search.toLowerCase();
    players = players.filter((p) => p.name.toLowerCase().includes(searchLower));
  }
  if (args.positions && args.positions.length > 0) {
    players = players.filter((p) => p.positions?.some((pos) => args.positions!.includes(pos)));
  }
  if (args.minOverall !== undefined) {
    players = players.filter((p) => p.overall >= args.minOverall!);
  }
  if (args.maxOverall !== undefined) {
    players = players.filter((p) => p.overall <= args.maxOverall!);
  }
  if (args.attributeFilters && args.attributeFilters.length > 0) {
    players = players.filter((p) =>
      args.attributeFilters!.every((f) => {
        const value = p.attributes?.[f.key];
        if (value === undefined) return false;
        if (f.gte !== undefined && value < f.gte) return false;
        if (f.lte !== undefined && value > f.lte) return false;
        return true;
      })
    );
  }
  // Badge tier is optional: `?badge=deadeye` means any tier.
  if (args.badgeSlug) {
    players = players.filter((p) =>
      badgeEntries(p).some(
        (b) =>
          (b.slug ?? slugify(b.name)) === args.badgeSlug &&
          (!args.badgeTier || b.tier === args.badgeTier)
      )
    );
  }

  if (args.sortByAttribute) {
    const { key, dir } = args.sortByAttribute;
    const sign = dir === "asc" ? 1 : -1;
    players.sort((a, b) => {
      const av = a.attributes?.[key];
      const bv = b.attributes?.[key];
      if (av === undefined && bv === undefined) return b.overall - a.overall;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      const d = sign * (av - bv);
      return d !== 0 ? d : b.overall - a.overall;
    });
  } else {
    const sortBy = args.sortBy || "overall-desc";
    if (sortBy === "overall-desc") {
      players.sort((a, b) => b.overall - a.overall);
    } else if (sortBy === "overall-asc") {
      players.sort((a, b) => a.overall - b.overall);
    } else if (sortBy === "name-asc") {
      players.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      players.sort((a, b) => b.name.localeCompare(a.name));
    }
  }

  const totalCount = players.length;
  const offset = args.offset || 0;
  const limit = args.limit || 50;
  return {
    players: players.slice(offset, offset + limit),
    totalCount,
    hasMore: offset + limit < totalCount,
  };
}
