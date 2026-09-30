import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * The player pool the site's interactive pages filter in the browser
 * (Playground, Compare, Lineups, command palette, home demo).
 *
 * Statically cached; the scrape pipeline revalidates these paths through
 * /api/revalidate after every run, so a pool is read from Convex once per
 * scrape instead of once per visitor. `all` is every era in table insertion
 * order, the same order the API's unfiltered scan uses, so ties sort alike.
 */
export const dynamic = "force-static";
export const revalidate = 86400;

const ERAS = ["curr", "class", "allt"] as const;
type Era = (typeof ERAS)[number];

export async function GET(_request: Request, context: { params: Promise<{ era: string }> }) {
  const { era } = await context.params;
  const eras: readonly Era[] | null =
    era === "all" ? ERAS : (ERAS as readonly string[]).includes(era) ? [era as Era] : null;
  if (!eras) {
    return NextResponse.json({ error: "Unknown era" }, { status: 404 });
  }
  const slices = await Promise.all(
    eras.map((teamType) => fetchQuery(api.players.getPoolSlice, { teamType }))
  );
  const players = slices.flat().sort((a, b) => a.order - b.order);
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), players },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
