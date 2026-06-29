/**
 * Player Detail Scraper
 * Scrapes comprehensive player data from individual player pages
 * Updated to work with actual 2kratings.com HTML structure
 */

import { SCRAPER_OPTIONS } from './config.js';
import { normalizeUrl, logProgress, logError, delay, slugify } from './utils.js';

/**
 * Scrape detailed player data from individual player page
 * @param {Page} page - Playwright page instance
 * @param {Object} basicPlayer - Basic player data from roster scrape
 * @returns {Promise<Object|null>} Enhanced player object with detailed attributes
 */
export async function scrapePlayerDetails(page, basicPlayer) {
  if (!basicPlayer.playerUrl) {
    logError(`No player URL for ${basicPlayer.name}, skipping detailed scrape`);
    return enhanceBasicPlayer(basicPlayer);
  }

  const playerUrl = normalizeUrl(basicPlayer.playerUrl);

  try {
    await page.goto(playerUrl, { waitUntil: SCRAPER_OPTIONS.waitUntil });

    // Scrape all player details using the ACTUAL HTML structure
    const playerDetails = await page.evaluate(() => {
      const details = {};

      // Extract physical stats and build from paragraph text
      const paragraphs = Array.from(document.querySelectorAll('p'));
      for (const p of paragraphs) {
        const text = p.textContent;

        // Extract height - try both formats
        // Format 1: "6 feet 9 inches" (current teams)
        let heightMatch = text.match(/(\d+)\s*feet\s*(\d+)\s*inches/);
        if (heightMatch) {
          details.height = `${heightMatch[1]}'${heightMatch[2]}"`;
        } else {
          // Format 2: "Height: 6'7" (201cm)" (classic/all-time teams)
          heightMatch = text.match(/Height:\s*(\d+)'(\d+)"/);
          if (heightMatch) {
            details.height = `${heightMatch[1]}'${heightMatch[2]}"`;
          }
        }

        // Extract weight - try both formats
        // Format 1: "weighs 250 pounds" (current teams)
        let weightMatch = text.match(/weighs.*?(\d+)\s*pounds/);
        if (weightMatch) {
          details.weight = `${weightMatch[1]} lbs`;
        } else {
          // Format 2: "Weight: 200lbs (90kg)" (classic/all-time teams)
          weightMatch = text.match(/Weight:\s*(\d+)lbs/);
          if (weightMatch) {
            details.weight = `${weightMatch[1]} lbs`;
          }
        }

        // Extract wingspan - try both formats
        // Format 1: "wingspan of 7 feet" (current teams)
        let wingspanMatch = text.match(/wingspan.*?(\d+)\s*feet(?:\s*(\d+)\s*inches)?/);
        if (wingspanMatch) {
          const feet = wingspanMatch[1];
          const inches = wingspanMatch[2] || '0';
          details.wingspan = `${feet}'${inches}"`;
        } else {
          // Format 2: "Wingspan: 6'10" (208cm)" (classic/all-time teams)
          wingspanMatch = text.match(/Wingspan:\s*(\d+)'(\d+)"/);
          if (wingspanMatch) {
            details.wingspan = `${wingspanMatch[1]}'${wingspanMatch[2]}"`;
          }
        }

        // Extract archetype (e.g., "Archetype: Speedy Blow-By Ace")
        if (text.includes('Archetype:')) {
          const archetypeMatch = text.match(/Archetype:\s*(.+?)(?:\n|$)/);
          if (archetypeMatch) {
            details.archetype = archetypeMatch[1].trim();
          }
        }

        // Extract build (e.g., "has a Crafty Sharpshooter Build")
        if (!details.archetype && text.includes('Build')) {
          const buildMatch = text.match(/has a (.+?)\s+Build/);
          if (buildMatch) {
            details.archetype = buildMatch[1].trim();
          }
        }

        // Extract position from paragraph (e.g., "Position: SF / SG")
        if (text.includes('Position:')) {
          const positionMatch = text.match(/Position:\s*(.+)/);
          if (positionMatch) {
            const positionStr = positionMatch[1].trim();
            // Parse into array for filtering: "SF / SG" -> ["SF", "SG"]
            details.positions = positionStr.split('/').map(p => p.trim());
          }
        }
      }

      // Extract player image - try multiple selectors for different page layouts
      let playerImgEl = document.querySelector('a[data-lightbox="player"] img');
      if (!playerImgEl) {
        // Classic/all-time teams use a different structure
        playerImgEl = document.querySelector('.profile-photo-bg img');
      }
      if (!playerImgEl) {
        // Fallback: find image with alt containing "NBA 2K"
        playerImgEl = document.querySelector('img[alt*="NBA 2K"]');
      }
      if (playerImgEl) {
        details.playerImage = playerImgEl.dataset.src || playerImgEl.src || '';
      }

      // Extract all attributes from list items
      const attributes = {};
      const attributeListItems = document.querySelectorAll('li.mb-1');

      for (const li of attributeListItems) {
        const span = li.querySelector('.attribute-box');
        if (!span) continue;

        const value = parseInt(span.textContent.trim());
        if (isNaN(value)) continue;

        // Get attribute name (text after the span)
        let attributeName = li.textContent.replace(span.textContent, '').trim();
        // Remove trailing whitespace and help icons
        attributeName = attributeName.split('\n')[0].trim();

        // Convert attribute name to camelCase key
        const key = attributeName
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
          .replace(/^(.)/, (_, c) => c.toLowerCase())
          .replace(/-/g, '')
          .replace(/^\d+/, ''); // Remove leading digits

        // Normalize attribute names to match application expectations
        const attributeNameMap = {
          'layup': 'drivingLayup',
          'overallDurability': 'durability',
        };

        const normalizedKey = attributeNameMap[key] || key;

        if (normalizedKey && normalizedKey.length > 1) {
          attributes[normalizedKey] = value;
        }
      }

      details.attributes = attributes;

      // Extract badges
      const badges = {};
      const badgeElements = document.querySelectorAll('.badge-count');

      badgeElements.forEach(el => {
        const title = el.getAttribute('data-original-title') || '';
        const value = parseInt(el.textContent.trim()) || 0;

        if (title.includes('Total')) badges.total = value;
        else if (title.includes('Legendary')) badges.legendary = value;
        else if (title.includes('Hall of Fame')) badges.hallOfFame = value;
        else if (title.includes('Gold')) badges.gold = value;
        else if (title.includes('Silver')) badges.silver = value;
        else if (title.includes('Bronze')) badges.bronze = value;
      });

      // Extract individual badge details with image URLs.
      // 2kratings renders each badge card twice (desktop + mobile layouts share
      // the same .badge-card class), so de-dupe on name+tier to avoid storing
      // every badge twice.
      const badgeList = [];
      const seenBadgeKeys = new Set();
      const badgeCards = document.querySelectorAll('.badge-card');

      for (const card of badgeCards) {
        const nameEl = card.querySelector('h4.text-white');
        const categoryEl = card.querySelector('.badge-pill');
        const imgEl = card.querySelector('img[data-src*="badge"], img[src*="badge"]');
        const descEl = card.querySelector('.badge-description, p.description, [class*="desc"]');

        if (nameEl && imgEl) {
          const name = nameEl.textContent.trim();
          const category = categoryEl ? categoryEl.textContent.trim() : '';
          const imgSrc = imgEl.getAttribute('data-src') || imgEl.src || '';
          const description = descEl ? descEl.textContent.trim() : '';

          // Extract tier from image filename
          let tier = '';
          if (imgSrc.includes('-legendary-badge.png')) tier = 'Legendary';
          else if (imgSrc.includes('-hof-badge.png')) tier = 'Hall of Fame';
          else if (imgSrc.includes('-gold-badge.png')) tier = 'Gold';
          else if (imgSrc.includes('-silver-badge.png')) tier = 'Silver';
          else if (imgSrc.includes('-bronze-badge.png')) tier = 'Bronze';

          if (name && tier) {
            const badgeKey = `${name.toLowerCase().trim()}|${tier.toLowerCase().trim()}`;
            if (seenBadgeKeys.has(badgeKey)) {
              continue; // Skip duplicate card (desktop/mobile render the same badge)
            }
            seenBadgeKeys.add(badgeKey);

            const badgeData = { name, tier, category };
            // Include image URL if it's a full URL (not relative)
            if (imgSrc.startsWith('http')) {
              badgeData.imageUrl = imgSrc;
            }
            if (description) {
              badgeData.description = description;
            }
            badgeList.push(badgeData);
          }
        }
      }

      if (badgeList.length > 0) {
        badges.list = badgeList;
      }

      details.badges = badges;

      // ========================================
      // NEW: Extract Hot Zones (shooting zones)
      // ========================================
      const hotZones = {};

      // Hot zones are typically displayed as a court diagram with colored zones
      // Look for elements with hot zone indicators (red=hot, blue=cold, gray=neutral)
      const zoneElements = document.querySelectorAll('[class*="hot-zone"], [class*="zone"], .court-zone, [data-zone]');

      for (const zone of zoneElements) {
        const className = zone.className || '';
        const dataZone = zone.getAttribute('data-zone') || '';
        const title = zone.getAttribute('title') || zone.getAttribute('data-original-title') || '';

        // Determine zone location from class name or data attribute
        let location = dataZone.toLowerCase();
        if (!location) {
          // Try to infer from class name
          if (className.includes('corner') && className.includes('left')) location = 'leftCornerThree';
          else if (className.includes('corner') && className.includes('right')) location = 'rightCornerThree';
          else if (className.includes('wing') && className.includes('left')) location = 'leftWingThree';
          else if (className.includes('wing') && className.includes('right')) location = 'rightWingThree';
          else if (className.includes('top') && className.includes('three')) location = 'topKeyThree';
          else if (className.includes('elbow') && className.includes('left')) location = 'leftElbow';
          else if (className.includes('elbow') && className.includes('right')) location = 'rightElbow';
          else if (className.includes('top') && className.includes('key')) location = 'topKey';
          else if (className.includes('baseline') && className.includes('left')) location = 'leftBaseline';
          else if (className.includes('baseline') && className.includes('right')) location = 'rightBaseline';
          else if (className.includes('paint') || className.includes('restricted')) location = 'paint';
          else if (className.includes('under') || className.includes('basket')) location = 'underBasket';
        }

        // Determine zone status (hot/cold/neutral)
        let status = 'neutral';
        if (className.includes('hot') || className.includes('red') || title.toLowerCase().includes('hot')) {
          status = 'hot';
        } else if (className.includes('cold') || className.includes('blue') || title.toLowerCase().includes('cold')) {
          status = 'cold';
        }

        if (location) {
          hotZones[location] = status;
        }
      }

      // Alternative: Look for hot zone table or list
      const hotZoneRows = document.querySelectorAll('.hot-zones tr, [class*="shooting-zone"]');
      for (const row of hotZoneRows) {
        const cells = row.querySelectorAll('td, span');
        if (cells.length >= 2) {
          const zoneName = cells[0]?.textContent?.trim();
          const zoneStatus = cells[1]?.textContent?.trim()?.toLowerCase();

          // Map zone names to our standard keys
          const zoneMap = {
            'left corner 3': 'leftCornerThree',
            'right corner 3': 'rightCornerThree',
            'left wing 3': 'leftWingThree',
            'right wing 3': 'rightWingThree',
            'top of the key 3': 'topKeyThree',
            'left elbow': 'leftElbow',
            'right elbow': 'rightElbow',
            'top of the key': 'topKey',
            'left baseline': 'leftBaseline',
            'right baseline': 'rightBaseline',
            'paint': 'paint',
            'under basket': 'underBasket',
          };

          const key = zoneMap[zoneName?.toLowerCase()] || zoneName?.toLowerCase().replace(/\s+/g, '');
          if (key && zoneStatus) {
            hotZones[key] = zoneStatus.includes('hot') ? 'hot' : zoneStatus.includes('cold') ? 'cold' : 'neutral';
          }
        }
      }

      if (Object.keys(hotZones).length > 0) {
        details.hotZones = hotZones;
      }

      // ========================================
      // NEW: Extract Cross-Version Rating History
      // ========================================
      const ratingHistory = [];

      // Look for rating history table or list showing previous 2K ratings
      const historyTables = document.querySelectorAll('.rating-history, [class*="version-history"], table');
      for (const table of historyTables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          for (let i = 0; i < cells.length; i++) {
            const cellText = cells[i]?.textContent?.trim();

            // Look for 2K version patterns like "2K26", "2K25", etc.
            const versionMatch = cellText?.match(/2K(\d{2})/);
            if (versionMatch) {
              // Next cell or same row might have the rating
              const ratingCell = cells[i + 1] || cells[i];
              const ratingText = ratingCell?.textContent?.trim();
              const ratingMatch = ratingText?.match(/(\d{2})/);

              if (ratingMatch) {
                const rating = parseInt(ratingMatch[1]);
                if (rating >= 40 && rating <= 99) {
                  ratingHistory.push({
                    gameVersion: `2K${versionMatch[1]}`,
                    overall: rating,
                  });
                }
              }
            }
          }
        }
      }

      // Alternative: Look for links or spans with version info
      const versionLinks = document.querySelectorAll('a[href*="2k2"], a[href*="2k-"], span[class*="version"]');
      for (const link of versionLinks) {
        const text = link.textContent?.trim();
        const versionMatch = text?.match(/2K(\d{2})/);
        const ratingMatch = text?.match(/\((\d{2})\)/) || link.parentElement?.textContent?.match(/(\d{2})\s*OVR/);

        if (versionMatch && ratingMatch) {
          ratingHistory.push({
            gameVersion: `2K${versionMatch[1]}`,
            overall: parseInt(ratingMatch[1]),
          });
        }
      }

      // Deduplicate and sort by version (newest first)
      const seenVersions = new Set();
      details.ratingHistory = ratingHistory
        .filter(r => {
          if (seenVersions.has(r.gameVersion)) return false;
          seenVersions.add(r.gameVersion);
          return true;
        })
        .sort((a, b) => b.gameVersion.localeCompare(a.gameVersion));

      // Calculate deltas between versions
      for (let i = 0; i < details.ratingHistory.length - 1; i++) {
        details.ratingHistory[i].delta = details.ratingHistory[i].overall - details.ratingHistory[i + 1].overall;
      }

      return details;
    });

    // Merge with basic player data
    const enhancedPlayer = {
      ...basicPlayer,
      positions: playerDetails.positions,
      height: playerDetails.height,
      weight: playerDetails.weight,
      wingspan: playerDetails.wingspan,
      archetype: playerDetails.archetype,
      playerImage: playerDetails.playerImage,
      attributes: playerDetails.attributes,
      badges: playerDetails.badges,
      hotZones: playerDetails.hotZones,
      ratingHistory: playerDetails.ratingHistory,
      lastUpdated: new Date().toISOString()
    };

    return enhancedPlayer;

  } catch (error) {
    logError(`Failed to scrape detailed data for ${basicPlayer.name}: ${error.message}`);
    return enhanceBasicPlayer(basicPlayer);
  }
}

/**
 * Fallback when detailed scraping fails
 * @param {Object} basicPlayer - Basic player data
 * @returns {Object} Enhanced basic player with defaults
 */
function enhanceBasicPlayer(basicPlayer) {
  return {
    ...basicPlayer,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Scrape detailed player data for multiple players
 * @param {Page} page - Playwright page instance
 * @param {Array} basicPlayers - Array of basic player objects
 * @param {number} concurrency - Number of players to scrape concurrently (default: 1)
 * @returns {Promise<Array>} Array of enhanced player objects
 */
export async function scrapePlayersDetails(page, basicPlayers, concurrency = 1) {
  const enhancedPlayers = [];
  const total = basicPlayers.length;

  for (let i = 0; i < total; i++) {
    const player = basicPlayers[i];

    // Log progress every 10 players
    if ((i + 1) % 10 === 0) {
      logProgress(`Processing player ${i + 1}/${total}: ${player.name}`);
    }

    const enhancedPlayer = await scrapePlayerDetails(page, player);
    enhancedPlayers.push(enhancedPlayer);

    // Add delay between players to avoid rate limiting
    if (i < total - 1) {
      await delay(SCRAPER_OPTIONS.delayBetweenPlayers);
    }
  }

  return enhancedPlayers;
}
