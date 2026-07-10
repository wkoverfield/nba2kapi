"use client";

import Link from "next/link";
import { CodeRail, DocColumns, DocH1, DocLabel, DocP, FinePrint } from "@/components/docs/kit";

const SAMPLES = [
  {
    label: "cURL",
    code: `curl 'https://api.nba2kapi.com/api/players/slug/lebron-james' \\
  -H 'X-API-Key: your_api_key_here'

# Players on multiple teams (like Michael Jordan):
# add ?teamType=class&team='95-'96 Bulls`,
  },
  {
    label: "JS",
    code: `const res = await fetch(
  'https://api.nba2kapi.com/api/players/slug/lebron-james',
  { headers: { 'X-API-Key': 'your_api_key_here' } }
);
const { success, data } = await res.json();

if (success) {
  console.log(data.name);      // "LeBron James"
  console.log(data.overall);   // 97
  console.log(data.positions); // ["SF", "PF"]
  console.log(data.team);      // "Los Angeles Lakers"
}`,
  },
  {
    label: "Python",
    code: `import requests

res = requests.get(
  'https://api.nba2kapi.com/api/players/slug/lebron-james',
  headers={'X-API-Key': 'your_api_key_here'})
data = res.json()

if data['success']:
    print(data['data']['name'])     # "LeBron James"
    print(data['data']['overall'])  # 97`,
  },
];

const RESPONSE = `{
  "success": true,
  "data": {
    "_id": "abc123",
    "name": "LeBron James",
    "slug": "lebron-james",
    "team": "Los Angeles Lakers",
    "teamType": "curr",
    "overall": 97,
    "positions": ["SF", "PF"],
    "height": "6'9\\"",
    "weight": "250 lbs",
    "playerImage": "https://…",
    "teamImg": "https://…",
    "closeShot": 92,
    "midRangeShot": 88,
    "threePointShot": 44,
    … 40+ more attributes,
    "lastUpdated": "2025-01-15T00:00:00.000Z"
  }
}`;

export default function QuickstartPage() {
  return (
    <DocColumns rail={<CodeRail samples={SAMPLES} response={RESPONSE} playgroundHref="/playground" />}>
      <DocH1>Quickstart</DocH1>
      <DocP>From zero to first response in under 5 minutes.</DocP>

      <DocLabel>STEP 1 · GET YOUR API KEY</DocLabel>
      <DocP>
        Every request authenticates with an API key. Grab yours from the{" "}
        <Link href="/dashboard">dashboard</Link> — no password, the key is the login.
      </DocP>

      <DocLabel>STEP 2 · MAKE YOUR FIRST REQUEST</DocLabel>
      <DocP>
        Pass the key in the <code>X-API-Key</code> header. The samples on the right fetch one
        player by slug. For players who exist on multiple teams (like Michael Jordan), add{" "}
        <code>?teamType=class&amp;team=&apos;95-&apos;96 Bulls</code> to pick the version you want.
      </DocP>

      <DocLabel>STEP 3 · READ THE RESPONSE</DocLabel>
      <DocP>
        Every response follows the same envelope: <code>success</code> plus <code>data</code>. A
        player object carries name, slug, team, overall, positions, and 40+ individual attributes.
        The full response is shown on the right.
      </DocP>

      <DocLabel>WHERE TO NEXT</DocLabel>
      <DocP>
        <Link href="/docs/endpoints/players">GET /api/players</Link> lists everyone with filtering,{" "}
        <Link href="/docs/endpoints/teams">GET /api/teams</Link> serves rosters, and{" "}
        <Link href="/docs/endpoints/search">GET /api/players/search</Link> finds players by name.
        Read up on <Link href="/docs/authentication">authentication</Link> and{" "}
        <Link href="/docs/rate-limits">rate limits</Link>, or skip the code entirely and explore in
        the <Link href="/playground">playground</Link>.
      </DocP>
      <FinePrint>ALL SAMPLES USE THE LIVE API AT API.NBA2KAPI.COM.</FinePrint>
    </DocColumns>
  );
}
