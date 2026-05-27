"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
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
import { PlayerCard } from "@/components/player-card";
import { cn } from "@/lib/utils";
import { Play, Pause, RotateCcw, Code2 } from "lucide-react";

const API_BASE = "https://api.nba2kapi.com";
const API_KEY_PLACEHOLDER = "YOUR_API_KEY";

function buildSnippets(slug: string) {
  const path = `/api/players/slug/${slug}`;
  return {
    curl: `curl '${API_BASE}${path}' \\\n  -H 'X-API-Key: ${API_KEY_PLACEHOLDER}'`,
    javascript: `const res = await fetch(
  '${API_BASE}${path}',
  { headers: { 'X-API-Key': '${API_KEY_PLACEHOLDER}' } }
);
const { data } = await res.json();
console.log(data); // player object`,
    python: `import requests

res = requests.get(
    "${API_BASE}${path}",
    headers={"X-API-Key": "${API_KEY_PLACEHOLDER}"},
)
data = res.json()["data"]  # player dict`,
  };
}

// Featured players to cycle through
const FEATURED_PLAYERS = [
  { slug: "lebron-james", name: "LeBron James" },
  { slug: "stephen-curry", name: "Stephen Curry" },
  { slug: "giannis-antetokounmpo", name: "Giannis Antetokounmpo" },
  { slug: "kevin-durant", name: "Kevin Durant" },
  { slug: "nikola-jokic", name: "Nikola Jokic" },
];

type DemoState = "idle" | "executing" | "typing-response" | "showing-card";

