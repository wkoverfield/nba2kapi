# NBA 2K API

A complete REST API and web application for exploring NBA 2K players, attributes, badges, and rosters across current, classic, and all-time teams.

**Live site:** [nba2kapi.com](https://nba2kapi.com) · **Documentation:** [nba2kapi.com/docs](https://nba2kapi.com/docs)

## Overview

NBA 2K API serves one maintained dataset through several focused tools:

- **REST API** — authenticated, rate-limited access to players, attributes, badges, and team rosters
- **Playground** — build readable player queries and inspect the exact API request
- **Rosters** — browse every current, classic, and all-time team and its depth chart
- **Lineup Builder** — drag players onto a regulation court, analyze one five, or compare a matchup
- **Player Dossiers and Compare** — inspect ratings, physicals, positional context, badges, and side-by-side attribute breakdowns
- **Badge Explorer** — browse badge definitions and tiers, then open matching players in the Playground
- **Automated Scraper** — refresh the underlying 2K ratings data on a schedule

## Features

### API Features
- Comprehensive player data (40+ attributes, badges, physical stats)
- Team roster queries (current, classic, all-time)
- Player search by name
- Position, rating, attribute, badge, and badge-tier filters
- API key authentication
- Rate limiting (100 requests/hour per key)
- ETag support for caching
- Response time tracking

### Scraper Features
- Scrapes all team types: Current, Classic, and All-Time teams
- Extracts detailed player attributes (30+ data points)
- Badge system with tier levels (Hall of Fame, Gold, Silver, Bronze)
- Configurable scraping modes (basic or detailed)
- Progress tracking and statistics
- Automatic data upload to Convex

### Frontend Features
- API key management dashboard
- Live usage statistics
- Recent request logs
- Sentence-driven API Playground
- Searchable roster and player pages
- Single-lineup analysis and two-lineup matchup comparison
- In-depth player comparison with attribute, physical, radar, and badge views
- Searchable badge explorer with tier-specific player handoffs
- Responsive design

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend**: Convex (serverless platform), Hono (HTTP routing)
- **Scraper**: Playwright, Node.js
- **Deployment**: Vercel (frontend), Convex Cloud (backend)

## Quick Start

### 1. API Usage

Get your free API key at [https://nba2kapi.com](https://nba2kapi.com)

```bash
# Search for players
curl 'https://api.nba2kapi.com/api/players?search=james' \
  -H 'X-API-Key: your_api_key_here'

# Get player by slug (user-friendly)
curl 'https://api.nba2kapi.com/api/players/slug/bronny-james' \
  -H 'X-API-Key: your_api_key_here'

# Get team roster
curl 'https://api.nba2kapi.com/api/teams/Los%20Angeles%20Lakers/roster' \
  -H 'X-API-Key: your_api_key_here'

# Get all players (paginated)
curl 'https://api.nba2kapi.com/api/players?limit=50&teamType=curr' \
  -H 'X-API-Key: your_api_key_here'

# Find Gold Deadeye players, highest overall first
curl 'https://api.nba2kapi.com/api/players?badge=deadeye&badgeTier=Gold&sort=overall:desc' \
  -H 'X-API-Key: your_api_key_here'

# Get database stats (no auth required)
curl 'https://api.nba2kapi.com/api/stats'
```

### 2. Local Development

#### Prerequisites
- Node.js 18+
- npm or yarn
- Convex account (free)

#### Setup

```bash
# Clone repository
git clone https://github.com/wkoverfield/nba2kapi.git
cd nba2kapi

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your Convex deployment URL
# Get your URL from: https://dashboard.convex.dev

# Start Convex development server and Next.js together
npm run dev
```

#### Environment Variables

Create `.env.local` in the root directory:
```env
# Convex Backend
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url
CONVEX_DEPLOYMENT=dev:your-deployment
CONVEX_URL=https://your-deployment.convex.cloud

# API Configuration
ADMIN_API_KEY=your_secure_admin_key_here
CLIENT_ORIGIN=http://localhost:3000

# Environment
NODE_ENV=development
```

See `.env.example` for a complete template with all available options.

### 3. Running the Scraper

```bash
# Install Playwright browsers
npx playwright install chromium

# Scrape current NBA teams
CONVEX_URL=your_convex_url node scripts/runScraper.js curr

# Scrape all team types
CONVEX_URL=your_convex_url node scripts/runScraper.js all

# Scrape specific team
CONVEX_URL=your_convex_url node scripts/runScraper.js curr "Los Angeles Lakers"
```

## API Reference

### Authentication

All API requests require an API key in the `X-API-Key` header:

```
X-API-Key: your_api_key_here
```

### Rate Limiting

- **Limit**: 100 requests per hour per API key
- **Headers**: Response includes `X-RateLimit-Remaining` and `X-RateLimit-Reset`

### Endpoints

#### GET /api/players/bulk

Authenticated **bulk export** — returns every matching player in one
response, no pagination. Use this instead of paginating through
`/api/players` when you want the whole dataset (or a wide filtered slice).
Costs **1 request** against your rate limit instead of the N requests
pagination would burn.

- **Auth:** API key required (same as `/api/players`)
- **Cache:** 1 hour, supports `ETag` / `If-None-Match` → 304 on revalidate
- **Query params:** `teamType`, `team`, `minRating`, `maxRating`, `position` (all optional)
- **Cap:** 10,000 records per response (current DB is ~1,900 — leaves plenty of headroom)

**Example:**
```bash
# All current-NBA players in one shot
curl 'https://api.nba2kapi.com/api/players/bulk?teamType=curr' \
  -H 'X-API-Key: your_api_key_here' > players-curr.json

# Just elite players across all team types
curl 'https://api.nba2kapi.com/api/players/bulk?minRating=90' \
  -H 'X-API-Key: your_api_key_here'
```

**Response shape** (same as `/api/players` but with a single `meta` block
instead of pagination):
```json
{
  "success": true,
  "data": [ /* ...every matching player... */ ],
  "meta": {
    "count": 529,
    "total": 529,
    "filters": { "teamType": "curr", "team": null, "minRating": null, ... }
  }
}
```

#### GET /api/public/players

Public, **unauthenticated** read-only player list. Same shape as `/api/players` but
no API key required — intended for browser apps that can't safely embed a key
(extracting an API key from client-side JS is trivial).

- **Auth:** none
- **Rate limit:** 60 requests/minute per IP (separate from API-key limits)
- **CORS:** enabled for allowlisted browser origins
- **Cache:** 1 hour (`Cache-Control: public, max-age=3600`), supports `ETag` / `If-None-Match` → 304
- **Query params:** `teamType`, `team`, `minRating`, `maxRating`, `position`, `cursor`, and `limit`

**Example:**
```bash
curl 'https://api.nba2kapi.com/api/public/players?teamType=curr&minRating=80&maxRating=99&limit=100'
```

If you need higher limits, per-key analytics, or write endpoints, get a free API
key at https://nba2kapi.com and use the authenticated `/api/players` route instead.

#### GET /api/players

Get all players with optional filters.

**Query Parameters:**
- `team` (string): Filter by team name
- `teamType` (string): Filter by team type (curr, class, allt)
- `position` (string): Filter by position (PG, SG, SF, PF, C)
- `minRating` (number): Minimum overall rating
- `maxRating` (number): Maximum overall rating
- `badge` (string): Filter by normalized badge slug (for example, `deadeye`)
- `badgeTier` (string): Optionally require an exact tier (`Legendary`, `Hall of Fame`, `Gold`, `Silver`, or `Bronze`)
- `sort` (string): Sort by overall, name, or an attribute using `<field>:<asc|desc>` (for example, `overall:desc` or `three_ball:desc`)
- `limit` (number): Results per page (default: 50, max: 100)
- `cursor` (string): Pagination cursor from previous response

> **Note:** For searching by player name, use `/api/players/search?q=name` instead.

**Example:**
```bash
curl 'https://api.nba2kapi.com/api/players?position=PG&minRating=85&badge=deadeye&badgeTier=Gold' \
  -H 'X-API-Key: your_api_key_here'
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Stephen Curry",
      "slug": "stephen-curry",
      "team": "Golden State Warriors",
      "overall": 95,
      "positions": ["PG"],
      "height": "6'2\"",
      "playerImage": "https://...",
      "teamImg": "https://...",
      "attributes": { ... },
      "badges": { ... }
    }
  ],
  "pagination": {
    "hasMore": false,
    "nextCursor": null,
    "count": 42,
    "limit": 50
  }
}
```

#### GET /api/players/slug/:slug

Get a specific player by slug (human-readable identifier).

**Query Parameters:**
- `teamType` (optional): Filter by team type (curr, class, allt) if player appears on multiple teams
- `team` (optional): Filter by specific team name (for players on multiple teams like Michael Jordan on different Bulls squads)

**Example:**
```bash
# Get current player
curl 'https://api.nba2kapi.com/api/players/slug/bronny-james' \
  -H 'X-API-Key: your_api_key_here'

# Get specific version of player on multiple teams
curl 'https://api.nba2kapi.com/api/players/slug/michael-jordan?teamType=class&team=%2795-%2796%20Bulls' \
  -H 'X-API-Key: your_api_key_here'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "name": "Bronny James Jr.",
    "slug": "bronny-james",
    "team": "Los Angeles Lakers",
    "overall": 68,
    "positions": ["PG"],
    "height": "6'2\"",
    "weight": "210 lbs",
    "build": "By Ace",
    "attributes": {
      "shooting": {
        "closeShot": 69,
        "midRangeShot": 63,
        "threePointShot": 70
      }
    },
    "badges": {
      "total": 0,
      "list": []
    }
  }
}
```

#### GET /api/players/:id

Get a specific player by Convex database ID (for advanced use).

**Example:**
```bash
curl 'https://api.nba2kapi.com/api/players/j97abc123...' \
  -H 'X-API-Key: your_api_key_here'
```

#### Badge endpoints

Browse normalized badge metadata or retrieve the players who hold a badge. All badge endpoints require an API key.

- `GET /api/badges` — list badges; optionally filter by `category` or `gameVersion`
- `GET /api/badges/categories` — list badge categories with counts
- `GET /api/badges/:slug` — get one badge by normalized slug
- `GET /api/badges/:slug/players` — get matching players; optionally filter by `tier` and set `limit` (max 100)

```bash
curl 'https://api.nba2kapi.com/api/badges/deadeye/players?tier=Gold&limit=50' \
  -H 'X-API-Key: your_api_key_here'
```

#### GET /api/teams/:teamName/roster

Get a team roster by team name.

**Query Parameters:**
- `teamType` (optional): Filter by team type (curr, class, allt)

**Example:**
```bash
curl 'https://api.nba2kapi.com/api/teams/Los%20Angeles%20Lakers/roster' \
  -H 'X-API-Key: your_api_key_here'
```

#### GET /api/stats

Get database statistics (no auth required).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPlayers": 1456,
    "uniqueTeams": 102,
    "avgOverall": 77
  }
}
```

#### GET /api/health

Health check endpoint for service monitoring (no auth required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-21T10:30:00.000Z",
  "service": "NBA 2K API",
  "version": "1.0.0"
}
```

