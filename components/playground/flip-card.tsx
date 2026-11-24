"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GameCard } from "@/components/ui/game-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getRatingClasses, getAttributeColor } from "@/lib/rating-colors";
import { User } from "lucide-react";
import type { Player } from "@/types/player";

interface FlipCardProps {
  player: Player;
  className?: string;
}

// Simple radar chart using CSS
function RadarChart({ data }: { data: Record<string, number> }) {
  const categories = [
    { key: "overall", label: "OVR", angle: 0 },
    { key: "insideScoring", label: "INS", angle: 51.4 },
    { key: "outsideScoring", label: "OUT", angle: 102.8 },
    { key: "playmaking", label: "PLY", angle: 154.3 },
    { key: "athleticism", label: "ATH", angle: 205.7 },
    { key: "rebounding", label: "REB", angle: 257.1 },
    { key: "defending", label: "DEF", angle: 308.6 },
  ];

  const size = 80;
  const center = size / 2;
  const maxRadius = (size / 2) - 8;

  // Calculate points for the radar shape
  const points = categories.map((cat, i) => {
    const value = data[cat.key] || 0;
    const normalizedValue = value / 100;
    const angle = (cat.angle - 90) * (Math.PI / 180);
    const radius = normalizedValue * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
      label: cat.label,
      value,
      labelX: center + (maxRadius + 10) * Math.cos(angle),
      labelY: center + (maxRadius + 10) * Math.sin(angle),
    };
  });

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ') + ' Z';

  return (
    <div
      className="relative w-20 h-20 mx-auto"
      style={{
        "--color-value": "#6366f1",
      } as React.CSSProperties}
    >
      <svg width={size} height={size} className="overflow-visible">
        {/* Background circles */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx={center}
            cy={center}
            r={maxRadius * scale}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Radar shape */}
        <path
          d={pathD}
          fill="var(--color-value)"
          fillOpacity={0.7}
          stroke="var(--color-value)"
          strokeWidth={2}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2}
            fill="var(--color-value)"
          />
        ))}
      </svg>

      {/* Labels with values */}
      {points.map((p, i) => (
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{
            left: `${(p.labelX / size) * 100}%`,
            top: `${(p.labelY / size) * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="text-[7px] text-muted-foreground font-medium">
            {p.label}
          </span>
          <span className="text-[8px] font-bold text-foreground">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Calculate radar data from player attributes
function calculateRadarData(player: Player): Record<string, number> {
  const attrs = player.attributes || {};

  const avg = (values: (number | undefined)[]) => {
    const valid = values.filter((v): v is number => v !== undefined);
    return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
  };

  return {
    overall: player.overall || 0,
    insideScoring: avg([attrs.closeShot, attrs.drivingLayup, attrs.drivingDunk, attrs.standingDunk, attrs.postHook]),
    outsideScoring: avg([attrs.midRangeShot, attrs.threePointShot, attrs.freeThrow]),
    playmaking: avg([attrs.passAccuracy, attrs.ballHandle, attrs.speedWithBall, attrs.passIQ]),
    athleticism: avg([attrs.speed, attrs.acceleration, attrs.vertical, attrs.strength, attrs.stamina]),
    rebounding: avg([attrs.offensiveRebound, attrs.defensiveRebound]),
    defending: avg([attrs.interiorDefense, attrs.perimeterDefense, attrs.steal, attrs.block, attrs.lateralQuickness]),
  };
}

export function FlipCard({ player, className }: FlipCardProps) {
  const radarData = calculateRadarData(player);
  const attrs = player.attributes || {};
  const badges = player.badges || {};

  // Key stats to display
  const keyStats = [
    { label: "SPD", value: attrs.speed },
    { label: "3PT", value: attrs.threePointShot },
    { label: "DNK", value: attrs.drivingDunk || attrs.standingDunk },
    { label: "DEF", value: attrs.perimeterDefense || attrs.interiorDefense },
  ].filter(s => s.value !== undefined);

  return (
    <Link
      href={`/players/${player.slug}?type=${player.teamType}&team=${encodeURIComponent(player.team)}`}
      prefetch={true}
      className={cn("block group perspective-1000", className)}
    >
      <div className="relative w-full transition-transform duration-500 transform-style-3d group-hover:rotate-y-180">
        {/* Front of card */}
        <GameCard noPadding showCorners={false} className="backface-hidden transition-shadow hover:shadow-lg overflow-hidden border-0 bg-card/80">
          <div className="p-0">
            {/* Player image - starts at top */}
            <div className="relative aspect-3/4 bg-muted">
              {player.playerImage ? (
                <Image
                  src={player.playerImage}
                  alt={player.name}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}

              {/* Team logo - on top of player image */}
              {player.teamImg && (
                <div className="absolute top-2 left-2 z-10 w-6 h-6">
                  <Image
                    src={player.teamImg}
                    alt={player.team}
                    fill
                    className="object-contain drop-shadow-md"
                  />
                </div>
              )}

              {/* Overall rating - on card, top right */}
              <div
                className={cn(
                  "absolute top-2 right-2 z-10 px-2 py-1 rounded-md shadow-lg",
                  getRatingClasses(player.overall).bg,
                  getRatingClasses(player.overall).shadow
                )}
              >
                <span className="text-lg font-bold tabular-nums text-white">
                  {player.overall}
                </span>
              </div>

              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/90 via-black/50 to-transparent" />

              {/* Info section - positioned at bottom of image */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5 z-10">
                <div className="min-w-0">
                  {/* Position badges - above name */}
                  <div className="flex gap-1 mb-1">
                    {player.positions?.slice(0, 2).map((pos, idx) => (
                      <Badge
                        key={`${pos}-${idx}`}
                        variant="secondary"
                        className="text-[8px] px-1 py-0 h-4 bg-surface/20 text-white border-0"
                      >
                        {pos}
                      </Badge>
                    ))}
                  </div>
                  <p className="font-bold text-xs text-white truncate drop-shadow-sm">
                    {player.name}
                  </p>
                  <p className="text-[10px] text-white/80 truncate">
                    {player.team}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </GameCard>

        {/* Back of card */}
        <GameCard noPadding showCorners={false} className="absolute inset-0 backface-hidden rotate-y-180 overflow-hidden border-0 bg-card/90">
          <div className="p-3 h-full flex flex-col">
            {/* Radar chart */}
            <div className="flex-1 flex items-center justify-center">
              <RadarChart data={radarData} />
            </div>

            {/* Key stats */}
            {keyStats.length > 0 && (
              <div className="grid grid-cols-4 gap-1 mt-2">
                {keyStats.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-[8px] text-muted-foreground">{stat.label}</p>
                    <p
                      className="text-xs font-bold"
                      style={{ color: getAttributeColor(stat.value || 0) }}
                    >
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Badge counts */}
            <div className="flex justify-center gap-2 mt-2 pt-2 border-t">
              {badges.hallOfFame !== undefined && badges.hallOfFame > 0 && (
                <div className="text-center">
                  <div className="w-5 h-5 rounded-full badge-amethyst flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{badges.hallOfFame}</span>
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-0.5">HOF</p>
                </div>
              )}
              {badges.gold !== undefined && badges.gold > 0 && (
                <div className="text-center">
                  <div className="w-5 h-5 rounded-full badge-gold flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{badges.gold}</span>
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-0.5">Gold</p>
                </div>
              )}
              {badges.silver !== undefined && badges.silver > 0 && (
                <div className="text-center">
                  <div className="w-5 h-5 rounded-full badge-silver flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{badges.silver}</span>
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-0.5">Slvr</p>
                </div>
              )}
              {badges.bronze !== undefined && badges.bronze > 0 && (
                <div className="text-center">
                  <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">{badges.bronze}</span>
                  </div>
                  <p className="text-[7px] text-muted-foreground mt-0.5">Brnz</p>
                </div>
              )}
            </div>

            {/* Player name on back */}
            <p className="text-[9px] text-center text-muted-foreground mt-2 truncate font-rajdhani font-bold tracking-wide">
              {player.name}
            </p>
          </div>
        </GameCard>
      </div>
    </Link>
  );
}
