/**
 * The NBA 2K edition currently being scraped from 2kratings.com.
 * Lives in convex/ so Convex functions, the plain-Node scraper scripts, and
 * app code all share one value — bump it here (and only here) each season.
 * Kept as .js (with a .d.ts twin) because scripts/runScraper.js imports it
 * directly under Node with no TypeScript loader.
 */
export const CURRENT_GAME_VERSION = "2K27";