### Error Responses

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

**Error Codes:**
- `MISSING_API_KEY`: No API key provided
- `INVALID_API_KEY`: Invalid or expired API key
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `PLAYER_NOT_FOUND`: Player not found
- `INVALID_PARAMETERS`: Invalid query parameters
- `INVALID_INPUT`: Invalid input data (e.g., search query too long)

## Project Structure

```
.
├── convex/                    # Convex backend
│   ├── schema.ts             # Database schema
│   ├── players.ts            # Player queries
│   ├── teams.ts              # Team queries
│   ├── badges.ts             # Badge directory and player lookups
│   ├── dossier.ts            # Player detail aggregates
│   ├── apiKeys.ts            # API key management
│   └── http.ts               # HTTP API endpoints
│
├── app/                      # Next.js App Router
│   ├── page.tsx             # Landing page
│   ├── dashboard/           # API-key dashboard
│   ├── docs/                # Documentation
│   ├── playground/          # Interactive query builder
│   ├── teams/               # Rosters and depth charts
│   ├── lineups/             # Lineup builder and analysis
│   ├── compare/             # Player comparison
│   ├── badges/              # Badge explorer and detail pages
│   └── players/             # Player dossiers
│
├── components/              # React components
│   ├── ui/                 # UI primitives (shadcn/ui)
│   ├── player/             # Player-related components
│   └── lineups/            # Lineup components
│
├── lib/                    # Utilities & helpers
│   ├── attribute-normalizer.ts  # Attribute normalization
│   ├── player-stats.ts          # Player statistics
│   └── utils.ts                 # General utilities
│
├── scraper/               # Web scraper
│   └── playerScraper.js  # Playwright-based scraper
│
├── scripts/              # Utility scripts
│   ├── runScraper.js    # Scraper orchestrator
│   ├── normalize-player-data.ts  # Data migration
│   └── README.md        # Scripts documentation
│
├── .env.example         # Environment variables template
└── README.md           # This file
```

