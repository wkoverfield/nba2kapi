/**
 * The API documentation as plain markdown, served at /llms.txt and
 * /llms-full.txt and copyable from the docs UI. People paste docs into LLMs;
 * this is the canonical paste. Keep it factually in sync with convex/http.ts.
 */

export const LLMS_INDEX = `# nba2kapi

> Free REST API for NBA 2K player ratings: 1,700+ players across current,
> classic, and all-time rosters, 40+ attributes each, badges, teams, and
> weekly rating history. Data scraped weekly from 2kratings.com.
> Not affiliated with 2K Sports or the NBA.

Base URL: https://api.nba2kapi.com
Auth: X-API-Key header (free key at https://nba2kapi.com/dashboard, 500 requests/hour)

## Docs

- [Full API reference (single file for LLMs)](https://nba2kapi.com/llms-full.txt)
- [Human docs](https://nba2kapi.com/docs)
- [Interactive playground that writes API calls for you](https://nba2kapi.com/playground)

## Key endpoints

- GET /api/players — list/filter/sort every player (era=all merges eras; any attribute filterable via {attribute}_gte / _lte; sort=<field>:<dir>; fields= trims the payload)
- GET /api/players/bulk — the whole matching dataset in one call
- GET /api/players/slug/{slug} — one player, full detail
- GET /api/players/search?q= — name search
- POST /api/players/batch — resolve up to 100 names and/or slugs in one call
- GET /api/players/{id}/history — weekly rating snapshots
- GET /api/teams — teams with roster averages
- GET /api/teams/{team}/roster — full roster (accepts names or slugs)
- GET /api/badges — badge reference
`;

