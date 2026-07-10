"use client";

import * as React from "react";
import { useParams, useSearchParams, notFound } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BackButton } from "@/components/ui/back-button";
import { TeamHeader } from "@/components/team/team-header";
import { TeamRoster } from "@/components/team/team-roster";
import {
  TeamStats,
  TeamAttributeAverages,
  TeamBadgeDistribution,
  TeamRatingDistribution,
} from "@/components/team/team-stats";
import { AnimatedContainer } from "@/components/ui/animated-container";
import { LoadingCard } from "@/components/ui/loading-card";

export default function TeamDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const type = searchParams.get("type") as "curr" | "class" | "allt" | null;
  const teamType = type || "curr";

  // First, get the actual team name from the slug
  const teamInfo = useQuery(api.teams.getTeamBySlug, {
    slug,
    teamType,
  });

  // Then fetch team stats and roster using the actual team name
  const teamStats = useQuery(
    api.teams.getTeamStats,
    teamInfo?.name
      ? {
          team: teamInfo.name,
          teamType,
        }
      : "skip"
  );

  const roster = useQuery(
    api.teams.getTeamRoster,
    teamInfo?.name
      ? {
          team: teamInfo.name,
          teamType,
        }
      : "skip"
  );

  // Loading state
  if (teamInfo === undefined) {
    return (
      <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
        <div className="h-6 w-64 animate-pulse rounded bg-muted" />

        <div className="space-y-6">
          <LoadingCard variant="detail" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LoadingCard variant="player" />
          </div>
          <div>
            <LoadingCard variant="player" />
          </div>
        </div>
      </div>
    );
  }

  // Team not found (teamInfo came back null from lookup)
  if (teamInfo === null) {
    notFound();
  }

  // Still loading team stats/roster
  if (teamStats === undefined || roster === undefined) {
    return (
      <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
        <div className="h-6 w-64 animate-pulse rounded bg-muted" />

        <div className="space-y-6">
          <LoadingCard variant="detail" />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LoadingCard variant="player" />
          </div>
          <div>
            <LoadingCard variant="player" />
          </div>
        </div>
      </div>
    );
  }

  // Team data came back null/empty
  if (teamStats === null || roster === null || roster.length === 0) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-8 px-4 py-8">
      {/* Back Navigation */}
      <BackButton />

      {/* Team Header */}
      <AnimatedContainer variant="fade">
        <TeamHeader
          team={teamStats.team}
          teamType={teamStats.teamType}
          logo={teamStats.logo}
          playerCount={teamStats.playerCount}
          avgOverall={teamStats.avgOverall}
          topPlayer={teamStats.topPlayer}
        />
      </AnimatedContainer>

      {/* Main Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Team Roster - Takes 2/3 width */}
        <div className="lg:col-span-2">
          <AnimatedContainer variant="slide" delay={0.1}>
            <TeamRoster players={roster} teamType={teamType} />
          </AnimatedContainer>
        </div>

        {/* Team Stats - Takes 1/3 width */}
        <div className="space-y-6">
          <AnimatedContainer variant="slide" delay={0.15}>
            <TeamStats
              positionDistribution={teamStats.positionDistribution}
              playerCount={teamStats.playerCount}
            />
          </AnimatedContainer>

          <AnimatedContainer variant="slide" delay={0.2}>
            <TeamAttributeAverages
              attributeAverages={teamStats.attributeAverages}
            />
          </AnimatedContainer>

          <AnimatedContainer variant="slide" delay={0.25}>
            <TeamBadgeDistribution
              badgeStats={teamStats.badgeStats}
            />
          </AnimatedContainer>

          <AnimatedContainer variant="slide" delay={0.3}>
            <TeamRatingDistribution
              players={roster}
            />
          </AnimatedContainer>
        </div>
      </div>
    </div>
  );
}