## Scraper Details

### Team Types

- `curr` - Current NBA teams for the active NBA 2K release
- `class` - Classic NBA teams (historical)
- `allt` - All-Time NBA teams (legends)

### Data Extracted

**Player Data:**
- Basic info: name, team, position, overall rating
- Physical: height, weight, wingspan
- Shooting attributes (15+ stats)
- Finishing attributes (10+ stats)
- Playmaking attributes (5+ stats)
- Defense attributes (10+ stats)
- Athleticism attributes (5+ stats)
- Badges with tier levels

**Performance:**
- Basic Mode: ~14-15 players/second
- Full Mode: ~5-10 players/second
- Memory: ~200MB for 1000 players

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables:
   - `NEXT_PUBLIC_CONVEX_URL`
4. Deploy

### Backend (Convex)

```bash
npx convex deploy
```

### Automated Scraping

Set up a cron job or GitHub Action to run the scraper weekly:

```yaml
# .github/workflows/scrape.yml
name: Scrape Data
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npx playwright install chromium
      - run: CONVEX_URL=${{ secrets.CONVEX_URL }} node scripts/runScraper.js all
```

## Performance

- **API Response Time**: ~150ms average
- **Database Size**: ~1500 players, ~15MB
- **Rate Limit**: 100 requests/hour per key
- **Uptime**: 99.9% (Convex SLA)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

