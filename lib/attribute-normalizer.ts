/**
 * Centralized Player Attribute Normalization
 *
 * This module handles normalization of player attributes from various sources
 * to ensure consistent naming and categorization throughout the application.
 */

/**
 * Maps scraped attribute names to standardized application names
 */
export const ATTRIBUTE_NAME_MAP: Record<string, string> = {
  // Critical mappings for mismatched names
  layup: "drivingLayup",
  overallDurability: "durability",

  // Pass-through mappings (already correct but listed for completeness)
  closeShot: "closeShot",
  drivingLayup: "drivingLayup",
  drivingDunk: "drivingDunk",
  standingDunk: "standingDunk",
  postHook: "postHook",
  postFade: "postFade",
  postControl: "postControl",
  midRangeShot: "midRangeShot",
  threePointShot: "threePointShot",
  freeThrow: "freeThrow",
  shotIQ: "shotIQ",
  offensiveConsistency: "offensiveConsistency",
  drawFoul: "drawFoul",
  hands: "hands",

  passAccuracy: "passAccuracy",
  ballHandle: "ballHandle",
  speedWithBall: "speedWithBall",
  passIQ: "passIQ",
  passVision: "passVision",
  passPerception: "passPerception",

  interiorDefense: "interiorDefense",
  perimeterDefense: "perimeterDefense",
  steal: "steal",
  block: "block",
  defensiveConsistency: "defensiveConsistency",
  defensiveRebound: "defensiveRebound",
  lateralQuickness: "lateralQuickness",
  helpDefenseIQ: "helpDefenseIQ",

  speed: "speed",
  acceleration: "acceleration",
  agility: "agility",
  vertical: "vertical",
  strength: "strength",
  stamina: "stamina",
  hustle: "hustle",
  durability: "durability",

  offensiveRebound: "offensiveRebound",
  passing: "passing",
  postMoves: "postMoves",
};

import { ATTRIBUTE_CATEGORIES } from "@/convex/attributeCategories";
export { ATTRIBUTE_CATEGORIES };

/**
 * Human-readable attribute name formatting
 */
export const ATTRIBUTE_DISPLAY_NAMES: Record<string, string> = {
  closeShot: "Close Shot",
  drivingLayup: "Driving Layup",
  drivingDunk: "Driving Dunk",
  standingDunk: "Standing Dunk",
  postHook: "Post Hook",
  postFade: "Post Fade",
  postControl: "Post Control",
  midRangeShot: "Mid-Range Shot",
  threePointShot: "Three-Point Shot",
  freeThrow: "Free Throw",
  shotIQ: "Shot IQ",
  offensiveConsistency: "Offensive Consistency",
  drawFoul: "Draw Foul",
  hands: "Hands",

  passAccuracy: "Pass Accuracy",
  ballHandle: "Ball Handle",
  speedWithBall: "Speed With Ball",
  passIQ: "Pass IQ",
  passVision: "Pass Vision",
  passing: "Passing",
  postMoves: "Post Moves",
  passPerception: "Pass Perception",

  interiorDefense: "Interior Defense",
  perimeterDefense: "Perimeter Defense",
  steal: "Steal",
  block: "Block",
  defensiveConsistency: "Defensive Consistency",
  defensiveRebound: "Defensive Rebound",
  lateralQuickness: "Lateral Quickness",
  helpDefenseIQ: "Help Defense IQ",

  speed: "Speed",
  acceleration: "Acceleration",
  agility: "Agility",
  vertical: "Vertical",
  strength: "Strength",
  stamina: "Stamina",
  hustle: "Hustle",
  durability: "Durability",

  offensiveRebound: "Offensive Rebound",
};

/**
 * Normalizes a single attribute name from scraped data to standard format
 */
export function normalizeAttributeName(name: string): string {
  // First check direct mapping
  if (ATTRIBUTE_NAME_MAP[name]) {
    return ATTRIBUTE_NAME_MAP[name];
  }

  // Handle PascalCase -> camelCase conversion
  // E.g., "DefensiveRebound" -> "defensiveRebound"
  if (name && name[0] === name[0].toUpperCase()) {
    const camelCase = name[0].toLowerCase() + name.slice(1);
    // Check if the camelCase version exists in our map
    return ATTRIBUTE_NAME_MAP[camelCase] || camelCase;
  }

  return name;
}

/**
 * Normalizes an entire attributes object
 */
export function normalizeAttributes(attributes: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const normalizedKey = normalizeAttributeName(key);
    normalized[normalizedKey] = value;
  }

  return normalized;
}

/**
 * Gets the category for an attribute name (after normalization)
 */
export function getAttributeCategory(attributeName: string): string {
  const normalizedName = normalizeAttributeName(attributeName);

  for (const [category, attributes] of Object.entries(ATTRIBUTE_CATEGORIES)) {
    if ((attributes as readonly string[]).includes(normalizedName)) {
      return category;
    }
  }

  return "other";
}

/**
 * Gets the display name for an attribute (after normalization)
 */
export function getAttributeDisplayName(attributeName: string): string {
  const normalizedName = normalizeAttributeName(attributeName);
  return ATTRIBUTE_DISPLAY_NAMES[normalizedName] || formatAttributeName(normalizedName);
}

/**
 * Formats an attribute name to human-readable format (fallback)
 * Converts camelCase to Title Case with spaces
 */
function formatAttributeName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Validates that an attribute name is recognized
 */
export function isValidAttribute(name: string): boolean {
  const normalizedName = normalizeAttributeName(name);
  return getAttributeCategory(normalizedName) !== "other";
}

/**
 * Gets all attributes that belong to a specific category
 */
export function getAttributesByCategory(category: keyof typeof ATTRIBUTE_CATEGORIES): readonly string[] {
  return ATTRIBUTE_CATEGORIES[category];
}

/**
 * Gets a list of all unmapped attributes from a dataset
 * Useful for debugging and identifying new attributes
 */
export function getUnmappedAttributes(attributes: Record<string, any>): string[] {
  const unmapped: string[] = [];

  for (const key of Object.keys(attributes)) {
    if (!isValidAttribute(key)) {
      unmapped.push(key);
    }
  }

  return unmapped;
}
