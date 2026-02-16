# NBA2KAPI

A complete REST API and web application for accessing NBA 2K player ratings and team rosters. Includes automated web scraping, a serverless backend, and a modern Next.js frontend.

## Overview

This project provides:
- **REST API**: Access NBA 2K player data with authentication and rate limiting
- **Web Dashboard**: Manage API keys and monitor usage
- **Live Search**: Interactive player search with real-time results
- **Automated Scraper**: Playwright-based scraper for 2kratings.com
- **Serverless Backend**: Built on Convex for real-time data and HTTP actions

## Features

### API Features
- Comprehensive player data (40+ attributes, badges, physical stats)
- Team roster queries (current, classic, all-time)
- Player search by name
- Position and rating filters
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
- Interactive player search demo
- Dark mode support
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
git clone https://github.com/woverfield/nba2kapi.git
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

#### GET /api/players

Get all players with optional filters.

**Query Parameters:**
- `team` (string): Filter by team name
- `teamType` (string): Filter by team type (curr, class, allt)
- `position` (string): Filter by position (PG, SG, SF, PF, C)
- `minRating` (number): Minimum overall rating
- `maxRating` (number): Maximum overall rating
- `limit` (number): Results per page (default: 50, max: 100)
- `cursor` (string): Pagination cursor from previous response

> **Note:** For searching by player name, use `/api/players/search?q=name` instead.

**Example:**
```bash
curl 'https://api.nba2kapi.com/api/players?position=PG&minRating=85' \
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
│   ├── apiKeys.ts            # API key management
│   └── http.ts               # HTTP API endpoints
│
├── app/                      # Next.js App Router
│   ├── page.tsx             # Landing page
│   ├── dashboard/           # Dashboard
│   ├── docs/                # Documentation
│   └── player/              # Player pages
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

- `curr` - Current NBA teams (2024-25 season)
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
- [ ] Player comparison tool
- [ ] Advanced search filters (archetype, badges)
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

- GitHub Issues: [Report bugs or request features](https://github.com/woverfield/nba2kapi/issues)
- Documentation: [View full docs](https://nba2kapi.com/docs)

## Analytics

**Baseline (Nov 2025 - Feb 2026):** 48 API keys created, 1,842 requests made.

## Disclaimer

This project is not affiliated with, endorsed by, or connected to 2K Sports, the NBA, or any of their subsidiaries. All data is publicly available from 2kratings.com. This is a fan-made project for educational and community purposes.