- [ ] Historical rating tracking (track changes over time)
- [x] Player comparison tool
- [x] Badge explorer and badge-tier player filtering
- [x] Single-lineup analysis and two-lineup matchup mode
- [ ] Additional advanced filters, including archetype
- [ ] GraphQL API
- [ ] WebSocket support for real-time updates
- [ ] Team analytics and stats
- [ ] MyTeam card database

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Data sourced from [2kratings.com](https://www.2kratings.com/)
- Built with [Convex](https://convex.dev/) and [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/wkoverfield/nba2kapi/issues)
- Documentation: [View full docs](https://nba2kapi.com/docs)

## Analytics

**Growth history:**

- **Feb 2026 baseline:** 48 API keys, 1,842 authenticated requests
- **Jun 2026:** 168 API keys (146 active), approximately 45,700 authenticated requests — about 25× request growth in four months
- **Jul 11, 2026:** 188 API keys (162 active), 48,158 authenticated requests — about 26× the February baseline

**Current activity as of July 11, 2026:**

- 11,379 authenticated requests in the last 30 days; 1,845 in the last 7 days
- 98.8% of authenticated requests returned 2xx responses in the last 7 days
- 732 site views from 129 unique visitors in the last 7 days

Authenticated-request totals come from per-key counters and do not include traffic to the unauthenticated public endpoint. Site traffic is measured separately.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to 2K Sports, the NBA, or any of their subsidiaries. All data is publicly available from 2kratings.com. This is a fan-made project for educational and community purposes.