export function InteractiveApiDemo() {
  const [currentPlayerIndex, setCurrentPlayerIndex] = React.useState(0);
  const [demoState, setDemoState] = React.useState<DemoState>("idle");
  const [isPaused, setIsPaused] = React.useState(false);
  const [displayedResponse, setDisplayedResponse] = React.useState("");
  const [hasStarted, setHasStarted] = React.useState(false);

  // Refs for managing timeouts and animation state
  const timeoutsRef = React.useRef<Set<NodeJS.Timeout>>(new Set());
  const isMountedRef = React.useRef(true);
  const animationCancelledRef = React.useRef(false);

  const currentPlayer = FEATURED_PLAYERS[currentPlayerIndex];

  // Pre-fetch ALL player data upfront so transitions are smooth
  const lebron = useQuery(api.players.getPlayerBySlug, { slug: "lebron-james", teamType: "curr" });
  const curry = useQuery(api.players.getPlayerBySlug, { slug: "stephen-curry", teamType: "curr" });
  const giannis = useQuery(api.players.getPlayerBySlug, { slug: "giannis-antetokounmpo", teamType: "curr" });
  const durant = useQuery(api.players.getPlayerBySlug, { slug: "kevin-durant", teamType: "curr" });
  const jokic = useQuery(api.players.getPlayerBySlug, { slug: "nikola-jokic", teamType: "curr" });

  // Map player data by index
  const allPlayerData = React.useMemo(
    () => [lebron, curry, giannis, durant, jokic],
    [lebron, curry, giannis, durant, jokic]
  );

  const playerData = allPlayerData[currentPlayerIndex];

  // Get available players (those that have loaded)
  const availablePlayerIndices = React.useMemo(() => {
    return allPlayerData
      .map((data, idx) => (data ? idx : -1))
      .filter(idx => idx !== -1);
  }, [allPlayerData]);

  // Check if at least one player is loaded (don't require all)
  const hasAnyData = availablePlayerIndices.length > 0;
  const currentPlayerLoaded = playerData !== undefined;

  // Generate the request code shown in the animated demo. Matches the actual
  // production URL — earlier versions had a typo'd domain (`nba2kdb.com`) and
  // a missing `/api` prefix, so any visitor who pasted this would 404.
  const requestCode = `fetch('${API_BASE}/api/players/slug/${currentPlayer.slug}', {
  headers: { 'X-API-Key': '${API_KEY_PLACEHOLDER}' }
})`;

  // Snippets for the "Get code" dialog — same endpoint as the demo, in
  // cURL / JavaScript / Python so visitors can copy-paste in their stack.
  const snippets = React.useMemo(
    () => buildSnippets(currentPlayer.slug),
    [currentPlayer.slug],
  );

  // Pause the cycle while the dialog is open so the visible player (and the
  // snippet inside the dialog) doesn't change mid-read.
  const [dialogOpen, setDialogOpen] = React.useState(false);
  React.useEffect(() => {
    if (dialogOpen) setIsPaused(true);
  }, [dialogOpen]);

  // Generate formatted response
  const responseJson = React.useMemo(() => {
    if (!playerData) return "";
    return JSON.stringify(
      {
        success: true,
        data: {
          name: playerData.name,
          team: playerData.team,
          overall: playerData.overall,
          positions: playerData.positions,
          height: playerData.height,
          weight: playerData.weight,
        },
      },
      null,
      2
    );
  }, [playerData]);

  // Helper to create trackable timeouts
  const createTimeout = React.useCallback((callback: () => void, delay: number): NodeJS.Timeout => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      callback();
    }, delay);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  // Helper to clear all timeouts
  const clearAllTimeouts = React.useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current.clear();
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  // Find next available player
  const getNextPlayerIndex = React.useCallback(() => {
    if (availablePlayerIndices.length === 0) return 0;

    const currentPosInAvailable = availablePlayerIndices.indexOf(currentPlayerIndex);
    if (currentPosInAvailable === -1) {
      // Current player not available, use first available
      return availablePlayerIndices[0];
    }

    // Get next in available list
    const nextPos = (currentPosInAvailable + 1) % availablePlayerIndices.length;
    return availablePlayerIndices[nextPos];
  }, [availablePlayerIndices, currentPlayerIndex]);

  // Main animation runner
  const runAnimation = React.useCallback(() => {
    if (!isMountedRef.current || animationCancelledRef.current) return;
    if (!currentPlayerLoaded || !responseJson) return;

    // Reset state
    setDemoState("executing");
    setDisplayedResponse("");

    // Step 1: Show "executing" state
    createTimeout(() => {
      if (!isMountedRef.current || animationCancelledRef.current) return;

      // Step 2: Start typewriter effect
      setDemoState("typing-response");

      const chars = responseJson.split("");
      let charIndex = 0;

      const typeNextChar = () => {
        if (!isMountedRef.current || animationCancelledRef.current) return;

        if (charIndex < chars.length) {
          setDisplayedResponse(responseJson.slice(0, charIndex + 1));
          charIndex++;
          createTimeout(typeNextChar, 6);
        } else {
          // Step 3: Show card
          if (!isMountedRef.current || animationCancelledRef.current) return;
          setDemoState("showing-card");

          // Step 4: Wait then move to next player
          createTimeout(() => {
            if (!isMountedRef.current || animationCancelledRef.current) return;

            const nextIndex = getNextPlayerIndex();
            setCurrentPlayerIndex(nextIndex);
          }, 4000);
        }
      };

      typeNextChar();
    }, 800);
  }, [currentPlayerLoaded, responseJson, createTimeout, getNextPlayerIndex]);

  // Effect to start/restart animation when conditions are met
  React.useEffect(() => {
    // Don't run if paused
    if (isPaused) return;

    // Don't run if no data available
    if (!hasAnyData) return;

    // Cancel any existing animation
    animationCancelledRef.current = true;
    clearAllTimeouts();

    // Reset cancelled flag for new animation
    animationCancelledRef.current = false;

    // Reset state for new player
    setDemoState("idle");
    setDisplayedResponse("");

    // If current player isn't loaded, switch to one that is
    if (!currentPlayerLoaded && availablePlayerIndices.length > 0) {
      const firstAvailable = availablePlayerIndices[0];
      if (firstAvailable !== currentPlayerIndex) {
        setCurrentPlayerIndex(firstAvailable);
        return; // Effect will re-run with new index
      }
    }

    // Start animation after short delay
    if (currentPlayerLoaded) {
      setHasStarted(true);
      createTimeout(runAnimation, 1500);
    }

    return () => {
      animationCancelledRef.current = true;
      clearAllTimeouts();
    };
  }, [
    currentPlayerIndex,
    isPaused,
    hasAnyData,
    currentPlayerLoaded,
    availablePlayerIndices,
    clearAllTimeouts,
    createTimeout,
    runAnimation,
  ]);

  // Manual restart
  const handleRun = React.useCallback(() => {
    animationCancelledRef.current = true;
    clearAllTimeouts();

    setDemoState("idle");
    setDisplayedResponse("");
    setIsPaused(false);

    // Brief delay then restart
    setTimeout(() => {
      animationCancelledRef.current = false;
      if (currentPlayerLoaded) {
        runAnimation();
      }
    }, 100);
  }, [clearAllTimeouts, currentPlayerLoaded, runAnimation]);

  // Switch to specific player
  const handlePlayerSwitch = React.useCallback((idx: number) => {
    if (idx !== currentPlayerIndex) {
      animationCancelledRef.current = true;
      clearAllTimeouts();
      setCurrentPlayerIndex(idx);
    }
  }, [currentPlayerIndex, clearAllTimeouts]);

  // Toggle pause
  const handleTogglePause = React.useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  return (
    <div className="relative">
      {/* Main Demo Container - Fixed height to prevent layout shift */}
      <div className="relative pb-20">
        <Card className="overflow-hidden border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {/* Code Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  api-demo.js
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 gap-1 text-xs"
                      title="Get this code in cURL, JavaScript, or Python"
                    >
                      <Code2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Get code</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        Fetch {currentPlayer.name}
                      </DialogTitle>
                      <DialogDescription>
                        Replace <code className="text-xs">{API_KEY_PLACEHOLDER}</code> with your key from the{" "}
                        <Link href="/dashboard" className="underline hover:no-underline">
                          dashboard
                        </Link>
                        .
                      </DialogDescription>
                    </DialogHeader>
                    <LanguageTabs examples={snippets} defaultLanguage="curl" />
                  </DialogContent>
                </Dialog>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleTogglePause}
                  title={isPaused ? "Resume demo" : "Pause demo"}
                >
                  {isPaused ? (
                    <Play className="h-3 w-3" />
                  ) : (
                    <Pause className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={handleRun}
                  title="Restart demo"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Code Content - Fixed height */}
            <div className="p-4 bg-slate-950 font-mono text-sm h-[420px] overflow-hidden">
              {/* Request */}
              <div className="mb-4">
                <span className="text-slate-500">// Request</span>
                <pre
                  className={cn(
                    "mt-1 text-emerald-400 transition-opacity text-xs sm:text-sm",
                    demoState === "executing" && "animate-pulse"
                  )}
                >
                  {requestCode}
                </pre>
              </div>

              {/* Response */}
              <div>
                <span className="text-slate-500">// Response</span>
                <pre className="mt-1 text-amber-300 whitespace-pre-wrap text-xs sm:text-sm">
                  {displayedResponse || (
                    <span className="text-slate-600">
                      {!hasAnyData
                        ? "// Loading..."
                        : demoState === "executing"
                        ? "Fetching..."
                        : "// Waiting..."}
                    </span>
                  )}
                  {demoState === "typing-response" && (
                    <span className="inline-block w-1.5 h-3 bg-amber-300 animate-pulse ml-0.5" />
                  )}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Popover Player Card - Positioned absolutely to not affect layout */}
        <AnimatePresence>
          {demoState === "showing-card" && playerData && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="absolute -bottom-16 right-0 z-10 w-64 sm:w-72 shadow-2xl"
            >
              <Link
                href={`/players/${playerData.slug}?type=curr&team=${encodeURIComponent(playerData.team)}`}
                className="block"
              >
                <PlayerCard 
                  player={playerData} 
                  size="md" 
                  className="bg-background/95 backdrop-blur-xl border-primary/20 shadow-2xl"
                />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player Indicator Dots */}
      <div className="flex justify-center gap-2 mt-2">
        {FEATURED_PLAYERS.map((player, idx) => {
          const isAvailable = availablePlayerIndices.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => handlePlayerSwitch(idx)}
              aria-label={`Show ${player.name}`}
              disabled={!isAvailable}
              className={cn(
                "h-2 rounded-full transition-all",
                idx === currentPlayerIndex
                  ? "bg-primary w-6"
                  : isAvailable
                  ? "bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 w-2"
                  : "bg-slate-200 dark:bg-slate-700 w-2 opacity-50 cursor-not-allowed"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
