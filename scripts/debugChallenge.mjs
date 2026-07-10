/**
 * Write-free anti-bot diagnostic: drives the exact scraper browser stack
 * against 2kratings from wherever it runs (CI runner or local) and reports
 * whether the sgcaptcha challenge fires and whether it auto-solves.
 * No Convex, no writes — safe to run anywhere.
 */
import { initBrowser, createPage, gotoThroughChallenge } from '../scraper/utils.js';
import { BASE_URL, TEAM_SELECTORS } from '../scraper/config.js';

const targets = [
  `${BASE_URL}/teams`,
  `${BASE_URL}/teams/atlanta-hawks`,
  `${BASE_URL}/teams/boston-celtics`,
];

const browser = await initBrowser();
const page = await createPage(browser);
let failures = 0;

for (const url of targets) {
  const started = Date.now();
  try {
    await gotoThroughChallenge(page, url);
    const rows = await page.$$(TEAM_SELECTORS.playerRows ?? 'body');
    console.log(
      `OK  ${url} → ${page.url()} (${Date.now() - started}ms, ${rows.length} row nodes, title: "${await page.title()}")`
    );
  } catch (error) {
    failures++;
    console.error(`FAIL ${url} after ${Date.now() - started}ms: ${error.message}`);
  }
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
