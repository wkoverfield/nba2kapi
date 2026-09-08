"use client";

import Link from "next/link";
import {
  AuthPill,
  CodeRail,
  DocColumns,
  DocLabel,
  DocP,
  EndpointHeader,
  FinePrint,
  ParamsTable,
} from "@/components/docs/kit";

const SAMPLES = [
  {
    label: "cURL",
    code: `# Which editions exist (no key needed)
curl 'https://api.nba2kapi.com/api/versions'

# 2K26 Denver Nuggets, top five by overall
curl 'https://api.nba2kapi.com/api/versions/2K26/players?\\
team=Denver%20Nuggets&limit=5' \\
  -H 'X-API-Key: YOUR_KEY'`,
  },
  {
    label: "JS",
    code: `const res = await fetch(
  'https://api.nba2kapi.com/api/versions/2K26/players?' +
  'team=Denver%20Nuggets&limit=5',
  { headers: { 'X-API-Key': KEY } }
);
const { data, meta } = await res.json();
// meta.gameVersion === '2K26'`,
  },
  {
    label: "Python",
    code: `import requests

res = requests.get(
  'https://api.nba2kapi.com/api/versions/2K26/players',
  params={'team': 'Denver Nuggets', 'limit': 5},
  headers={'X-API-Key': KEY})
data = res.json()['data']`,
  },
];

const RESPONSE = `{
  "success": true,
  "data": [
    {
      "gameVersion": "2K26",
      "slug": "nikola-jokic",
      "name": "Nikola Jokic",
      "team": "Denver Nuggets",
      "teamType": "curr",
      "overall": 98,
      "positions": ["C"],
      "height": "6'11\\"",
      "attributes": { "closeShot": 99, "midRangeShot": 98, … },
      "badges": { "total": 24, "hallOfFame": 6, … }
    },
    {
      "gameVersion": "2K26",
      "slug": "jamal-murray",
      "name": "Jamal Murray",
      "overall": 89,
      …
    },
    …
  ],
  "meta": {
    "gameVersion": "2K26",
    "count": 5,
    "total": 14,
    "hasMore": true,
    "offset": 0,
    "limit": 5
  }
}`;

