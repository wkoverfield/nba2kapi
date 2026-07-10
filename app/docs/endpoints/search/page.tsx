"use client";

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
    code: `curl 'https://api.nba2kapi.com/api/players/search?\\
q=lebron' \\
  -H 'X-API-Key: YOUR_KEY'`,
  },
  {
    label: "JS",
    code: `const res = await fetch(
  'https://api.nba2kapi.com/api/players/search?q=lebron',
  { headers: { 'X-API-Key': KEY } }
);
const { data } = await res.json();`,
  },
  {
    label: "Python",
    code: `import requests

res = requests.get(
  'https://api.nba2kapi.com/api/players/search',
  params={'q': 'lebron'},
  headers={'X-API-Key': KEY})
data = res.json()['data']`,
  },
];

const RESPONSE = `{
  "success": true,
  "data": [
    {
      "_id": "abc123",
      "name": "LeBron James",
      "slug": "lebron-james",
      "team": "Los Angeles Lakers",
      "teamType": "curr",
      "overall": 97,
      "positions": ["SF", "PF"],
      "playerImage": "https://…",
      "teamImg": "https://…"
    }
  ],
  "meta": {
    "count": 1,
    "total": 1,
    "truncated": false,
    "timestamp": "2025-01-15T00:00:00.000Z"
  }
}`;

export default function SearchEndpointPage() {
  return (
    <DocColumns
      rail={
        <CodeRail samples={SAMPLES} response={RESPONSE} />
      }
    >
      <EndpointHeader path="/api/players/search" title="Search players">
        <p className="m-0">
          Find players by name with fuzzy matching — the endpoint behind autocomplete boxes,
          type-to-search UIs, and Discord bot commands.
        </p>
      </EndpointHeader>
      <AuthPill>REQUIRES X-API-KEY HEADER · 500 REQ/HR FREE</AuthPill>

      <DocLabel>QUERY PARAMETERS</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "q",
            type: "string · required",
            desc: (
              <>
                The search query. Partial names work — <code>lebron</code>, <code>leb</code>, and{" "}
                <code>james lebron</code> all find LeBron James.
              </>
            ),
          },
          {
            name: "teamType",
            type: "string",
            desc: (
              <>
                Narrow to one era: <code>curr</code>, <code>class</code>, or <code>allt</code>.
                E.g. <code>q=kobe&amp;teamType=class</code>.
              </>
            ),
          },
          {
            name: "limit",
            type: "number",
            desc: <>Maximum results to return. Max 50, default 50.</>,
          },
        ]}
      />

      <DocLabel>MATCHING BEHAVIOR</DocLabel>
      <DocP>
        Search is case-insensitive — <code>?q=LEBRON</code> and <code>?q=lebron</code> return the
        same results — and word order doesn&apos;t matter. <code>meta.truncated</code> tells you
        whether more matches exist beyond <code>limit</code>.
      </DocP>
      <FinePrint>RETURNS SUMMARY PLAYER OBJECTS · FETCH /API/PLAYERS/SLUG/:SLUG FOR FULL DETAIL.</FinePrint>
    </DocColumns>
  );
}