export const LLMS_FULL = `# nba2kapi — complete API reference

Free REST API for NBA 2K player ratings. Data is scraped weekly from
2kratings.com. Not affiliated with 2K Sports or the NBA.

- Base URL: \`https://api.nba2kapi.com\`
- Authentication: \`X-API-Key\` header on every request (except \`/api/public/*\`)
- Get a key: https://nba2kapi.com/dashboard — free, no password; the key is the login. 3 keys max per email.
- Rate limit: 500 requests per hour per key (single hourly window). Responses include \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, and \`X-RateLimit-Reset\` (ISO-8601 timestamp).
- Caching: player/team responses are cached for 1 hour and support ETag / 304 revalidation.
- Response envelope: \`{ "success": true, "data": ..., "meta": { ... } }\` on success; \`{ "success": false, "error": { "message", "code", "details?", "timestamp" } }\` on failure.

## Eras

Every player row belongs to one era (\`teamType\`):
- \`curr\` — current NBA rosters (default)
- \`class\` — classic teams, e.g. "1995-96 Chicago Bulls"
- \`allt\` — all-time franchise teams, e.g. "All-Time Chicago Bulls"

The same player can exist in several eras (and several classic team versions)
under one slug. Disambiguate with \`teamType\`/\`era\` and \`team\`.

## Attributes

40+ per player, stored under \`attributes\` with camelCase keys
(\`threePointShot\`, \`speed\`, \`drivingDunk\`, \`perimeterDefense\`,
\`shotIQ\`, ...). In query parameters, use snake_case
(\`three_point_shot\`, \`shot_iq\`, ...). Friendly aliases: \`three_ball\`
(threePointShot), \`dunk\` (drivingDunk), \`defense\` (perimeterDefense).

---

## GET /api/players

Every player, filterable and sortable on anything.

Query parameters:
- \`era\` — \`curr\` (default) | \`class\` | \`allt\` | \`all\` (merges every era in one call). \`teamType\` is a supported alias (no \`all\` value).
- \`position\` — exact (\`PG\`, \`SG\`, \`SF\`, \`PF\`, \`C\`) or group (\`guard\` = PG/SG, \`wing\` = SG/SF, \`big\` = PF/C).
- \`team\` — full team name, e.g. \`Los Angeles Lakers\` or \`1995-96 Chicago Bulls\`.
- \`search\` — case-insensitive name substring.
- \`minRating\` / \`maxRating\` — bound overall, 0–99.
- \`{attribute}_gte\` / \`{attribute}_lte\` — bound any attribute (snake_case), e.g. \`three_ball_gte=85\`, \`speed_lte=70\`, \`shot_iq_gte=90\`. Values 0–99.
- \`sort\` — \`<field>:<asc|desc>\` where field is \`overall\` (default \`overall:desc\`), \`name\`, or any attribute, e.g. \`sort=three_ball:asc\`.
- \`fields\` — comma list to trim the payload: \`fields=name,overall,slug\`. Allowed: name, slug, team, teamType, overall, positions, height, weight, wingspan, archetype, college, playerImage, teamImg, attributes, badges, lastUpdated.
- \`limit\` (1–100, default 50) and \`cursor\` (offset from \`meta.pagination.nextCursor\`).

Example:

\`\`\`bash
curl 'https://api.nba2kapi.com/api/players?position=guard&era=all&three_ball_gte=85&sort=overall:desc' \\
  -H 'X-API-Key: YOUR_KEY'
\`\`\`

Response (truncated):

\`\`\`json
{
  "success": true,
  "data": [
    {
      "name": "Shai Gilgeous-Alexander",
      "slug": "shai-gilgeous-alexander",
      "team": "Oklahoma City Thunder",
      "teamType": "curr",
      "overall": 98,
      "positions": ["PG", "SG"],
      "attributes": { "threePointShot": 85 },
      "badges": { "total": 26 }
    }
  ],
  "meta": { "pagination": { "hasMore": true, "nextCursor": "50", "count": 50, "limit": 50, "total": 231 } }
}
\`\`\`

## GET /api/players/bulk

All matching players in one response (no pagination); costs one request
against the rate limit. Params: \`teamType\`, \`team\`, \`minRating\`,
\`maxRating\`, \`position\`.

## GET /api/players/slug/{slug}

One player, full detail (all attributes, badges, hot zones). Optional
\`teamType\` and \`team\` to pick a specific era/version of a shared slug.

## GET /api/players/search?q=

Name search (partial, word-order-agnostic). Params: \`q\` (required),
\`teamType\`, \`limit\` (max 50, default 50).

## POST /api/players/batch

Resolve a list of players by name and/or slug in one request, instead of
calling \`/search\` once per name. JSON body: \`names\` (string[]) and/or
\`slugs\` (string[]), optional \`teamType\`; combined max 100 per call. Names
are matched case-, accent-, and punctuation-insensitively (so \`"doncic"\`
resolves \`"Dončić"\`). Response \`data\` is the matched player array;
\`meta.unmatched\` lists anything that didn't resolve, each with a \`reason\`
(\`not_found\` | \`ambiguous\` | \`empty\`) and, when ambiguous, \`candidates\`.
Costs one request against the rate limit.

\`\`\`
curl -X POST 'https://api.nba2kapi.com/api/players/batch' \\
  -H 'X-API-Key: YOUR_KEY' -H 'Content-Type: application/json' \\
  -d '{"names":["Jimmy Butler","Bennedict Mathurin"],"teamType":"curr"}'
\`\`\`

Player documents also carry two history fields straight from 2kratings:
\`ratingHistory\` (game-to-game overalls: \`[{ gameVersion, overall, delta }]\`)
and \`seasonMovement\` (in-season milestones for the current game:
\`[{ label, overall }]\`, filled in as the season progresses).

## GET /api/players/{id}/history

Weekly rating snapshots for a player. Params: \`gameVersion\`, \`limit\`.

## GET /api/players/{id}/attribute/{attr}

History of a single attribute. Param: \`limit\`.

## GET /api/trending

Biggest recent rating changes. Params: \`teamType\`, \`days\` (1–90, default 7),
\`limit\` (max 50, default 20).

## GET /api/teams

Teams with player counts and average ratings. Params: \`teamType\` or its
alias \`era\` (\`curr\` | \`class\` | \`allt\`).

## GET /api/teams/{team}/roster

Full roster for one team. \`{team}\` accepts the full name
(URL-encoded) or a slug like \`los-angeles-lakers\`
(\`1995-96-chicago-bulls\` for classic teams). Optional \`teamType\`.

## GET /api/badges

Badge reference. Params: \`category\`, \`gameVersion\`. Also:
\`/api/badges/categories\`, \`/api/badges/{slug}\`,
\`/api/badges/{slug}/players\` (params: \`tier\`, \`limit\`).

## Errors

Error codes (all use the standard envelope):
- \`MISSING_API_KEY\` (401) — no X-API-Key header
- \`INVALID_API_KEY\` (401) — unknown or deactivated key
- \`PLAYER_NOT_FOUND\` / \`TEAM_NOT_FOUND\` (404)
- \`INVALID_PARAMETER\` (400) — invalid value, e.g. unknown sort field or an attribute bound outside 0–99
- \`UNKNOWN_PARAMETERS\` (400) — unrecognized query parameter; the response suggests the closest valid one
- \`RATE_LIMIT_EXCEEDED\` (429) — includes \`details.retryAfter\` seconds

Retry guidance: retry 429 after \`retryAfter\` (or exponential backoff) and
5xx with backoff; never retry other 4xx without changing the request.

## Public endpoint (no key)

\`GET /api/public/players\` — same shape as /api/players with basic filters,
IP rate-limited (60/min). Meant for quick browser demos; use a key for
anything real.
`;
