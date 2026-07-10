/**
 * Attribute categories for proper grouping.
 * Lives in convex/ so both Convex functions and app code can import it
 * (Convex functions cannot import from outside the convex directory).
 */
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
