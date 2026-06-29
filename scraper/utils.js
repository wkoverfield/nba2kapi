/**
 * Utility functions for the NBA 2K ratings scraper
 */

import { chromium } from 'playwright';
import { SCRAPER_OPTIONS, BASE_URL } from './config.js';

/**
 * Initialize and launch browser.
 *
 * 2kratings.com sits behind Cloudflare's "Just a moment..." JS challenge.
 * A real (headed) browser solves it automatically; a headless browser gets
 * blocked (HTTP 403). In CI we therefore run headed under a virtual display
 * (xvfb) — see .github/workflows/scrape.yml. The launch args below strip the
 * most obvious automation fingerprints so the challenge passes cleanly.
 *
 * @returns {Promise<Browser>} Playwright browser instance
 */
export async function initBrowser() {
  const browser = await chromium.launch({
    headless: SCRAPER_OPTIONS.headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });
  return browser;
}

const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/**
 * Create a new page inside a hardened browser context.
 *
 * Sets a realistic user agent / viewport / locale and removes the
 * `navigator.webdriver` flag so Cloudflare's bot-detection treats the session
 * as an ordinary browser. Use this everywhere instead of `browser.newPage()`.
 *
 * @param {Browser} browser - Playwright browser instance
 * @returns {Promise<Page>} Playwright page instance
 */
export async function createPage(browser) {
  const context = await browser.newContext({
    userAgent: STEALTH_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  });

  // Hide the headless/automation tell that Cloudflare checks for.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  // Set default timeout
  page.setDefaultTimeout(SCRAPER_OPTIONS.timeout);

  return page;
}

/**
 * Normalize URL - convert relative URLs to absolute
 * @param {string} url - URL to normalize
 * @returns {string} Absolute URL
 */
export function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
}

/**
 * Create a URL-friendly slug from a string
 * @param {string} text - Text to slugify
 * @returns {string} URL-friendly slug
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Parse integer from string, return null if invalid
 * @param {string|number} value - Value to parse
 * @returns {number|null} Parsed integer or null
 */
export function parseIntSafe(value) {
  if (typeof value === 'number') return value;
  if (!value) return null;

  const parsed = parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Extract text content from element
 * @param {Element} element - DOM element
 * @returns {string} Trimmed text content
 */
export function getTextContent(element) {
  return element?.textContent?.trim() || '';
}

/**
 * Validate player data has required fields
 * @param {Object} player - Player object
 * @returns {boolean} True if valid
 */
export function isValidPlayer(player) {
  return Boolean(
    player &&
    player.name &&
    player.overall &&
    player.team
  );
}

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise<any>} Result of successful function call
 */
export async function retryWithBackoff(fn, maxRetries = SCRAPER_OPTIONS.maxRetries, baseDelay = SCRAPER_OPTIONS.retryDelay) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i < maxRetries - 1) {
        const delayMs = baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delayMs}ms...`);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Log progress message with timestamp
 * @param {string} message - Message to log
 * @param {Object} data - Optional data to include
 */
export function logProgress(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

/**
 * Log error message
 * @param {string} message - Error message
 * @param {Error} error - Error object
 */
export function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);

  if (error) {
    console.error(error);
  }
}

/**
 * Format player count for logging
 * @param {number} count - Number of players
 * @returns {string} Formatted string
 */
export function formatPlayerCount(count) {
  return `${count} player${count !== 1 ? 's' : ''}`;
}

/**
 * Calculate scraping statistics
 * @param {Array} players - Array of player objects
 * @param {number} startTime - Start timestamp
 * @returns {Object} Statistics object
 */
export function calculateStats(players, startTime) {
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000; // seconds

  return {
    totalPlayers: players.length,
    duration: duration.toFixed(2),
    playersPerSecond: (players.length / duration).toFixed(2)
  };
}

/**
 * Safely close browser
 * @param {Browser} browser - Playwright browser instance
 */
export async function closeBrowser(browser) {
  try {
    if (browser) {
      await browser.close();
    }
  } catch (error) {
    logError('Failed to close browser', error);
  }
}
