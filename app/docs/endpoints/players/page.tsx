"use client";

import Link from "next/link";
import {
  AuthPill,
  CodeRail,
  DocColumns,
  DocLabel,
  EndpointHeader,
  FinePrint,
  ParamsTable,
} from "@/components/docs/kit";

const SAMPLES = [
  {
    label: "cURL",
    code: `curl 'https://api.nba2kapi.com/api/players?\\
  position=guard&era=all&\\
  three_ball_gte=85&sort=overall:desc' \\
  -H 'X-API-Key: YOUR_KEY'`,
  },
  {
    label: "JS",
    code: `const res = await fetch(
  'https://api.nba2kapi.com/api/players?' +
  'position=guard&era=all&three_ball_gte=85',
  { headers: { 'X-API-Key': KEY } }
);
const { data } = await res.json();`,
  },
  {
    label: "Python",
    code: `import requests

res = requests.get(
  'https://api.nba2kapi.com/api/players',
  params={'position': 'guard', 'era': 'all',
          'three_ball_gte': 85},
  headers={'X-API-Key': KEY})
data = res.json()['data']`,
  },
];

const RESPONSE = `{
  "success": true,
  "data": [
    {
      "name": "Shai Gilgeous-Alexander",
      "slug": "shai-gilgeous-alexander",
      "team": "Oklahoma City Thunder",
      "teamType": "curr",
      "overall": 98,
      "positions": ["PG", "SG"],
      "attributes": { "threePointShot": 85, … },
      "badges": { "total": 26, … }
    },
    …
  ],
  "meta": { "pagination": { "total": 231, "nextCursor": "50" } }
}`;

export default function PlayersEndpointPage() {
  return (
    <DocColumns
      rail={
        <CodeRail
          samples={SAMPLES}
          response={RESPONSE}
          playgroundHref="/playground?position=guard&era=all&three_ball_gte=85&sort=overall%3Adesc"
        />
      }
    >
      <EndpointHeader path="/api/players" title="List players">
        <p className="m-0">
          Every player in the database — 1,700+ across current, classic, and all-time rosters —
          filterable on any attribute, sortable on any column. This is the endpoint the{" "}
          <Link href="/playground">playground</Link> writes for you.
        </p>
      </EndpointHeader>
      <AuthPill>REQUIRES X-API-KEY HEADER · 500 REQ/HR FREE</AuthPill>

      <DocLabel>QUERY PARAMETERS</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "era",
            type: "string",
            isNew: true,
            desc: (
              <>
                <code>curr</code> (default), <code>class</code>, <code>allt</code> — or{" "}
                <code>all</code> to search every era in one call. <code>teamType</code> remains a
                supported alias.
              </>
            ),
          },
          {
            name: "position",
            type: "string",
            desc: (
              <>
                Position or group: <code>PG</code>, <code>SG</code>, <code>SF</code>,{" "}
                <code>PF</code>, <code>C</code> — or <code>guard</code>, <code>wing</code>,{" "}
                <code>big</code>.
              </>
            ),
          },
          {
            name: "team",
            type: "string",
            desc: (
              <>
                Filter to one team by full name, e.g. <code>Los Angeles Lakers</code> or{" "}
                <code>1995-96 Chicago Bulls</code>.
              </>
            ),
          },
          {
            name: "minRating / maxRating",
            type: "number",
            desc: <>Bound the overall rating, 0–99.</>,
          },
          {
            name: "{attribute}_gte / _lte",
            type: "number",
            isNew: true,
            desc: (
              <>
                Bound any of the 40+ attributes in snake_case: <code>three_ball_gte=85</code>,{" "}
                <code>speed_lte=70</code>, <code>shot_iq_gte=90</code>, …
              </>
            ),
          },
          {
            name: "badge / badgeTier",
            type: "string",
            isNew: true,
            desc: (
              <>
                Filter by badge slug and optionally its exact tier: <code>badge=deadeye</code>,{" "}
                <code>badgeTier=Hall%20of%20Fame</code>. Browse valid slugs in the{" "}
                <Link href="/badges">badge almanac</Link>.
              </>
            ),
          },
          {
            name: "sort",
            type: "string",
            isNew: true,
            desc: (
              <>
                Any attribute plus direction: <code>sort=overall:desc</code> (default),{" "}
                <code>sort=three_ball:asc</code>, <code>sort=name:asc</code>.
              </>
            ),
          },
          {
            name: "fields",
            type: "string",
            isNew: true,
            desc: (
              <>
                Trim the payload to just the fields you need:{" "}
                <code>fields=name,overall,slug</code>.
              </>
            ),
          },
          {
            name: "limit / cursor",
            type: "number / string",
            desc: (
              <>
                Page size (max 100, default 50) and the offset cursor from{" "}
                <code>meta.pagination.nextCursor</code>.
              </>
            ),
          },
        ]}
      />
      <FinePrint>RESPONSES ARE CACHED 1H AND SUPPORT ETAG / 304 REVALIDATION.</FinePrint>

      <DocLabel>RELATED ENDPOINTS</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "/api/players/bulk",
            type: "GET",
            desc: <>The whole matching dataset in one call — one request against your rate limit.</>,
          },
          {
            name: "/api/players/slug/:slug",
            type: "GET",
            desc: (
              <>
                One player, full detail: all attributes, badges, hot zones. Add{" "}
                <code>?teamType=</code> for classic or all-time versions.
              </>
            ),
          },
          {
            name: "/api/players/:id/history",
            type: "GET",
            desc: <>Weekly rating snapshots — the dossier&apos;s history chart uses this.</>,
          },
        ]}
      />
    </DocColumns>
  );
}
