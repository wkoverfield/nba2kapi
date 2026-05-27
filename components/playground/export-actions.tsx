"use client";

/**
 * Playground export actions — "Get code" (primary) + "Copy JSON" (secondary).
 *
 * Get code: opens a dialog with cURL / JavaScript / Python tabs containing a
 * runnable snippet for the user's current filters, pointing at the actual API.
 * The intended conversion path is browse → "I like this slice" → grab the
 * code → integrate. Mirrors the Stripe / Anthropic / OpenAI Console pattern.
 *
 * Copy JSON: secondary escape hatch — fetches the full filtered dataset on
 * click and writes it to the clipboard. Useful for one-off scripts and
 * notebooks where the user just wants the bytes right now.
 *
 * Download-to-file was intentionally dropped: anyone who actually wants a
 * file can pipe the cURL snippet to `> file.json`, and webapp users almost
 * never want a downloaded blob on their disk.
 */

import * as React from "react";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Code2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LanguageTabs } from "@/components/language-tabs";
import type { TeamType } from "@/types/player";

const API_BASE = "https://api.nba2kapi.com";
const API_KEY_PLACEHOLDER = "YOUR_API_KEY";

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

/**
 * Build the API path + query params that best match the user's current
 * filter state. Picks the right endpoint:
 *   - search active  → /api/players/search?q=...
 *   - everything else → /api/players/bulk (one-shot, no pagination)
 *
 * The bulk endpoint accepts: teamType, team (single), minRating, maxRating,
 * position (single). For multi-select filters we use the first selection and
 * note the limitation in a comment (added by the snippet builders below).
 */
function buildQuery(props: Props): {
  path: string;
  params: Record<string, string>;
  notes: string[];
} {
  const notes: string[] = [];
  const params: Record<string, string> = {};

  if (props.search && props.search.trim()) {
    // Search endpoint — different shape; takes `q` and a single teamType.
    params.q = props.search.trim();
    params.teamType = props.teamType;
    if (props.minOverall > 0 || props.maxOverall < 99) {
      notes.push("API search doesn't filter by rating — apply min/max client-side");
    }
    if (props.teams.length > 0) {
      notes.push("API search doesn't filter by team — apply client-side");
    }
    if (props.positions.length > 0) {
      notes.push("API search doesn't filter by position — apply client-side");
    }
    return { path: "/api/players/search", params, notes };
  }

  // Bulk endpoint — returns every matching player in one call.
  params.teamType = props.teamType;
  if (props.teams.length === 1) {
    params.team = props.teams[0];
  } else if (props.teams.length > 1) {
    params.team = props.teams[0];
    notes.push(`API accepts one team — filter the other ${props.teams.length - 1} client-side`);
  }
  if (props.positions.length === 1) {
    params.position = props.positions[0];
  } else if (props.positions.length > 1) {
    params.position = props.positions[0];
    notes.push(`API accepts one position — filter the other ${props.positions.length - 1} client-side`);
  }
  if (props.minOverall > 0) params.minRating = String(props.minOverall);
  if (props.maxOverall < 99) params.maxRating = String(props.maxOverall);
  if (props.sortBy && props.sortBy !== "overall-desc") {
    notes.push(`API sorts by overall desc — re-sort client-side for ${props.sortBy}`);
  }

  return { path: "/api/players/bulk", params, notes };
}

function buildCurl(q: ReturnType<typeof buildQuery>): string {
  const qs = new URLSearchParams(q.params).toString();
  const url = `${API_BASE}${q.path}${qs ? `?${qs}` : ""}`;
  return `curl '${url}' \\\n  -H 'X-API-Key: ${API_KEY_PLACEHOLDER}'`;
}

function buildJavaScript(q: ReturnType<typeof buildQuery>): string {
  const qs = new URLSearchParams(q.params).toString();
  const url = `${API_BASE}${q.path}${qs ? `?${qs}` : ""}`;
  const notesBlock = q.notes.length
    ? q.notes.map((n) => `// NOTE: ${n}`).join("\n") + "\n"
    : "";
  return `${notesBlock}const res = await fetch(
  '${url}',
  { headers: { 'X-API-Key': '${API_KEY_PLACEHOLDER}' } }
);
const { data } = await res.json();
console.log(data); // array of players`;
}

function buildPython(q: ReturnType<typeof buildQuery>): string {
  const paramLines = Object.entries(q.params)
    .map(([k, v]) => `        ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  const notesBlock = q.notes.length
    ? q.notes.map((n) => `# NOTE: ${n}`).join("\n") + "\n"
    : "";
  return `${notesBlock}import requests

res = requests.get(
    "${API_BASE}${q.path}",
    params={
${paramLines}
    },
    headers={"X-API-Key": "${API_KEY_PLACEHOLDER}"},
)
data = res.json()["data"]  # list of players`;
}

export function ExportActions(props: Props) {
  const convex = useConvex();
  const [isFetching, setIsFetching] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Rebuild snippets only when filter inputs change.
  const examples = React.useMemo(() => {
    const q = buildQuery(props);
    return {
      curl: buildCurl(q),
      javascript: buildJavaScript(q),
      python: buildPython(q),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.search,
    props.teamType,
    props.teams.join(","),
    props.positions.join(","),
    props.minOverall,
    props.maxOverall,
    props.sortBy,
  ]);

  const handleCopyJson = async () => {
    if (isFetching) return;
    setIsFetching(true);
    try {
      const result = await convex.query(api.players.getAllFiltered, {
        search: props.search || undefined,
        teamType: props.teamType,
        teams: props.teams.length > 0 ? props.teams : undefined,
        positions: props.positions.length > 0 ? props.positions : undefined,
        minOverall: props.minOverall,
        maxOverall: props.maxOverall,
        sortBy: props.sortBy as any,
        limit: 10000,
        offset: 0,
      });
      const json = JSON.stringify(result.players, null, 2);
      await navigator.clipboard.writeText(json);
      toast.success(
        `Copied ${result.players.length.toLocaleString()} player${result.players.length === 1 ? "" : "s"}`,
        { description: `${(new Blob([json]).size / 1024).toFixed(1)} KB of JSON on clipboard` },
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

  const disabled = props.totalCount === 0;

  return (
    <div className="flex items-center gap-2">
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="default"
            size="sm"
            disabled={disabled}
            title="See code for this query"
          >
            <Code2 className="h-4 w-4" />
            <span className="hidden sm:inline">Get code</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Use this query in your code</DialogTitle>
            <DialogDescription>
              Replace <code className="text-xs">{API_KEY_PLACEHOLDER}</code> with your key from the{" "}
              <a href="/dashboard" className="underline hover:no-underline">
                dashboard
              </a>
              . The endpoint returns every matching player in one call.
            </DialogDescription>
          </DialogHeader>
          <LanguageTabs examples={examples} defaultLanguage="curl" />
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyJson}
        disabled={disabled || isFetching}
        title={`Copy ${props.totalCount.toLocaleString()} player${props.totalCount === 1 ? "" : "s"} as raw JSON`}
      >
        <Copy className="h-4 w-4" />
        <span className="hidden sm:inline">Copy JSON</span>
      </Button>
    </div>
  );
}
