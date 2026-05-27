"use client";

/**
 * Export actions for the playground — Copy JSON / Download JSON buttons.
 *
 * Fetches the FULL filtered dataset on click (not just the visible page).
 * Uses the Convex client imperatively so we don't burn realtime subscriptions
 * for data the user may never request. Mirrors the shape of /api/players/bulk.
 */

import * as React from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TeamType } from "@/types/player";

type Props = {
  search?: string;
  teamType: TeamType;
  teams: string[];
  positions: string[];
  minOverall: number;
  maxOverall: number;
  sortBy: string;
  totalCount: number;
};

export function ExportActions({
  search,
  teamType,
  teams,
  positions,
  minOverall,
  maxOverall,
  sortBy,
  totalCount,
}: Props) {
  const convex = useConvex();
  const [isFetching, setIsFetching] = React.useState(false);

  const fetchAll = React.useCallback(async () => {
    // limit=10000 returns everything matching; current DB has ~1.9k players.
    return convex.query(api.players.getAllFiltered, {
      search: search || undefined,
      teamType,
      teams: teams.length > 0 ? teams : undefined,
      positions: positions.length > 0 ? positions : undefined,
      minOverall,
      maxOverall,
      sortBy: sortBy as any,
      limit: 10000,
      offset: 0,
    });
  }, [convex, search, teamType, teams, positions, minOverall, maxOverall, sortBy]);

  const handleCopy = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const result = await fetchAll();
      const json = JSON.stringify(result.players, null, 2);
      await navigator.clipboard.writeText(json);
      toast.success(
        `Copied ${result.players.length.toLocaleString()} player${result.players.length === 1 ? "" : "s"} to clipboard`,
        { description: `${(new Blob([json]).size / 1024).toFixed(1)} KB of JSON` },
      );
    } catch (err) {
      console.error("Copy failed:", err);
      toast.error("Couldn't copy to clipboard", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleDownload = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const result = await fetchAll();
      const json = JSON.stringify(result.players, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Filename: nba2k-players-curr-2026-05-27.json
      const date = new Date().toISOString().slice(0, 10);
      const filename = `nba2k-players-${teamType}-${date}.json`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(
        `Downloaded ${result.players.length.toLocaleString()} player${result.players.length === 1 ? "" : "s"}`,
        { description: filename },
      );
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Couldn't download JSON", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const disabled = isFetching || totalCount === 0;
  const label = totalCount > 0
    ? `${totalCount.toLocaleString()} player${totalCount === 1 ? "" : "s"}`
    : "0 players";

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        disabled={disabled}
        title={`Copy ${label} as JSON to clipboard`}
      >
        <Copy className="h-4 w-4" />
        <span className="hidden sm:inline">Copy JSON</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={disabled}
        title={`Download ${label} as a .json file`}
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Download JSON</span>
      </Button>
    </div>
  );
}
