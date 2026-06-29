#!/usr/bin/env bash
# Retry a single-teamType scrape up to N times.
#
# CI runs from a GitHub datacenter IP that Cloudflare blocks *flakily* — across
# back-to-back runs we've seen a full scrape (all teams), a partial block (some
# teams return 0 players), and a total block (0 players). Each attempt is an
# independent browser session that re-solves the challenge, so retrying turns a
# ~50%-per-attempt success rate into a high-probability clean run per job.
#
# runScraper.js exits non-zero on a 0-player OR partial scrape (any empty team),
# so a non-zero exit here means "incomplete — try again". A clean full scrape
# exits 0 and we stop. Inherits CONVEX_URL / ADMIN_API_KEY / RECONCILE_DRY_RUN
# from the environment.
set -u

TEAM_TYPE="${1:?usage: scrape-retry.sh <curr|class|allt>}"
MAX_ATTEMPTS="${SCRAPE_MAX_ATTEMPTS:-3}"
BACKOFF_SECONDS="${SCRAPE_RETRY_BACKOFF:-30}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if xvfb-run -a node scripts/runScraper.js "$TEAM_TYPE"; then
    echo "scrape($TEAM_TYPE) succeeded on attempt $attempt/$MAX_ATTEMPTS"
    exit 0
  fi
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    echo "::warning::scrape($TEAM_TYPE) attempt $attempt/$MAX_ATTEMPTS was blocked/partial; retrying in ${BACKOFF_SECONDS}s"
    sleep "$BACKOFF_SECONDS"
  fi
done

echo "::error::scrape($TEAM_TYPE) failed after $MAX_ATTEMPTS attempts (Cloudflare). Data not (fully) updated."
exit 1
