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
    code: `curl 'https://api.nba2kapi.com/api/teams?era=curr' \\
  -H 'X-API-Key: YOUR_KEY'

# Roster: slug or full team name both work
curl 'https://api.nba2kapi.com/api/teams/\\
los-angeles-lakers/roster' \\
  -H 'X-API-Key: YOUR_KEY'`,
  },
  {
    label: "JS",
    code: `const teams = await fetch(
  'https://api.nba2kapi.com/api/teams?era=curr',
  { headers: { 'X-API-Key': KEY } }
).then(r => r.json());

// Roster: slug or full team name both work
const roster = await fetch(
  'https://api.nba2kapi.com/api/teams/' +
  'los-angeles-lakers/roster',
  { headers: { 'X-API-Key': KEY } }
).then(r => r.json());`,
  },
  {
    label: "Python",
    code: `import requests

teams = requests.get(
  'https://api.nba2kapi.com/api/teams',
  params={'era': 'curr'},
  headers={'X-API-Key': KEY}).json()

# Roster: slug or full team name both work
roster = requests.get(
  'https://api.nba2kapi.com/api/teams/'
  'los-angeles-lakers/roster',
  headers={'X-API-Key': KEY}).json()`,
  },
];

const RESPONSE = `{
  "success": true,
  "data": [
    {
      "teamName": "Los Angeles Lakers",
      "teamType": "curr",
      "playerCount": 17,
      "averageRating": 82.4
    },
    {
      "teamName": "Boston Celtics",
      "teamType": "curr",
      "playerCount": 16,
      "averageRating": 81.8
    },
    …
  ]
}`;

export default function TeamsEndpointPage() {
  return (
    <DocColumns rail={<CodeRail samples={SAMPLES} response={RESPONSE} />}>
      <EndpointHeader path="/api/teams" title="List teams">
        <p className="m-0">
          Every NBA 2K team with player count and average rating — current, classic, and all-time
          rosters.
        </p>
      </EndpointHeader>
      <AuthPill>REQUIRES X-API-KEY HEADER · 500 REQ/HR FREE</AuthPill>

      <DocLabel>QUERY PARAMETERS</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "era",
            type: "string",
            desc: (
              <>
                <code>curr</code> (default), <code>class</code>, <code>allt</code> — current NBA
                teams, classic teams, or all-time teams. <code>teamType</code> is a supported
                alias.
              </>
            ),
          },
        ]}
      />

      <DocLabel>GET /API/TEAMS/:TEAMNAME/ROSTER</DocLabel>
      <DocP>
        One team&apos;s full roster. <code>:teamName</code> accepts the full team name or its slug —{" "}
        <code>Los Angeles Lakers</code> and <code>los-angeles-lakers</code> both resolve to the
        same team.
      </DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: ":teamName",
              type: "path · string",
              desc: (
                <>
                  Full name or slug, e.g. <code>Los Angeles Lakers</code> or{" "}
                  <code>los-angeles-lakers</code>.
                </>
              ),
            },
            {
              name: "teamType",
              type: "string · optional",
              desc: (
                <>
                  <code>curr</code>, <code>class</code>, or <code>allt</code> to disambiguate
                  franchises that exist in multiple eras.
                </>
              ),
            },
          ]}
        />
      </div>
      <FinePrint>ERAS: CURR = 2024-25 SEASON · CLASS = HISTORIC ROSTERS · ALLT = FRANCHISE GREATS.</FinePrint>
    </DocColumns>
  );
}