export default function VersionsEndpointPage() {
  return (
    <DocColumns rail={<CodeRail samples={SAMPLES} response={RESPONSE} />}>
      <EndpointHeader path="/api/versions" title="Roster versions">
        <p className="m-0">
          Rosters and ratings by game edition. Still on NBA 2K26? Read the archived 2K26 roster
          instead of the current one. The current edition answers at the same URL shape, so one
          client can point at any season by changing <code>:version</code>.
        </p>
      </EndpointHeader>
      <AuthPill>NO KEY REQUIRED · 60 REQ/MIN PER IP</AuthPill>

      <DocLabel>RESPONSE</DocLabel>
      <DocP>
        A list of editions, current first, then newest archived. Each entry carries the fields
        below.
      </DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: "gameVersion",
              type: "string",
              desc: (
                <>
                  The edition key used in every versioned path, e.g. <code>2K27</code>,{" "}
                  <code>2K26</code>.
                </>
              ),
            },
            {
              name: "label",
              type: "string",
              desc: (
                <>
                  Display name, e.g. <code>NBA 2K26</code>.
                </>
              ),
            },
            {
              name: "status",
              type: "string",
              desc: (
                <>
                  <code>current</code> for the edition the live database tracks, <code>archived</code>{" "}
                  for a frozen snapshot.
                </>
              ),
            },
            {
              name: "playerCount",
              type: "number",
              desc: <>Players in the edition across every era.</>,
            },
            {
              name: "teamTypeCounts",
              type: "object · archived only",
              desc: (
                <>
                  Player counts per era: <code>{"{ curr, class, allt }"}</code>.
                </>
              ),
            },
            {
              name: "capturedAt / source",
              type: "string · archived only",
              desc: (
                <>
                  When the snapshot was taken (ISO 8601) and where it came from.
                </>
              ),
            },
          ]}
        />
      </div>
      <FinePrint>RESPONSES ARE CACHED 1H AND SUPPORT ETAG / 304 REVALIDATION.</FinePrint>

      <DocLabel>THE :VERSION PATH SEGMENT</DocLabel>
      <DocP>
        Every route below takes an edition key in the path. <code>2K26</code> and <code>2k26</code>{" "}
        both work (the key is normalized to uppercase). Anything that is not shaped like{" "}
        <code>2K</code> plus two digits returns <code>400 INVALID_VERSION</code>; an edition that
        is not archived returns <code>404 VERSION_NOT_FOUND</code> with the available keys under{" "}
        <code>details.availableVersions</code>. The current edition is served from the live
        database, so <code>/api/versions/2K27/players</code> returns what{" "}
        <Link href="/docs/endpoints/players">/api/players</Link> returns today.
      </DocP>
      <AuthPill>KEYED ROUTES REQUIRE X-API-KEY HEADER · 500 REQ/HR FREE</AuthPill>

      <DocLabel>GET /API/VERSIONS/:VERSION/PLAYERS</DocLabel>
      <DocP>
        Players in one edition, filterable and paginated. Sorted by overall descending, then name.
      </DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: "era",
              type: "string",
              desc: (
                <>
                  <code>curr</code> (default), <code>class</code>, <code>allt</code>, or{" "}
                  <code>all</code> for every era in one call. <code>teamType</code> is a supported
                  alias.
                </>
              ),
            },
            {
              name: "team",
              type: "string",
              desc: (
                <>
                  Full team name, e.g. <code>Denver Nuggets</code> or{" "}
                  <code>1995-96 Chicago Bulls</code>.
                </>
              ),
            },
            {
              name: "position",
              type: "string",
              desc: (
                <>
                  Position or group: <code>PG</code>, <code>SG</code>, <code>SF</code>,{" "}
                  <code>PF</code>, <code>C</code>, or <code>guard</code>, <code>wing</code>,{" "}
                  <code>big</code>.
                </>
              ),
            },
            {
              name: "minRating / maxRating",
              type: "number",
              desc: <>Bound the overall rating, 0 to 99.</>,
            },
            {
              name: "search",
              type: "string",
              desc: <>Case-insensitive name substring.</>,
            },
            {
              name: "limit / offset",
              type: "number",
              desc: (
                <>
                  Page size (1 to 100, default 50) and the number of rows to skip (0 or more).
                  <code>meta</code> carries <code>gameVersion</code>, <code>count</code>,{" "}
                  <code>total</code>, <code>hasMore</code>, <code>offset</code>, and{" "}
                  <code>limit</code>.
                </>
              ),
            },
          ]}
        />
      </div>

      <DocLabel>GET /API/VERSIONS/:VERSION/PLAYERS/BULK</DocLabel>
      <DocP>
        The whole matching set for one edition in a single call, sorted by overall descending,
        capped at 10,000 rows. Costs one request against your rate limit.
      </DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: "teamType",
              type: "string",
              desc: (
                <>
                  <code>curr</code> (default), <code>class</code>, or <code>allt</code>.
                </>
              ),
            },
            {
              name: "team",
              type: "string",
              desc: <>Full team name.</>,
            },
            {
              name: "minRating / maxRating",
              type: "number",
              desc: <>Bound the overall rating, 0 to 99.</>,
            },
            {
              name: "position",
              type: "string",
              desc: (
                <>
                  Position or group, same values as <code>/players</code> above.
                </>
              ),
            },
          ]}
        />
      </div>
      <FinePrint>
        META: GAMEVERSION · COUNT · TOTAL · FILTERS · CAPTUREDAT · SOURCE. CACHED 1H WITH ETAG.
      </FinePrint>

      <DocLabel>GET /API/VERSIONS/:VERSION/PLAYERS/:SLUG</DocLabel>
      <DocP>
        One player in one edition. Unknown slugs return <code>404 PLAYER_NOT_FOUND</code> with a
        hint.
      </DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: ":slug",
              type: "path · string",
              desc: (
                <>
                  The player slug, e.g. <code>nikola-jokic</code>.
                </>
              ),
            },
            {
              name: "teamType",
              type: "string · optional",
              desc: (
                <>
                  <code>curr</code>, <code>class</code>, or <code>allt</code>. Omit it and, when the
                  slug exists in more than one era, <code>data</code> is an array of every variant
                  with the count under <code>meta.variants</code>.
                </>
              ),
            },
          ]}
        />
      </div>

      <DocLabel>GET /API/VERSIONS/:VERSION/TEAMS</DocLabel>
      <DocP>
        Teams in one edition with player count, average rating, logo, and top overall. Same shape
        as <Link href="/docs/endpoints/teams">/api/teams</Link>.
      </DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: "era",
              type: "string",
              desc: (
                <>
                  <code>curr</code> (default), <code>class</code>, or <code>allt</code>.{" "}
                  <code>teamType</code> is a supported alias.
                </>
              ),
            },
          ]}
        />
      </div>

      <DocLabel>PROVENANCE</DocLabel>
      <DocP>
        Every row returned from a versioned route carries <code>gameVersion</code>. 2K26 is the
        final pre-2K27-reveal snapshot, captured 2026-08-08: 1,889 players across current, classic,
        and all-time rosters, with overall, positions, physicals, every attribute, and badge counts
        with the top three badges. Archived editions do not change. The current edition is also
        reachable at <code>/api/versions/2K27/...</code>, so one URL shape covers every season.
      </DocP>
      <FinePrint>ARCHIVED EDITIONS ARE READ-ONLY SNAPSHOTS · THE CURRENT EDITION FOLLOWS THE LIVE SCRAPE.</FinePrint>
    </DocColumns>
  );
}
