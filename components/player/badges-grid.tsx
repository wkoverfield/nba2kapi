"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fadeIn, staggerContainer, staggerItem } from "@/lib/animations";
import type { Player, PlayerBadges } from "@/types/player";

export interface BadgesGridProps {
  player: Player;
  className?: string;
}

/**
 * Badge tier colors following NBA 2K MyTeam style (matching Blacktop Blitz)
 */
const TIER_COLORS = {
  HOF: {
    bg: "badge-amethyst",
    text: "text-white",
    border: "border-purple-600",
    label: "Hall of Fame",
  },
  Gold: {
    bg: "badge-gold",
    text: "text-white",
    border: "border-yellow-600",
    label: "Gold",
  },
  Silver: {
    bg: "badge-silver",
    text: "text-white",
    border: "border-slate-500",
    label: "Silver",
  },
  Bronze: {
    bg: "bg-[#c90]",
    text: "text-white",
    border: "border-[#c90]",
    label: "Bronze",
  },
} as const;

type BadgeTier = keyof typeof TIER_COLORS;

/**
 * Group badges by category (prevents duplication by only using badges.list)
 */
type OrganizedBadge = { name: string; tier: string; imageUrl?: string };

function organizeBadges(badges: PlayerBadges) {
  const organized: Record<string, Array<OrganizedBadge>> = {};
  const seenBadges = new Set<string>(); // Track unique badge name+tier to prevent duplicates

  // Only use the list property to prevent duplication
  if (badges.list && Array.isArray(badges.list)) {
    badges.list.forEach((badge) => {
      // Skip if we've already seen this exact badge name+tier (case-insensitive).
      // The scraper can emit each badge twice (2kratings renders a desktop +
      // mobile card for the same badge), so de-dupe on name+tier here.
      const badgeKey = `${badge.name.toLowerCase().trim()}|${badge.tier.toLowerCase().trim()}`;
      if (seenBadges.has(badgeKey)) {
        return; // Skip duplicate
      }
      seenBadges.add(badgeKey);

      const category = badge.category || "Uncategorized";
      if (!organized[category]) {
        organized[category] = [];
      }
      organized[category].push({
        name: badge.name,
        tier: badge.tier,
        imageUrl: badge.imageUrl,
      });
    });
  }

  return organized;
}

/**
 * Get badge count by tier
 */
function getBadgeCountByTier(badges: PlayerBadges, tier: BadgeTier): number {
  return Object.values(organizeBadges(badges))
    .flat()
    .filter((b) => {
      const badgeTier = b.tier.toUpperCase();
      const selected = tier.toUpperCase();

      // Handle "Hall of Fame" vs "HOF"
      if (selected === "HOF" && (badgeTier === "HOF" || badgeTier === "HALL OF FAME")) {
        return true;
      }

      return badgeTier === selected;
    }).length;
}

