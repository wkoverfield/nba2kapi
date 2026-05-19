/**
 * Verify data quality in Convex database
 * Checks that height, weight, wingspan, playerImage, and badges are properly populated
 */

import { ConvexHttpClient } from "convex/browser";

// IMPORTANT: Uses ConvexHttpClient which requires .convex.cloud domain
const CONVEX_URL = process.env.CONVEX_URL || "https://canny-kingfisher-472.convex.cloud";

async function verifyData() {
  const client = new ConvexHttpClient(CONVEX_URL);

  console.log("\n🔍 Verifying Data Quality...\n");

  // Get a sample of current team players (should have images)
  const currentPlayers = await client.query("players:getPlayersByType", {
    teamType: "curr"
  });

  // Limit to 10 for display
  const samplePlayers = currentPlayers.slice(0, 10);

  console.log("📊 Sample Current Team Players:");
  console.log("─".repeat(80));

  let hasHeight = 0;
  let hasWeight = 0;
  let hasWingspan = 0;
  let hasPlayerImage = 0;
  let hasBadgeList = 0;

  for (const player of samplePlayers) {
    console.log(`\n${player.name} (${player.team}) - Overall: ${player.overall}`);
    console.log(`  Height: ${player.height || "❌ MISSING"}`);
    console.log(`  Weight: ${player.weight || "❌ MISSING"}`);
    console.log(`  Wingspan: ${player.wingspan || "❌ MISSING"}`);
    console.log(`  Player Image: ${player.playerImage ? "✅" : "❌ MISSING"}`);
    console.log(`  Badge Counts: ${player.badges?.total || 0} total`);
    console.log(`  Badge List: ${player.badges?.list?.length || 0} badges`);

    if (player.height) hasHeight++;
    if (player.weight) hasWeight++;
    if (player.wingspan) hasWingspan++;
    if (player.playerImage) hasPlayerImage++;
    if (player.badges?.list?.length > 0) hasBadgeList++;

    if (player.badges?.list?.length > 0) {
      console.log(`  Sample badges:`);
      player.badges.list.slice(0, 3).forEach(badge => {
        console.log(`    - ${badge.name} (${badge.tier}) [${badge.category || "N/A"}]`);
      });
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log("\n📈 Data Quality Summary (out of 10 sampled):");
  console.log(`  Height: ${hasHeight}/10`);
  console.log(`  Weight: ${hasWeight}/10`);
  console.log(`  Wingspan: ${hasWingspan}/10`);
  console.log(`  Player Image: ${hasPlayerImage}/10`);
  console.log(`  Badge Lists: ${hasBadgeList}/10`);

  // Get overall statistics
  const stats = await client.query("players:getStats", {});
  console.log("\n📊 Overall Database Statistics:");
  console.log(`  Total Players: ${stats.totalPlayers}`);
  console.log(`  Current Teams: ${stats.byType.curr}`);
  console.log(`  Classic Teams: ${stats.byType.class}`);
  console.log(`  All-Time Teams: ${stats.byType.allt}`);
  console.log(`  Unique Teams: ${stats.uniqueTeams}`);
  console.log(`  Average Overall: ${stats.avgOverall}`);

  client.close();
}

verifyData().catch(console.error);
