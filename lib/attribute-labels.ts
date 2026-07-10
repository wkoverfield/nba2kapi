/**
 * Compact column labels for the full-attribute tables, in category order.
 */

import { ATTRIBUTE_CATEGORIES } from "@/convex/attributeCategories";

export const ATTRIBUTE_SHORT_LABELS: Record<string, string> = {
  closeShot: "CLS",
  midRangeShot: "MID",
  threePointShot: "3PT",
  freeThrow: "FT",
  shotIQ: "SIQ",
  offensiveConsistency: "OCN",
  drivingLayup: "LAY",
  standingDunk: "SDK",
  drivingDunk: "DNK",
  postHook: "HK",
  postFade: "FD",
  postControl: "PST",
  drawFoul: "DRW",
  hands: "HND",
  passAccuracy: "PAC",
  ballHandle: "BH",
  speedWithBall: "SWB",
  passIQ: "PIQ",
  passVision: "VIS",
  passPerception: "PPR",
  passing: "PSS",
  postMoves: "PMV",
  interiorDefense: "ID",
  perimeterDefense: "PD",
  steal: "STL",
  block: "BLK",
  defensiveConsistency: "DCN",
  defensiveRebound: "DRB",
  lateralQuickness: "LAT",
  helpDefenseIQ: "HDQ",
  speed: "SPD",
  acceleration: "ACC",
  agility: "AGI",
  vertical: "VRT",
  strength: "STR",
  stamina: "STA",
  hustle: "HSL",
  durability: "DUR",
  offensiveRebound: "ORB",
};

/** All attribute keys in category order, with their category for group headers. */
export const ORDERED_ATTRIBUTES: { key: string; category: string }[] = (
  Object.entries(ATTRIBUTE_CATEGORIES) as [string, readonly string[]][]
).flatMap(([category, keys]) => keys.map((key) => ({ key, category })));

export const CATEGORY_SHORT_LABELS: Record<string, string> = {
  outsideScoring: "OUTSIDE",
  insideScoring: "INSIDE",
  playmaking: "PLAYMAKING",
  athleticism: "ATHLETICISM",
  defending: "DEFENDING",
  rebounding: "REB",
};
