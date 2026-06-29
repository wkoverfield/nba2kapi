/**
 * Configuration for NBA 2K ratings scraper
 * Contains URLs, selectors, and options for scraping 2kratings.com
 */

export const BASE_URL = 'https://www.2kratings.com';

/**
 * Team type configurations
 */
export const TEAM_TYPES = {
  curr: {
    name: 'current',
    url: '/current-teams',
    type: 'curr'
  },
  class: {
    name: 'classic',
    url: '/classic-teams',
    type: 'class'
  },
  allt: {
    name: 'all-time',
    url: '/all-time-teams',
    type: 'allt'
  }
};

/**
 * DOM selectors for team roster pages
 */
export const TEAM_SELECTORS = {
  // Team list page selectors
  teamLinks: 'td:first-child a',
  teamName: 'textContent',
  teamLogo: 'img',

  // Team roster page selectors
  playerRows: 'tr',
  playerName: '.entry-font',
  playerRating: '.rating-updated',
  playerMisc: '.entry-subtext-font.crop-subtext-font a'
};

/**
 * DOM selectors for individual player pages
 * These will be used to scrape detailed player attributes
 */
export const PLAYER_SELECTORS = {
  // Basic info
  name: 'h1.player-name', // Placeholder - need to inspect actual player pages
  build: '.player-build',
  position: '.player-position',

  // Physical attributes
  height: '.player-height',
  weight: '.player-weight',
  wingspan: '.player-wingspan',

  // Player image
  image: '.player-image img',

  // Attributes (organized by category)
  attributes: {
    // Shooting
    closeShot: '[data-attr="close-shot"]',
    midRange: '[data-attr="mid-range"]',
    threePoint: '[data-attr="three-point"]',
    freeThrow: '[data-attr="free-throw"]',
    shotIQ: '[data-attr="shot-iq"]',
    offensiveConsistency: '[data-attr="offensive-consistency"]',

    // Finishing
    drivingLayup: '[data-attr="driving-layup"]',
    drivingDunk: '[data-attr="driving-dunk"]',
    standingDunk: '[data-attr="standing-dunk"]',
    postHook: '[data-attr="post-hook"]',
    postFade: '[data-attr="post-fade"]',
    postControl: '[data-attr="post-control"]',
    drawFoul: '[data-attr="draw-foul"]',
    hands: '[data-attr="hands"]',

    // Playmaking
    passAccuracy: '[data-attr="pass-accuracy"]',
    ballHandle: '[data-attr="ball-handle"]',
    passIQ: '[data-attr="pass-iq"]',
    passVision: '[data-attr="pass-vision"]',
    speedWithBall: '[data-attr="speed-with-ball"]',

    // Defense
    interiorDefense: '[data-attr="interior-defense"]',
    perimeterDefense: '[data-attr="perimeter-defense"]',
    steal: '[data-attr="steal"]',
    block: '[data-attr="block"]',
    helpDefenseIQ: '[data-attr="help-defense-iq"]',
    passPerception: '[data-attr="pass-perception"]',
    defensiveConsistency: '[data-attr="defensive-consistency"]',

    // Athleticism
    speed: '[data-attr="speed"]',
    agility: '[data-attr="agility"]',
    strength: '[data-attr="strength"]',
    vertical: '[data-attr="vertical"]',
    stamina: '[data-attr="stamina"]',
    hustle: '[data-attr="hustle"]',
    overallDurability: '[data-attr="overall-durability"]',

    // Rebounding
    offensiveRebound: '[data-attr="offensive-rebound"]',
    defensiveRebound: '[data-attr="defensive-rebound"]',

    // Special
    intangibles: '[data-attr="intangibles"]',
    potential: '[data-attr="potential"]'
  },

  // Badges
  badgeContainer: '.badges-container',
  badgeItem: '.badge-item',
  badgeName: '.badge-name',
  badgeTier: '.badge-tier',
  badgeCategory: '.badge-category',

  // Badge counts
  totalBadges: '.total-badges',
  hofBadges: '.hof-badges',
  goldBadges: '.gold-badges',
  silverBadges: '.silver-badges',
  bronzeBadges: '.bronze-badges'
};

/**
 * Scraping options
 */
export const SCRAPER_OPTIONS = {
  // Browser options.
  // Cloudflare blocks headless Chrome on 2kratings.com, so we run HEADED by
  // default — locally with a real display, in CI under a virtual one (xvfb).
  // Only go headless when explicitly forced (HEADLESS=true), e.g. for debugging.
  headless: process.env.HEADLESS === 'true',

  // Navigation options
  waitUntil: 'domcontentloaded',
  timeout: 30000,

  // Delays (milliseconds) to avoid rate limiting
  delayBetweenTeams: 1000,
  delayBetweenPlayers: 500,

  // Retry configuration
  maxRetries: 3,
  retryDelay: 2000
};

/**
 * Output schema (for reference)
 * Matches PRD section 5.2 database schema
 */
export const OUTPUT_SCHEMA = {
  // Player object structure
  player: {
    name: 'string',
    slug: 'string', // URL-friendly version of name
    team: 'string',
    teamType: 'curr | class | allt',
    overall: 'number',
    position: 'string',
    height: 'string',
    weight: 'string',
    wingspan: 'string',
    build: 'string',
    playerImage: 'string',
    teamImage: 'string',

    attributes: {
      shooting: {
        closeShot: 'number',
        midRange: 'number',
        threePoint: 'number',
        freeThrow: 'number',
        shotIQ: 'number',
        offensiveConsistency: 'number'
      },
      finishing: {
        drivingLayup: 'number',
        drivingDunk: 'number',
        standingDunk: 'number',
        postHook: 'number',
        postFade: 'number',
        postControl: 'number',
        drawFoul: 'number',
        hands: 'number'
      },
      playmaking: {
        passAccuracy: 'number',
        ballHandle: 'number',
        passIQ: 'number',
        passVision: 'number',
        speedWithBall: 'number'
      },
      defense: {
        interiorDefense: 'number',
        perimeterDefense: 'number',
        steal: 'number',
        block: 'number',
        helpDefenseIQ: 'number',
        passPerception: 'number',
        defensiveConsistency: 'number'
      },
      athleticism: {
        speed: 'number',
        agility: 'number',
        strength: 'number',
        vertical: 'number',
        stamina: 'number',
        hustle: 'number',
        overallDurability: 'number'
      },
      rebounding: {
        offensiveRebound: 'number',
        defensiveRebound: 'number'
      },
      special: {
        intangibles: 'number',
        potential: 'number'
      }
    },

    badges: {
      total: 'number',
      hallOfFame: 'number',
      gold: 'number',
      silver: 'number',
      bronze: 'number',
      list: [
        {
          name: 'string',
          tier: 'string',
          category: 'string'
        }
      ]
    },

    lastUpdated: 'timestamp',
    createdAt: 'timestamp'
  }
};
