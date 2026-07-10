/**
 * Depth-chart assignment shared by the team page and dossier roster cycling.
 * Starters stay positional (PG→C); everyone else is "the bench", flat by OVR
 * (taste ruling 2026-07-10: the league is less position-bound than 2K's five
 * slots, so only starters get sectioned).
 */

export const DEPTH_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

type DepthPlayer = { overall: number; positions?: string[] };

/** Primary-position columns with bench-steal for empty spots. */
export function buildDepthColumns<T extends DepthPlayer>(roster: T[]): Record<string, T[]> {
  const sorted = [...roster].sort((a, b) => b.overall - a.overall);
  const columns: Record<string, T[]> = { PG: [], SG: [], SF: [], PF: [], C: [] };
  for (const p of sorted) {
    const primary = p.positions?.find((pos) => pos in columns);
    columns[primary ?? "SF"].push(p);
  }
  for (const pos of DEPTH_POSITIONS) {
    if (columns[pos].length > 0) continue;
    let candidate: { from: string; index: number } | null = null;
    for (const from of DEPTH_POSITIONS) {
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

/** Five starters (PG→C order; missing spots omitted). */
export function depthStarters<T extends DepthPlayer>(columns: Record<string, T[]>): T[] {
  return DEPTH_POSITIONS.map((pos) => columns[pos][0]).filter((p): p is T => p !== undefined);
}

/** Flat bench, highest OVR first. */
export function depthBench<T extends DepthPlayer>(columns: Record<string, T[]>): T[] {
  return DEPTH_POSITIONS.flatMap((pos) => columns[pos].slice(1)).sort(
    (a, b) => b.overall - a.overall
  );
}

/** Depth-chart traversal order: starters PG→C, then the bench by OVR. */
export function depthOrder<T extends DepthPlayer>(roster: T[]): T[] {
  const columns = buildDepthColumns(roster);
  return [...depthStarters(columns), ...depthBench(columns)];
}
