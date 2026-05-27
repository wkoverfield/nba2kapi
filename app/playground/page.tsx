"use client";

import * as React from "react";
import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LoadingCard } from "@/components/ui/loading-card";
import { MasonryRoot, MasonryItem } from "@/components/ui/masonry";
import { fadeIn } from "@/lib/animations";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TeamType } from "@/types/player";
import { parseFiltersFromURL, filtersToURLParams, type PlaygroundFilters } from "@/lib/playground-url";
import { FilterBar } from "@/components/playground/filter-bar";
import { FilterSheet } from "@/components/playground/filter-sheet";
import { FilterPanel } from "@/components/playground/filter-panel";
import { FlipCard } from "@/components/playground/flip-card";
import { ExportActions } from "@/components/playground/export-actions";

// Card dimensions for column calculation
const CARD_WIDTH = 160;
const GAP = 12;
const CONTAINER_PADDING = 32; // px-4 on each side = 16 * 2
const ROWS_PER_PAGE = 4;

export default function PlaygroundPage() {
  return (
    <Suspense fallback={<PlaygroundLoading />}>
      <PlaygroundContent />
    </Suspense>
  );
}

function PlaygroundLoading() {
  return (
    <div className="container py-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <LoadingCard key={i} />
        ))}
      </div>
    </div>
  );
}

function PlaygroundContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const initialFilters = React.useMemo(
    () => parseFiltersFromURL(searchParams),
    [searchParams]
  );

  // Filter state
  const [search, setSearch] = React.useState(initialFilters.search || "");
  const [teamType, setTeamType] = React.useState<TeamType>(initialFilters.teamType || "curr");
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>(initialFilters.teams || []);
  const [selectedPositions, setSelectedPositions] = React.useState<string[]>(
    initialFilters.positions || []
  );
  const [overallRange, setOverallRange] = React.useState<[number, number]>([
    initialFilters.minOverall ?? 0,
    initialFilters.maxOverall ?? 99,
  ]);
  const [sortBy, setSortBy] = React.useState(initialFilters.sortBy || "overall-desc");
  const [page, setPage] = React.useState(initialFilters.page || 1);

  // Calculate columns based on viewport width
  const [columns, setColumns] = React.useState(6); // Default for SSR

  React.useEffect(() => {
    const calculateColumns = () => {
      const containerWidth = window.innerWidth - CONTAINER_PADDING;
      // Max width is 1280px (max-w-7xl)
      const effectiveWidth = Math.min(containerWidth, 1280 - CONTAINER_PADDING);
      const cols = Math.floor((effectiveWidth + GAP) / (CARD_WIDTH + GAP));
      setColumns(Math.max(1, cols));
    };

    calculateColumns();
    window.addEventListener('resize', calculateColumns);
    return () => window.removeEventListener('resize', calculateColumns);
  }, []);

  // Items per page based on columns to fill complete rows
  const itemsPerPage = columns * ROWS_PER_PAGE;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch available teams for current team type
  const teamsData = useQuery(api.teams.getAllTeams, { teamType });
  const teams = React.useMemo(
    () => (teamsData || []).map((t) => ({
      name: t.name,
      logo: t.logo,
      playerCount: t.playerCount,
      avgRating: t.avgRating,
    })).sort((a, b) => a.name.localeCompare(b.name)),
    [teamsData]
  );

  // Calculate offset for pagination
  const offset = (page - 1) * itemsPerPage;

  // Fetch filtered players
  const result = useQuery(api.players.getAllFiltered, {
    search: debouncedSearch || undefined,
    teamType,
    teams: selectedTeams.length > 0 ? selectedTeams : undefined,
    positions: selectedPositions.length > 0 ? selectedPositions : undefined,
    minOverall: overallRange[0],
    maxOverall: overallRange[1],
    sortBy: sortBy as any,
    limit: itemsPerPage,
    offset,
  });

  const players = result?.players || [];
  const totalCount = result?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Sync filters to URL (debounced)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const filters: PlaygroundFilters = {
        search: debouncedSearch || undefined,
        teamType,
        teams: selectedTeams.length > 0 ? selectedTeams : undefined,
        positions: selectedPositions.length > 0 ? selectedPositions : undefined,
        minOverall: overallRange[0] !== 0 ? overallRange[0] : undefined,
        maxOverall: overallRange[1] !== 99 ? overallRange[1] : undefined,
        sortBy: sortBy !== "overall-desc" ? sortBy : undefined,
        page: page !== 1 ? page : undefined,
      };

      const params = filtersToURLParams(filters);
      const newURL = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newURL, { scroll: false });
    }, 500);

    return () => clearTimeout(timer);
  }, [debouncedSearch, teamType, selectedTeams, selectedPositions, overallRange, sortBy, page, pathname, router]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, teamType, selectedTeams, selectedPositions, overallRange, sortBy]);

  // Clear selected teams when teamType changes
  React.useEffect(() => {
    setSelectedTeams([]);
  }, [teamType]);

  // Toggle position filter
  const togglePosition = (position: string) => {
    setSelectedPositions((prev) =>
      prev.includes(position)
        ? prev.filter((p) => p !== position)
        : [...prev, position]
    );
  };

  // Toggle team filter
  const toggleTeam = (team: string) => {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team]
    );
  };

  // Clear all selected teams
  const clearTeams = () => {
    setSelectedTeams([]);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearch("");
    setTeamType("curr");
    setSelectedTeams([]);
    setSelectedPositions([]);
    setOverallRange([0, 99]);
    setSortBy("overall-desc");
    setPage(1);
  };

  const hasActiveFilters =
    !!search ||
    selectedTeams.length > 0 ||
    selectedPositions.length > 0 ||
    overallRange[0] !== 0 ||
    overallRange[1] !== 99;

  const activeFilterCount =
    (search ? 1 : 0) +
    selectedTeams.length +
    selectedPositions.length +
    (overallRange[0] !== 0 || overallRange[1] !== 99 ? 1 : 0);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <motion.div
        variants={fadeIn}
        initial="initial"
        animate="animate"
        className="mb-6 space-y-2"
      >
        <h1 className="text-5xl font-bold tracking-tight font-rajdhani bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Player Playground</h1>
        <p className="text-lg text-muted-foreground font-rajdhani tracking-wide">
          Explore and filter {totalCount.toLocaleString()} NBA 2K players
        </p>
      </motion.div>

      {/* Mobile Filter Sheet */}
      <div className="lg:hidden mb-4">
        <FilterSheet activeFilterCount={activeFilterCount}>
          <FilterPanel
            search={search}
            setSearch={setSearch}
            teamType={teamType}
            setTeamType={setTeamType}
            teams={teams}
            selectedTeams={selectedTeams}
            toggleTeam={toggleTeam}
            clearTeams={clearTeams}
            selectedPositions={selectedPositions}
            togglePosition={togglePosition}
            overallRange={overallRange}
            setOverallRange={setOverallRange}
            sortBy={sortBy}
            setSortBy={setSortBy}
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
            showHeader={false}
          />
        </FilterSheet>
      </div>

      {/* Desktop Horizontal Filter Bar */}
      <div className="hidden lg:block">
        <FilterBar
          search={search}
          setSearch={setSearch}
          teamType={teamType}
          setTeamType={setTeamType}
          teams={teams}
          selectedTeams={selectedTeams}
          toggleTeam={toggleTeam}
          clearTeams={clearTeams}
          selectedPositions={selectedPositions}
          togglePosition={togglePosition}
          overallRange={overallRange}
          setOverallRange={setOverallRange}
          sortBy={sortBy}
          setSortBy={setSortBy}
          hasActiveFilters={hasActiveFilters}
          clearFilters={clearFilters}
        />
      </div>

      {/* Player Grid - Full Width */}
      <div className="mt-6 space-y-6">
        {/* Results count, export actions, and pagination info */}
        {result !== undefined && totalCount > 0 && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {offset + 1}-{Math.min(offset + itemsPerPage, totalCount)} of{" "}
              {totalCount.toLocaleString()} players
            </p>
            <div className="flex items-center gap-3 sm:gap-4">
              <ExportActions
                search={debouncedSearch}
                teamType={teamType}
                teams={selectedTeams}
                positions={selectedPositions}
                minOverall={overallRange[0]}
                maxOverall={overallRange[1]}
                sortBy={sortBy}
                totalCount={totalCount}
              />
              {totalPages > 1 && (
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  Page {page} of {totalPages}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Loading state */}
        {result === undefined ? (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 15 }).map((_, i) => (
              <LoadingCard key={i} variant="player" />
            ))}
          </div>
        ) : players.length === 0 ? (
          /* Empty state */
          <motion.div
            variants={fadeIn}
            initial="initial"
            animate="animate"
            className="text-center py-12"
          >
            <p className="text-lg text-muted-foreground">
              No players found matching your filters
            </p>
            <Button onClick={clearFilters} className="mt-4">
              Clear Filters
            </Button>
          </motion.div>
        ) : (
          /* Player masonry grid */
          <>
            <MasonryRoot
              key={`${page}-${teamType}`}
              columnWidth={160}
              gap={{ column: 12, row: 12 }}
              itemHeight={240}
              overscan={3}
              linear
              defaultWidth={1200}
              defaultHeight={800}
              fallback={
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <LoadingCard key={i} variant="player" />
                  ))}
                </div>
              }
            >
              {players.map((player) => (
                <MasonryItem key={player._id}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <FlipCard player={player} />
                  </motion.div>
                </MasonryItem>
              ))}
            </MasonryRoot>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
