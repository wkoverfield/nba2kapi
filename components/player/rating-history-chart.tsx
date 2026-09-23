"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { getRatingTier } from "@/lib/rating-colors";
import { cn } from "@/lib/utils";

const VIEW_W = 396;
const VIEW_H = 150;
const PLOT_LEFT = 24;
const PLOT_RIGHT = VIEW_W;
const BASELINE_Y = 130;
const PLOT_H = 105;

const TIER_CUTOFFS = [99, 97, 95, 92, 90, 87, 84, 80, 75, 70];

export interface RatingHistoryPoint {
  label: string;
  overall: number;
}

export interface RatingHistoryChartProps {
  /** "season" plots in-season milestones, "games" plots one point per 2K release. */
  mode: "season" | "games";
  points: RatingHistoryPoint[];
  slug: string;
  className?: string;
}

/**
 * Rating over time, plotted as an editorial line chart.
 *
 * Interaction is driven off a single active index so pointer, touch and
 * keyboard all land in the same place: hovering or arrowing selects the
 * nearest point, which draws a crosshair and a readout. The SVG scales with
 * its container, so pointer x is mapped back through the rendered width
 * rather than read as a viewBox coordinate.
 */
export function RatingHistoryChart({ mode, points, slug, className }: RatingHistoryChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.overall);
    const min = Math.min(...values) - 0.5;
    const max = Math.max(...values) + 0.5;
    const span = max - min || 1;
    const sx = (i: number) => PLOT_LEFT + (i / (values.length - 1)) * (PLOT_RIGHT - PLOT_LEFT - 24);
    const sy = (v: number) => BASELINE_Y - ((v - min) / span) * PLOT_H;
    const cutoff = TIER_CUTOFFS.find((c) => c > min && c <= max + 0.5) ?? null;
    // At most 4 tick labels so milestone names never collide
    const tickIdx = [
      ...new Set([
        0,
        Math.floor((points.length - 1) / 3),
        Math.floor(((points.length - 1) * 2) / 3),
        points.length - 1,
      ]),
    ];
    const dots = values.map((v, i) => ({ x: sx(i), y: sy(v) }));
    return {
      dots,
      line: dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(" "),
      band:
        cutoff !== null
          ? { y: sy(cutoff), label: `${cutoff} — ${getRatingTier(cutoff).toUpperCase()}` }
          : null,
      ticks: tickIdx.map((i) => ({ x: sx(i), label: points[i].label })),
      delta: values[values.length - 1] - values[0],
    };
  }, [points]);

  const nearestIndex = useCallback(
    (clientX: number) => {
      if (!geom || !svgRef.current) return null;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width === 0) return null;
      const x = ((clientX - rect.left) / rect.width) * VIEW_W;
      let best = 0;
      let bestDist = Infinity;
      geom.dots.forEach((d, i) => {
        const dist = Math.abs(d.x - x);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    },
    [geom]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!geom) return;
      const last = points.length - 1;
      const current = active ?? last;
      let next: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(last, current + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0, current - 1);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      else if (e.key === "Escape") {
        setActive(null);
        return;
      }
      if (next !== null) {
        e.preventDefault();
        setActive(next);
      }
    },
    [active, geom, points.length]
  );

  if (!geom) {
    return (
      <div className={cn("flex h-[150px] items-center justify-center font-plex text-[9px] text-[#b5b0a1]", className)}>
        ONE GAME OF DATA — HISTORY BUILDS EACH 2K RELEASE
      </div>
    );
  }

  const activePoint = active !== null ? points[active] : null;
  const activeDot = active !== null ? geom.dots[active] : null;
  // Keep the readout inside the card at either end of the series
  const anchor =
    activeDot === null ? "center" : activeDot.x < 70 ? "start" : activeDot.x > VIEW_W - 70 ? "end" : "center";

  return (
    <div className={className}>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="block h-auto w-full touch-pan-y overflow-visible focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1a1918]"
          role="group"
          tabIndex={0}
          aria-label={`Overall rating across ${points.length} ${
            mode === "season" ? "milestones this season" : "2K releases"
          }. Use arrow keys to step through each point.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => setActive(nearestIndex(e.clientX))}
          onPointerDown={(e) => setActive(nearestIndex(e.clientX))}
          onPointerLeave={(e) => {
            // A tap leaves the readout up; a mouse leaving clears it.
            if (e.pointerType === "mouse") setActive(null);
          }}
        >
          {/* Blank areas of an inline SVG do not reliably hit-test, so a
              transparent surface carries the pointer over the whole plot. */}
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="transparent" />

          {geom.band && (
            <>
              <line
                x1={PLOT_LEFT}
                x2={PLOT_RIGHT}
                y1={geom.band.y}
                y2={geom.band.y}
                stroke="#f9a205"
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity="0.6"
              />
              <text
                x={PLOT_RIGHT - 4}
                y={geom.band.y}
                textAnchor="end"
                dy="-4"
                className="fill-[#b98404] font-plex text-[7.5px]"
              >
                {geom.band.label}
              </text>
            </>
          )}

          {activeDot && (
            <line
              x1={activeDot.x}
              x2={activeDot.x}
              y1="8"
              y2={BASELINE_Y + 4}
              stroke="#1a1918"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.35"
            />
          )}

          <polyline
            points={geom.line}
            fill="none"
            stroke="#1a1918"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {geom.dots.map((d, i) => (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={i === active ? 4 : 2.5}
              fill={i === active ? "#faf9f5" : "#1a1918"}
              stroke="#1a1918"
              strokeWidth={i === active ? 2 : 0}
            />
          ))}

          {geom.ticks.map((t) => (
            <text
              key={t.label + t.x}
              x={t.x}
              y="146"
              textAnchor="middle"
              className="fill-[#b5b0a1] font-plex text-[8px]"
            >
              {t.label}
            </text>
          ))}
        </svg>

        {activePoint && activeDot && (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute z-10 -translate-y-[calc(100%+10px)] rounded-[6px] bg-[#1a1918] px-2 py-1 font-plex text-[8px] leading-[1.5] whitespace-nowrap text-[#faf9f5] shadow-[0_8px_16px_-8px_rgba(26,25,24,0.5)]",
              anchor === "center" && "-translate-x-1/2",
              anchor === "end" && "-translate-x-full"
            )}
            style={{
              left: `${(activeDot.x / VIEW_W) * 100}%`,
              top: `${(activeDot.y / VIEW_H) * 100}%`,
            }}
          >
            <span className="text-[#b5b0a1]">{activePoint.label}</span>{" "}
            <span className="font-bold">{activePoint.overall}</span>{" "}
            <span className="text-[#b5b0a1]">{getRatingTier(activePoint.overall).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="mt-1.5 font-plex text-[8px] text-[#b5b0a1]" aria-live="polite">
        {activePoint ? (
          <>
            {activePoint.label} · {activePoint.overall} OVR ·{" "}
            {getRatingTier(activePoint.overall).toUpperCase()}
          </>
        ) : (
          <>
            {geom.delta >= 0 ? "+" : ""}
            {geom.delta}{" "}
            {mode === "season"
              ? `ACROSS ${points.length} MILESTONES THIS SEASON`
              : `ACROSS ${points.length} GAMES`}{" "}
            · GET /api/players/slug/{slug}
          </>
        )}
      </div>
    </div>
  );
}
