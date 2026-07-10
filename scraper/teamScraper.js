/**
 * Team Roster Scraper
 * Scrapes team listings and basic player data from team roster pages
 */

import { BASE_URL, TEAM_SELECTORS, TEAM_TYPES, SCRAPER_OPTIONS } from './config.js';
import { normalizeUrl, logProgress, logError, delay, parseIntSafe, gotoThroughChallenge } from './utils.js';

/**
 * Scrape team links from the team listing page
 * @param {Page} page - Playwright page instance
 * @param {string} teamType - Team type (curr, class, allt)
 * @returns {Promise<Array>} Array of team objects with links, names, and logos
 */
export async function scrapeTeamLinks(page, teamType) {
  const config = TEAM_TYPES[teamType];
  if (!config) {
    throw new Error(`Invalid team type: ${teamType}`);
  }

  const url = `${BASE_URL}${config.url}`;
  logProgress(`Navigating to ${config.name} teams: ${url}`);

  await gotoThroughChallenge(page, url);

  // Extract team links from the page. Some anchors are image-only (no text,
  // no alt, no title) — the All-Time Timberwolves shipped that way and got
  // scraped as team "" — so the name falls back through img alt / title and
  // finally the href slug ("all-time-minnesota-timberwolves" →
  // "All-Time Minnesota Timberwolves").
  const teams = await page.$$eval(TEAM_SELECTORS.teamLinks, (links) => {
    const nameFromSlug = (href) => {
      const slug = (href || '').split('/').filter(Boolean).pop() || '';
      if (!slug) return '';
      let rest = slug;
      let prefix = '';
      const allTime = rest.match(/^all-time-(.+)$/);
      const classicYears = rest.match(/^(\d{4}-\d{2})-(.+)$/);
      if (allTime) {
        prefix = 'All-Time ';
        rest = allTime[1];
      } else if (classicYears) {
        prefix = `${classicYears[1]} `;
        rest = classicYears[2];
      }
      const title = rest
        .split('-')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');
      return prefix + title;
    };
    return links.map(link => {
      const img = link.querySelector('img');
      const href = link.getAttribute('href');
      const teamName =
        link.textContent.trim() ||
        (img?.alt || '').trim() ||
        (link.getAttribute('title') || '').trim() ||
        nameFromSlug(href);
      return {
        link: href,
        teamName,
        teamImg: img ? img.src : ''
      };
    });
  });

  // Deduplicate by href (the logo anchor and the name anchor share it) and
  // drop anything that still has no name or link.
  const uniqueTeams = Array.from(
    new Map(
      teams
        .filter((team) => team.link && team.teamName)
        .map((team) => [team.link, team])
    ).values()
  ).map((team, _, all) => {
    // Prefer a named duplicate's name and a logo duplicate's image.
    const twins = all.filter((t) => t.link === team.link);
    return {
      link: team.link,
      teamName: twins.map((t) => t.teamName).find(Boolean) || team.teamName,
      teamImg: twins.map((t) => t.teamImg).find(Boolean) || team.teamImg,
    };
  });

  logProgress(`Found ${uniqueTeams.length} teams`);
  return uniqueTeams;
}

/**
 * Scrape basic player data from a team roster page
 * @param {Page} page - Playwright page instance
 * @param {Object} team - Team object with link, teamName, teamImg
 * @param {string} teamType - Team type (curr, class, allt)
 * @returns {Promise<Array>} Array of player objects with basic data
 */
export async function scrapeTeamRoster(page, team, teamType) {
  const teamUrl = normalizeUrl(team.link);

  try {
    logProgress(`Scraping roster: ${team.teamName}`);

    await gotoThroughChallenge(page, teamUrl);

    // Extract player data from roster table
    const players = await page.$$eval(
      TEAM_SELECTORS.playerRows,
      (rows, args) => {
        const { teamName, teamImg, teamType } = args;

        return Array.from(rows).map(row => {
          // Extract basic player info from table row
          const nameEl = row.querySelector('.entry-font');
          const ratingEl = row.querySelector('.rating-updated');
          const miscElements = row.querySelectorAll('.entry-subtext-font.crop-subtext-font a');

          if (!nameEl || !ratingEl) {
            return null;
          }

          const playerName = nameEl.textContent.trim();
          const playerRating = ratingEl.textContent.trim();
          const playerMisc = Array.from(miscElements)
            .map(el => el.textContent.trim())
            .filter(Boolean);

          // Must have name, rating, and at least one misc field
          if (!playerName || !playerRating || playerMisc.length === 0) {
            return null;
          }

          // Extract player page link if available
          const playerLink = nameEl.querySelector('a')?.getAttribute('href') || '';

          return {
            name: playerName,
            playerUrl: playerLink,
            team: teamName,
            teamType: teamType,
            overall: parseInt(playerRating),
            teamImg: teamImg,
            playerMisc: playerMisc
          };
        }).filter(Boolean);
      },
      { teamName: team.teamName, teamImg: team.teamImg, teamType: teamType }
    );

    logProgress(`Found ${players.length} players on ${team.teamName}`);

    // Add delay between teams to avoid rate limiting
    await delay(SCRAPER_OPTIONS.delayBetweenTeams);

    return players;
  } catch (error) {
    logError(`Failed to scrape ${team.teamName}`, error);
    return []; // Return empty array on error to continue with other teams
  }
}

/**
 * Scrape all teams for a given team type
 * @param {Page} page - Playwright page instance
 * @param {string} teamType - Team type (curr, class, allt)
 * @returns {Promise<Array>} Array of all players with basic data
 */
export async function scrapeAllTeams(page, teamType) {
  // Get all team links
  const teams = await scrapeTeamLinks(page, teamType);

  const allPlayers = [];
  let teamCount = 0;

  // Scrape each team's roster
  for (const team of teams) {
    teamCount++;
    logProgress(`Processing team ${teamCount}/${teams.length}: ${team.teamName}`);

    const players = await scrapeTeamRoster(page, team, teamType);
    allPlayers.push(...players);
  }

  logProgress(`Completed scraping ${teamCount} teams`);
  logProgress(`Total players found: ${allPlayers.length}`);

  return allPlayers;
}
