/**
 * NBA 2K Card Tier System (Based on MyTeam Card Rarities)
 * Matches Blacktop Blitz card tier colors
 */

export const RATING_COLORS = {
  DARK_MATTER: "#000", // 99 - Dark Matter (black base)
  GALAXY_OPAL: "#f9a205", // 97-98 - Galaxy Opal (gold accent)
  PINK_DIAMOND: "#ff96df", // 95-96 - Pink Diamond
  DIAMOND: "#00aace", // 92-94 - Diamond (cyan)
  AMETHYST: "#a51fff", // 90-91 - Amethyst (purple)
  RUBY: "#e70000", // 87-89 - Ruby (red)
  SAPPHIRE: "#0020ce", // 84-86 - Sapphire (blue)
  EMERALD: "#05c715", // 80-83 - Emerald (green)
  GOLD: "#d6bb5c", // 75-79 - Gold
  SILVER: "#a2a2a2", // 70-74 - Silver
  BRONZE: "#c90", // <70 - Bronze (orange)
} as const;

export const RATING_TIERS = {
  DARK_MATTER: "Dark Matter",
  GALAXY_OPAL: "Galaxy Opal",
  PINK_DIAMOND: "Pink Diamond",
  DIAMOND: "Diamond",
  AMETHYST: "Amethyst",
  RUBY: "Ruby",
  SAPPHIRE: "Sapphire",
  EMERALD: "Emerald",
  GOLD: "Gold",
  SILVER: "Silver",
  BRONZE: "Bronze",
} as const;

export type RatingTier = keyof typeof RATING_TIERS;

/**
 * Get the primary color for a rating value
 * @param rating - Rating value (0-100)
 * @returns Hex color code
 */
export function getRatingColor(rating: number): string {
  if (rating >= 99) return RATING_COLORS.DARK_MATTER;
  if (rating >= 97) return RATING_COLORS.GALAXY_OPAL;
  if (rating >= 95) return RATING_COLORS.PINK_DIAMOND;
  if (rating >= 92) return RATING_COLORS.DIAMOND;
  if (rating >= 90) return RATING_COLORS.AMETHYST;
  if (rating >= 87) return RATING_COLORS.RUBY;
  if (rating >= 84) return RATING_COLORS.SAPPHIRE;
  if (rating >= 80) return RATING_COLORS.EMERALD;
  if (rating >= 75) return RATING_COLORS.GOLD;
  if (rating >= 70) return RATING_COLORS.SILVER;
  return RATING_COLORS.BRONZE;
}

/**
 * Get the tier name for a rating value
 * @param rating - Rating value (0-100)
 * @returns Tier name (Dark Matter, Galaxy Opal, etc.)
 */
export function getRatingTier(rating: number): string {
  if (rating >= 99) return RATING_TIERS.DARK_MATTER;
  if (rating >= 97) return RATING_TIERS.GALAXY_OPAL;
  if (rating >= 95) return RATING_TIERS.PINK_DIAMOND;
  if (rating >= 92) return RATING_TIERS.DIAMOND;
  if (rating >= 90) return RATING_TIERS.AMETHYST;
  if (rating >= 87) return RATING_TIERS.RUBY;
  if (rating >= 84) return RATING_TIERS.SAPPHIRE;
  if (rating >= 80) return RATING_TIERS.EMERALD;
  if (rating >= 75) return RATING_TIERS.GOLD;
  if (rating >= 70) return RATING_TIERS.SILVER;
  return RATING_TIERS.BRONZE;
}

/**
 * Get the tier key for a rating value
 * @param rating - Rating value (0-100)
 * @returns Tier key (DARK_MATTER, GALAXY_OPAL, etc.)
 */
export function getRatingTierKey(rating: number): RatingTier {
  if (rating >= 99) return "DARK_MATTER";
  if (rating >= 97) return "GALAXY_OPAL";
  if (rating >= 95) return "PINK_DIAMOND";
  if (rating >= 92) return "DIAMOND";
  if (rating >= 90) return "AMETHYST";
  if (rating >= 87) return "RUBY";
  if (rating >= 84) return "SAPPHIRE";
  if (rating >= 80) return "EMERALD";
  if (rating >= 75) return "GOLD";
  if (rating >= 70) return "SILVER";
  return "BRONZE";
}

/**
 * Attribute Color Scale (for individual attributes - NOT overall ratings)
 * Keeps original green-to-red scale for attribute bars
 */
export const ATTRIBUTE_COLORS = {
  HIGHEST: "var(--attr-highest)", // 90-99 - Elite (bright green)
  HIGH: "var(--attr-high)", // 80-89 - Very Good (green)
  MEDIUM: "var(--attr-medium)", // 70-79 - Average (orange)
  LOW: "var(--attr-low)", // 60-69 - Below Average (dark orange)
  LOWEST: "var(--attr-lowest)", // 0-59 - Poor (dark red)
} as const;

/**
 * Get the color for an attribute value (uses green-red scale, NOT card tiers)
 * @param rating - Attribute value (0-100)
 * @returns Hex color code
 */
export function getAttributeColor(rating: number): string {
  if (rating >= 90) return ATTRIBUTE_COLORS.HIGHEST;
  if (rating >= 80) return ATTRIBUTE_COLORS.HIGH;
  if (rating >= 70) return ATTRIBUTE_COLORS.MEDIUM;
  if (rating >= 60) return ATTRIBUTE_COLORS.LOW;
  return ATTRIBUTE_COLORS.LOWEST;
}

/**
 * Get Tailwind CSS classes for rating badge styling
 * @param rating - Rating value (0-100)
 * @returns Object with bg, text, border, and shadow color classes
 */
export function getRatingClasses(rating: number) {
  const tier = getRatingTierKey(rating);

  const classes = {
    DARK_MATTER: {
      bg: "overall-dark-matter",
      text: "text-white",
      border: "border-purple-900",
      shadow: "",
    },
    GALAXY_OPAL: {
      bg: "overall-galaxy-opal",
      text: "text-white",
      border: "border-amber-500",
      shadow: "shadow-[0_0_10px_#f9a205]",
    },
    PINK_DIAMOND: {
      bg: "overall-pink-diamond",
      text: "text-white",
      border: "border-pink-400",
      shadow: "shadow-[0_0_10px_#ff96df]",
    },
    DIAMOND: {
      bg: "overall-diamond",
      text: "text-white",
      border: "border-cyan-600",
      shadow: "",
    },
    AMETHYST: {
      bg: "overall-amethyst",
      text: "text-white",
      border: "border-purple-600",
      shadow: "",
    },
    RUBY: {
      bg: "overall-ruby",
      text: "text-white",
      border: "border-red-700",
      shadow: "",
    },
    SAPPHIRE: {
      bg: "overall-sapphire",
      text: "text-white",
      border: "border-blue-800",
      shadow: "",
    },
    EMERALD: {
      bg: "overall-emerald",
      text: "text-white",
      border: "border-green-700",
      shadow: "",
    },
    GOLD: {
      bg: "overall-gold",
      text: "text-white",
      border: "border-yellow-600",
      shadow: "",
    },
    SILVER: {
      bg: "overall-silver",
      text: "text-white",
      border: "border-slate-500",
      shadow: "",
    },
    BRONZE: {
      bg: "bg-[#c90]",
      text: "text-white",
      border: "border-orange-600",
      shadow: "",
    },
  };

  return classes[tier];
}
