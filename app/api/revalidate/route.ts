import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/**
 * On-demand cache invalidation for statically cached SEO pages.
 *
 * POST { secret, players?: string[], teams?: string[], deleted?: string[] }
 * - secret: must match the REVALIDATE_SECRET env var (401 otherwise)
 * - players: player slugs whose /players/[slug] pages changed
 * - teams: team slugs whose /teams/[slug] pages changed
 * - deleted: player slugs removed from the dataset; their pages are
 *   revalidated too so the cached copy re-renders into a 404
 *
 * The scrape pipeline posts the diff of an ingest run here so only touched
 * pages re-render; everything else stays served from the full route cache
 * until the 30-day backstop.
 */

function slugList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && /^[a-z0-9-]+$/.test(item)
  );
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const provided = typeof body.secret === "string" ? body.secret : "";
  const expected = Buffer.from(secret ?? "");
  const received = Buffer.from(provided);
  const authorized =
    !!secret && expected.length === received.length && timingSafeEqual(expected, received);
  if (!authorized) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const players = slugList(body.players);
  const teams = slugList(body.teams);
  const deleted = slugList(body.deleted);

  const playerSlugs = [...new Set([...players, ...deleted])];
  for (const slug of playerSlugs) {
    revalidatePath(`/players/${slug}`);
  }
  const teamSlugs = [...new Set(teams)];
  for (const slug of teamSlugs) {
    revalidatePath(`/teams/${slug}`);
  }
  revalidatePath("/sitemap.xml");

  return NextResponse.json({
    revalidated: {
      players: players.length,
      teams: teamSlugs.length,
      deleted: deleted.length,
      paths: playerSlugs.length + teamSlugs.length + 1,
    },
  });
}
