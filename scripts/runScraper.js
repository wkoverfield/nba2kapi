/**
 * Scraper Runner for Convex Integration
 * Runs the Playwright scraper and uploads results to Convex
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { scrapeTeamLinks, scrapeTeamRoster } from '../scraper/teamScraper.js';
import { scrapePlayerDetails } from '../scraper/playerScraper.js';
import { initBrowser, createPage } from '../scraper/utils.js';

// IMPORTANT: Scraper uses ConvexHttpClient which requires .convex.cloud domain
// (NOT .convex.site which is for HTTP actions)
const CONVEX_URL = process.env.CONVEX_URL || "https://canny-kingfisher-472.convex.cloud";
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

/**
 * Main scraper function
 */
async function runScraper(options = {}) {
  const {
    teamType = 'curr',
    teams = null,
    jobId = `scrape_${teamType}_${Date.now()}`,
    gameVersion = '2K26',
  } = options;

  if (!ADMIN_API_KEY) {
    throw new Error("Missing ADMIN_API_KEY environment variable");
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  const startTime = new Date().toISOString();

  let playersScraped = 0;
  let playersUpdated = 0;
  let playersAdded = 0;
  let playersUnchanged = 0;
  let teamsScraped = 0;
  let emptyTeams = 0; // teams whose roster came back with 0 players (soft-block signal)
  const errors = [];

  console.log(`Starting scrape job ${jobId} for team type: ${teamType}`);

  try {
    // Initialize browser
    const browser = await initBrowser();
    const page = await createPage(browser);

    try {
      // Scrape team links
      console.log(`Fetching teams list...`);
      const allTeams = await scrapeTeamLinks(page, teamType);

      // Filter teams if specified
      const teamsToScrape = teams
        ? allTeams.filter(t => teams.includes(t.teamName))
        : allTeams;

      console.log(`Found ${teamsToScrape.length} teams to scrape`);

      // Scrape each team
      for (const team of teamsToScrape) {
        try {
          console.log(`Scraping team: ${team.teamName}`);

          // Get basic player data from roster
          const basicPlayers = await scrapeTeamRoster(page, team, teamType);
          console.log(`  Found ${basicPlayers.length} players`);
          // A roster page that loads but yields 0 players is the per-team
          // soft-block signature — track it so reconcile won't prune that
          // team's players as "departed".
          if (basicPlayers.length === 0) emptyTeams++;

          // Scrape detailed data for each player
          for (const basicPlayer of basicPlayers) {
            try {
              const playerDetails = await scrapePlayerDetails(page, basicPlayer);

              // Generate slug from player URL or name
              let slug = '';
              if (basicPlayer.playerUrl) {
                slug = basicPlayer.playerUrl.split('/').pop() || '';
              }
              if (!slug && basicPlayer.name) {
                slug = basicPlayer.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              }

              // Merge basic and detailed data
              const fullPlayer = {
                ...basicPlayer,
                ...playerDetails,
                slug,
                gameVersion,
                scrapeJobId: jobId,
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString(),
              };

              // Remove playerMisc (not in schema)
              delete fullPlayer.playerMisc;

              // Upsert to Convex with history tracking
              const result = await client.mutation(api.playerHistory.adminUpsertPlayerWithHistory, {
                adminKey: ADMIN_API_KEY,
                ...fullPlayer,
              });

              if (result.action === 'inserted') {
                playersAdded++;
              } else if (result.action === 'updated') {
                playersUpdated++;
              } else {
                playersUnchanged++;
              }

              playersScraped++;

            } catch (error) {
              // Log full error details for debugging
              const errorMsg = `Error scraping player ${basicPlayer.name}: ${error.message}`;
              console.error(errorMsg);
              if (error.data) {
                console.error('Error data:', JSON.stringify(error.data, null, 2));
              }
              if (error.cause) {
                console.error('Error cause:', error.cause);
              }
              errors.push(errorMsg);
            }
          }

          teamsScraped++;

        } catch (error) {
          const errorMsg = `Error scraping team ${team.teamName}: ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

    } finally {
      await browser.close();
    }

    // Calculate duration
    const endTime = new Date().toISOString();
    const duration = Date.now() - new Date(startTime).getTime();

    console.log(`Scrape job ${jobId} completed successfully`);
    console.log(`  Players scraped: ${playersScraped}`);
    console.log(`  Players added: ${playersAdded}`);
    console.log(`  Players updated (changed): ${playersUpdated}`);
    console.log(`  Players unchanged: ${playersUnchanged}`);
    console.log(`  Teams scraped: ${teamsScraped}`);
    console.log(`  Errors: ${errors.length}`);

    // Reconcile: drop players for this teamType who weren't seen on any roster
    // this run (departed/orphan rows). Only on a clean FULL-teamType scrape:
    //  - never when a single `teams` filter was used (we only saw some teams)
    //  - never if the scrape errored (partial data)
    //  - never if ANY team's roster came back empty (per-team soft-block: that
    //    team's players would otherwise be wrongly pruned as departed)
    // The mutation has further guards (40% cap). Set RECONCILE_DRY_RUN=true to preview.
    if (emptyTeams > 0) {
      console.log(`Reconcile (${teamType}): SKIPPED — ${emptyTeams} team(s) returned 0 players (possible soft-block); not pruning.`);
    }
    if (!teams && playersScraped > 0 && errors.length === 0 && emptyTeams === 0) {
      try {
        const reconcile = await client.mutation(api.players.reconcileRoster, {
          adminKey: ADMIN_API_KEY,
          teamType,
          runStartedAt: startTime,
          scrapedCount: playersScraped,
          dryRun: process.env.RECONCILE_DRY_RUN === 'true',
        });
        console.log(`Reconcile (${teamType}):`, JSON.stringify(reconcile));
      } catch (error) {
        // Non-fatal: a reconcile failure shouldn't fail the scrape/upload.
        console.error(`Reconcile failed for ${teamType} (non-fatal):`, error.message);
      }
    }

    return {
      jobId,
      gameVersion,
      success: true,
      playersScraped,
      playersUpdated,
      playersAdded,
      playersUnchanged,
      teamsScraped,
      errors,
      duration,
      startTime,
      endTime,
    };

  } catch (error) {
    const endTime = new Date().toISOString();
    const duration = Date.now() - new Date(startTime).getTime();

    console.error(`Scrape job ${jobId} failed:`, error);

    return {
      jobId,
      gameVersion,
      success: false,
      playersScraped,
      playersUpdated,
      playersAdded,
      playersUnchanged,
      teamsScraped,
      errors: [...errors, error.message],
      duration,
      startTime,
      endTime,
    };
  }
}

// CLI support
if (import.meta.url === `file://${process.argv[1]}`) {
  const teamType = process.argv[2] || 'curr';
  const teamsArg = process.argv[3];
  const teams = teamsArg ? teamsArg.split(',') : null;

  runScraper({ teamType, teams })
    .then(result => {
      console.log('\nScraper result:', JSON.stringify(result, null, 2));

      // Fail loudly on an empty scrape. `success` only reflects "no exception
      // thrown" — but a Cloudflare block returns 0 teams/players WITHOUT
      // throwing, so the old code exited 0 and CI stayed green on frozen data
      // for weeks. A 0-player run is a real failure: surface it so CI goes red.
      if (result.playersScraped === 0) {
        console.error(
          '\n✖ FAILURE: scraped 0 players. The source almost certainly blocked ' +
          'the browser (Cloudflare). Data was NOT updated — failing so CI alerts.'
        );
        process.exit(1);
      }

      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runScraper };
