/**
 * Import an archived roster dataset into the rosterArchive table.
 *
 *   CONVEX_URL=https://<deployment>.convex.cloud ADMIN_API_KEY=<key> \
 *     node scripts/import-roster-archive.mjs data/roster-archive/2K26.json \
 *       --version 2K26 --source blacktop-sync-2026-08-08 \
 *       --captured-at 2026-08-08T06:51:10Z [--label "NBA 2K26"] [--note "..."]
 *
 * Reads a JSON array of players, strips fields the archive does not store
 * (Blacktop `cats`), upserts them in batches of 200 through
 * rosterArchive.adminImportBatch, then calls rosterArchive.finalizeVersion so
 * /api/versions lists the edition. Rerunning is safe: rows are keyed on
 * (gameVersion, teamType, slug).
 *
 * CONVEX_URL is required and has no default: point it at dev or prod on
 * purpose. It must be the .convex.cloud URL (ConvexHttpClient), not .convex.site.
 */

import fs from "fs";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const BATCH_SIZE = 200;
const DROPPED_FIELDS = ["cats"];
const VERSION_PATTERN = /^2K\d{2}$/;

function usage(message) {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    "Usage: CONVEX_URL=https://<deployment>.convex.cloud ADMIN_API_KEY=<key> \\\n" +
      "  node scripts/import-roster-archive.mjs <file.json> --version 2K26 \\\n" +
      "    --source <source> --captured-at <ISO timestamp> [--label \"NBA 2K26\"] [--note \"...\"]"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) usage(`--${key} needs a value`);
      flags[key] = value;
      i++;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  const convexUrl = process.env.CONVEX_URL;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!convexUrl) usage("CONVEX_URL is not set. Pass the target deployment explicitly; there is no default.");
  if (!/^https:\/\/[a-z0-9-]+\.convex\.cloud\/?$/.test(convexUrl)) {
    usage(`CONVEX_URL must be a .convex.cloud URL (got ${convexUrl})`);
  }
  if (!adminKey) usage("ADMIN_API_KEY is not set");

  const file = positional[0];
  if (!file) usage("missing dataset file");
  if (!fs.existsSync(file)) usage(`file not found: ${file}`);

  const gameVersion = (flags.version || "").toUpperCase();
  if (!VERSION_PATTERN.test(gameVersion)) usage("--version must look like 2K26");
  const source = flags.source;
  if (!source) usage("--source is required (e.g. blacktop-sync-2026-08-08)");
  const capturedAt = flags["captured-at"];
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) {
    usage("--captured-at must be an ISO timestamp (e.g. 2026-08-08T06:51:10Z)");
  }
  const label = flags.label;
  const note = flags.note;

  const dataset = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(dataset)) usage(`${file} must contain a JSON array of players`);

  const players = dataset.map((player) => {
    const copy = { ...player };
    for (const field of DROPPED_FIELDS) delete copy[field];
    return copy;
  });

  console.log(
    `Importing ${players.length} players from ${path.basename(file)} as ${gameVersion} ` +
      `(source ${source}, captured ${capturedAt}) into ${convexUrl}`
  );

  const client = new ConvexHttpClient(convexUrl);
  let inserted = 0;
  let updated = 0;
  for (let start = 0; start < players.length; start += BATCH_SIZE) {
    const batch = players.slice(start, start + BATCH_SIZE);
    const result = await client.mutation(api.rosterArchive.adminImportBatch, {
      adminKey,
      gameVersion,
      source,
      capturedAt,
      players: batch,
    });
    inserted += result.inserted;
    updated += result.updated;
    console.log(
      `  batch ${Math.floor(start / BATCH_SIZE) + 1}/${Math.ceil(players.length / BATCH_SIZE)}: ` +
        `${result.inserted} inserted, ${result.updated} updated`
    );
  }

  const finalizeArgs = { adminKey, gameVersion };
  if (label !== undefined) finalizeArgs.label = label;
  if (note !== undefined) finalizeArgs.note = note;
  const version = await client.mutation(api.rosterArchive.finalizeVersion, finalizeArgs);

  console.log(`\nDone: ${inserted} inserted, ${updated} updated`);
  console.log(
    `${version.gameVersion} (${version.label}): ${version.playerCount} players ` +
      `(curr ${version.teamTypeCounts.curr}, class ${version.teamTypeCounts.class}, allt ${version.teamTypeCounts.allt})`
  );
}

main().catch((error) => {
  console.error("Import failed:", error.message || error);
  if (error.data) console.error(JSON.stringify(error.data, null, 2));
  process.exit(1);
});
