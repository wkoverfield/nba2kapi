"use client";

import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const VIEW_W = 210;
const VIEW_H = 184;
const CX = 105;
const CY = 92;
const R = 62;

export interface RadarAxis {
  key: string;
  label: string;
  /** Full category name, used in the readout. */
  fullLabel: string;
  value: number | null;
  average: number | null;
}

export interface CategoryRadarProps {
  axes: RadarAxis[];
  /** Position the averages are drawn from, e.g. "PF". */
  position: string;
  className?: string;
}

/**
 * Category radar: the player's profile against the positional average.
 *
 * Each axis is a hit target. Pointer and keyboard both set a single active
 * axis, which draws a spoke and shows the player-vs-average gap, so the
 * chart answers "how far above the position is he here?" without a legend
 * lookup.
 */
export function CategoryRadar({ axes, position, className }: CategoryRadarProps) {
  const [active, setActive] = useState<number | null>(null);

  const geom = useMemo(() => {
    const pt = (i: number, rr: number) => {
      const angle = ((i * (360 / axes.length) - 90) * Math.PI) / 180;
      return { x: +(CX + rr * Math.cos(angle)).toFixed(1), y: +(CY + rr * Math.sin(angle)).toFixed(1) };
    };
    const rings = [0.5, 1].map((f) =>
      axes.map((_, i) => {
        const p = pt(i, R * f);
        return `${p.x},${p.y}`;
      }).join(" ")
    );
    const dots = axes.map((a, i) => pt(i, ((a.value ?? 0) / 99) * R));
    const avgDots = axes.map((a, i) => pt(i, ((a.average ?? 0) / 99) * R));
    const toPath = (ps: { x: number; y: number }[]) =>
      ps.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
    const ticks = axes.map((a, i) => {
      const p = pt(i, R + 14);
      const dx = p.x - CX;
      return {
        x: p.x,
        y: p.y,
        anchor: (Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end") as "middle" | "start" | "end",
      };
    });
    return { rings, dots, avgDots, path: toPath(dots), avgPath: toPath(avgDots), ticks, spokes: axes.map((_, i) => pt(i, R)) };
  }, [axes]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const last = axes.length - 1;
      const current = active ?? 0;
      let next: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next = current >= last ? 0 : current + 1;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = current <= 0 ? last : current - 1;
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
    [active, axes.length]
  );

  const activeAxis = active !== null ? axes[active] : null;
  const gap =
    activeAxis && activeAxis.value !== null && activeAxis.average !== null
      ? Math.round(activeAxis.value - activeAxis.average)
      : null;

  return (
    <div className={className}>
      <svg
        width={VIEW_W}
        height={VIEW_H}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="overflow-visible focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1a1918]"
        role="group"
        tabIndex={0}
        aria-label={`Category radar, player against the ${position} average. Use arrow keys to step through each category.`}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {geom.rings.map((ring) => (
          <polygon key={ring} points={ring} fill="none" stroke="#e5e2da" strokeWidth="1" />
        ))}

        {active !== null && (
          <line
            x1={CX}
            y1={CY}
            x2={geom.spokes[active].x}
            y2={geom.spokes[active].y}
            stroke="#1a1918"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.35"
          />
        )}

        <path
          d={geom.avgPath}
          fill="#d3a21d"
          fillOpacity="0.06"
          stroke="#b98404"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <path d={geom.path} fill="#1a1918" fillOpacity="0.08" stroke="#1a1918" strokeWidth="2" />

        {active !== null && (
          <circle
            cx={geom.avgDots[active].x}
            cy={geom.avgDots[active].y}
            r="3"
            fill="#faf9f5"
            stroke="#b98404"
            strokeWidth="1.5"
          />
        )}

        {geom.dots.map((d, i) => (
          <circle
            key={axes[i].key}
            cx={d.x}
            cy={d.y}
            r={i === active ? 4 : 2.5}
            fill={i === active ? "#faf9f5" : "#1a1918"}
            stroke="#1a1918"
            strokeWidth={i === active ? 2 : 0}
          />
        ))}

        {axes.map((a, i) => (
          <text
            key={a.key}
            x={geom.ticks[i].x}
            y={geom.ticks[i].y}
            textAnchor={geom.ticks[i].anchor}
            className={cn(
              "font-plex text-[8.5px]",
              i === active ? "fill-[#1a1918]" : "fill-[#8a8577]"
            )}
          >
            {a.label} <tspan className="fill-[#1a1918] font-bold">{a.value ?? "—"}</tspan>
          </text>
        ))}

        {/* Hit targets sit last so they take the pointer over marks and labels */}
        {geom.ticks.map((t, i) => (
          <circle
            key={`hit-${axes[i].key}`}
            cx={(geom.dots[i].x + t.x) / 2}
            cy={(geom.dots[i].y + t.y) / 2}
            r="20"
            fill="transparent"
            className="cursor-pointer"
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          />
        ))}
      </svg>

      <div
        className="mt-1 text-center font-plex text-[8px] text-[#b5b0a1]"
        aria-live="polite"
      >
        {activeAxis ? (
          <>
            {activeAxis.fullLabel.toUpperCase()} ·{" "}
            <span className="font-bold text-[#1a1918]">{activeAxis.value ?? "—"}</span> ·{" "}
            {position} AVG {activeAxis.average !== null ? Math.round(activeAxis.average) : "—"}
            {gap !== null && (
              <span className={gap >= 0 ? " text-[#1a1918]" : " text-[#b98404]"}>
                {" "}
                ({gap >= 0 ? "+" : ""}
                {gap})
              </span>
            )}
          </>
        ) : (
          "HOVER OR ARROW THROUGH A CATEGORY"
        )}
      </div>
    </div>
  );
}