export function BadgesGrid({ player, className }: BadgesGridProps) {
  const [selectedTier, setSelectedTier] = React.useState<BadgeTier | "All">("All");

  const organizedBadges = React.useMemo(() => {
    if (!player.badges) return {};
    return organizeBadges(player.badges);
  }, [player.badges]);

  const categories = Object.keys(organizedBadges);

  if (categories.length === 0) {
    return null;
  }

  // Filter badges by selected tier
  const filteredBadges = React.useMemo(() => {
    if (selectedTier === "All") return organizedBadges;

    const filtered: Record<string, Array<OrganizedBadge>> = {};
    Object.entries(organizedBadges).forEach(([category, badgesList]) => {
      const tierBadges = badgesList.filter((b) => {
        // Case-insensitive comparison and handle variations
        const badgeTier = b.tier.toUpperCase();
        const selected = selectedTier.toUpperCase();

        // Handle "Hall of Fame" vs "HOF"
        if (selected === "HOF" && (badgeTier === "HOF" || badgeTier === "HALL OF FAME")) {
          return true;
        }

        return badgeTier === selected;
      });
      if (tierBadges.length > 0) {
        filtered[category] = tierBadges;
      }
    });
    return filtered;
  }, [organizedBadges, selectedTier]);

  // Calculate tier counts
  const tierCounts = React.useMemo(() => ({
    HOF: getBadgeCountByTier(player.badges!, "HOF"),
    Gold: getBadgeCountByTier(player.badges!, "Gold"),
    Silver: getBadgeCountByTier(player.badges!, "Silver"),
    Bronze: getBadgeCountByTier(player.badges!, "Bronze"),
  }), [player.badges]);

  const totalBadges = Object.values(tierCounts).reduce((sum, count) => sum + count, 0);

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className={cn(className)}
    >
      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>

          {/* Tier Filter Buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={selectedTier === "All" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTier("All")}
              className="font-semibold"
            >
              All
              <span className="ml-1.5 opacity-70">({totalBadges})</span>
            </Button>

            {(Object.keys(TIER_COLORS) as BadgeTier[]).map((tier) => {
              const count = tierCounts[tier];
              if (count === 0) return null;

              const colors = TIER_COLORS[tier];
              const isSelected = selectedTier === tier;

              return (
                <Button
                  key={tier}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedTier(tier)}
                  className={cn(
                    "font-semibold transition-all border-2",
                    isSelected
                      ? tier === "Bronze"
                        ? "!bg-[#c90] !text-white !border-[#c90]"
                        : cn(colors.bg, colors.text, colors.border, "border-current")
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  {colors.label}
                  <span className="ml-1.5 opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent>
          {Object.keys(filteredBadges).length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No {selectedTier !== "All" ? TIER_COLORS[selectedTier as BadgeTier].label : ""} badges
            </p>
          ) : (
            <div className="space-y-8">
              {Object.entries(filteredBadges).map(([category, badges]) => (
                <motion.div
                  key={`${selectedTier}-${category}`}
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="space-y-3"
                >
                  {/* Category Header */}
                  <h3 className="text-lg font-semibold tracking-tight">
                    {category}
                  </h3>

                  {/* Badges in this category */}
                  <motion.div
                    className="flex flex-wrap gap-2"
                    variants={staggerContainer}
                  >
                    {badges.map((badge, index) => {
                      // Normalize tier name for lookup
                      let tierKey: BadgeTier;
                      const tierUpper = badge.tier.toUpperCase();

                      if (tierUpper === "HOF" || tierUpper === "HALL OF FAME") {
                        tierKey = "HOF";
                      } else if (tierUpper === "GOLD") {
                        tierKey = "Gold";
                      } else if (tierUpper === "SILVER") {
                        tierKey = "Silver";
                      } else {
                        tierKey = "Bronze";
                      }

                      const tierColors = TIER_COLORS[tierKey];

                      return (
                        <motion.div key={`${badge.name}-${index}`} variants={staggerItem}>
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1.5 border transition-all duration-150 hover:scale-105",
                              tierColors.bg,
                              tierColors.text,
                              tierColors.border
                            )}
                          >
                            {badge.imageUrl ? (
                              // NOT `unoptimized`: 2kratings hot-link-protects its
                              // images against third-party referers, so a direct
                              // browser fetch 403s (badges rendered as broken icons
                              // in prod). Routing through Next's image optimizer —
                              // same as the player photo — proxies the fetch
                              // server-side (no browser referer) so it loads. The
                              // 2kratings host is allowlisted in next.config.ts.
                              <Image
                                src={badge.imageUrl}
                                alt={`${badge.name} ${badge.tier} badge`}
                                width={20}
                                height={20}
                                className="h-5 w-5 shrink-0 object-contain"
                              />
                            ) : null}
                            <span className="font-semibold">{badge.name}</span>
                            <span className="ml-1 opacity-70">· {badge.tier}</span>
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
