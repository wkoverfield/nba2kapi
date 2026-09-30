"use client";

import { useEffect, useState } from "react";

export type PoolEra = "curr" | "class" | "allt" | "all";

/** One row of /api/pool: the slim projection players.getPoolSlice returns. */
export type PoolPlayer = {
  order: number; // table insertion order; the API's unfiltered scan order
  name: string;
  slug: string;
  team: string;
  teamType: "curr" | "class" | "allt";
  positions: string[];
  overall: number;
  height: string | null;
  playerImage: string | null;
  attributes: Record<string, number>;
  badges: { name: string; tier: string; slug: string }[];
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

const inflight = new Map<PoolEra, Promise<PoolPlayer[]>>();

/** Fetch a pool once per page load; concurrent callers share the request. */
export function loadPlayerPool(era: PoolEra): Promise<PoolPlayer[]> {
  let p = inflight.get(era);
  if (!p) {
    p = fetch(`/api/pool/${era}`)
      .then((res) => {
        if (!res.ok) throw new Error(`pool ${era}: ${res.status}`);
        return res.json() as Promise<{ players: PoolPlayer[] }>;
      })
      .then((body) => body.players)
      .catch((err) => {
        inflight.delete(era); // let the next caller retry
        throw err;
      });
    inflight.set(era, p);
  }
  return p;
}

/**
 * The pool for an era, or undefined while loading. Pass null to skip (the
 * same idiom as useQuery's "skip"), e.g. until a picker first opens.
 */
export function usePlayerPool(era: PoolEra | null): PoolPlayer[] | undefined {
  const [pool, setPool] = useState<PoolPlayer[] | undefined>(undefined);
  useEffect(() => {
    if (era === null) return;
    let cancelled = false;
    loadPlayerPool(era)
      .then((players) => {
        if (!cancelled) setPool(players);
      })
      .catch(() => {
        // Leave the page in its loading state; the next mount retries.
      });
    return () => {
      cancelled = true;
    };
  }, [era]);
  return era === null ? undefined : pool;
}
