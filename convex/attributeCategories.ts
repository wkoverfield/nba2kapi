/**
 * Attribute categories for proper grouping.
 * Lives in convex/ so both Convex functions and app code can import it
 * (Convex functions cannot import from outside the convex directory).
 */
/**
 * Canonical category order. Percentile math and the precomputed
 * cohortStats.roster[].catScores arrays both index categories by this order,
 * so reordering this list invalidates stored cohortStats docs (rerun the
 * cohorts:rebuildAll backfill after changing it).
 */
export const CATEGORY_KEYS = [
  "outsideScoring",
  "insideScoring",
  "playmaking",
  "athleticism",
  "defending",
  "rebounding",
] as const;

/**
 * Mean of the attribute values present for the given keys, or null when none
 * are present. Used both at request time (the viewed player's own scores) and
 * at rebuild time (precomputed cohort arrays) - the two must stay the same
 * function so stored and live category scores are bit-identical floats.
 */
export function categoryScore(
  attrs: Record<string, number> | undefined,
  keys: readonly string[]
): number | null {
  if (!attrs) return null;
  const vals = keys.map((k) => attrs[k]).filter((n): n is number => typeof n === "number");
  if (!vals.length) return null;
  return vals.reduce((s, n) => s + n, 0) / vals.length;
}

export const ATTRIBUTE_CATEGORIES = {
  outsideScoring: [
    "closeShot",
    "midRangeShot",
    "threePointShot",
    "freeThrow",
    "shotIQ",
    "offensiveConsistency",
  ],
  insideScoring: [
    "drivingLayup",
    "standingDunk",
    "drivingDunk",
    "postHook",
    "postFade",
    "postControl",
    "drawFoul",
    "hands",
  ],
  playmaking: [
    "passAccuracy",
    "ballHandle",
    "speedWithBall",
    "passIQ",
    "passVision",
    "passing",
    "postMoves",
  ],
  athleticism: [
    "speed",
    "acceleration",
    "agility",
    "vertical",
    "strength",
    "stamina",
    "hustle",
    "durability",
  ],
  defending: [
    "interiorDefense",
    "perimeterDefense",
    "steal",
    "block",
    "helpDefenseIQ",
    "passPerception",
    "defensiveConsistency",
    "lateralQuickness",
  ],
  rebounding: [
    "offensiveRebound",
    "defensiveRebound",
  ],
} as const;
