"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRatingClasses } from "@/lib/rating-colors";
import { X, User, Plus, RefreshCw } from "lucide-react";
import type { Player } from "@/types/player";
import Image from "next/image";

interface LineupSlotProps {
  player?: Player;
  index: number;
  onRemove?: () => void;
  onPlayerClick?: (player: Player) => void;
  isEmpty?: boolean;
  compact?: boolean;
  lineupId?: string;
}

export function LineupSlot({ player, index, onRemove, onPlayerClick, isEmpty, compact = false, lineupId = "lineup1" }: LineupSlotProps) {
  // Early return for empty slots
  if (!player) {
    return (
      <DroppableEmptySlot index={index} compact={compact} lineupId={lineupId} />
    );
  }

  return (
    <FilledSlot
      player={player}
      index={index}
      onRemove={onRemove}
      onPlayerClick={onPlayerClick}
      compact={compact}
      lineupId={lineupId}
    />
  );
}

function FilledSlot({
  player,
  index,
  onRemove,
  onPlayerClick,
  compact,
  lineupId
}: {
  player: Player;
  index: number;
  onRemove?: () => void;
  onPlayerClick?: (player: Player) => void;
  compact: boolean;
  lineupId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${lineupId}-${player._id}`,
    data: { player, index, lineupId },
  });

  // Also make filled slots droppable for replacement
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `${lineupId}-slot-${index}`,
    data: { index, lineupId, player },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing relative transition-transform hover:scale-105",
        isDragging && "opacity-50 z-50"
      )}
    >
      {/* Remove Button - outside the card for proper overflow */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "absolute -top-1.5 -right-1.5 rounded-full z-30 shadow-md",
          "bg-black/70 text-white hover:bg-black/90 hover:text-white",
          "dark:bg-surface/80 dark:text-black dark:hover:bg-surface dark:hover:text-black",
          compact ? "h-5 w-5" : "h-6 w-6"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.();
        }}
      >
        <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      </Button>

      <Card
        className={cn(
          "relative transition-all overflow-hidden p-0 gap-0 border-0 hover:shadow-xl hover:border hover:border-primary/50",
          isDragging && "shadow-xl",
          isOver && "ring-2 ring-primary ring-offset-2",
          onPlayerClick && "cursor-pointer"
        )}
        onClick={() => onPlayerClick?.(player)}
      >

        <CardContent className="p-0">
          {/* Player image - starts at top */}
          <div className={cn(
            "relative bg-muted",
            compact ? "aspect-[3/4]" : "aspect-[3/4]"
          )}>
            {player.playerImage ? (
              <Image
                src={player.playerImage}
                alt={player.name}
                fill
                sizes={compact ? "240px" : "400px"}
                className="object-cover"
                quality={95}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className={compact ? "h-8 w-8" : "h-12 w-12"} />
              </div>
            )}

            {/* Team logo - on top of player image */}
            {player.teamImg && (
              <div className={cn(
                "absolute top-2 left-2 z-10",
                compact ? "w-5 h-5" : "w-6 h-6"
              )}>
                <Image
                  src={player.teamImg}
                  alt={player.team}
                  fill
                  className="object-contain drop-shadow-md"
                  quality={95}
                />
              </div>
            )}

            {/* Overall rating - on card, top right */}
            <div
              className={cn(
                "absolute top-2 right-2 z-10 rounded-md shadow-lg",
                compact ? "px-1.5 py-0.5" : "px-2 py-1",
                getRatingClasses(player.overall).bg,
                getRatingClasses(player.overall).shadow
              )}
            >
              <span className={cn(
                "font-bold tabular-nums text-white",
                compact ? "text-sm" : "text-lg"
              )}>
                {player.overall}
              </span>
            </div>

            {/* Gradient overlay at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

            {/* Info section - positioned at bottom of image */}
            <div className={cn(
              "absolute bottom-0 left-0 right-0 z-10",
              compact ? "p-2" : "p-2.5"
            )}>
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
        </CardContent>
      </Card>
    </div>
  );
}

function DroppableEmptySlot({ index, compact = false, lineupId = "lineup1" }: { index: number; compact?: boolean; lineupId?: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${lineupId}-slot-${index}`,
    data: { index, lineupId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all aspect-[3/4]",
        isOver
          ? "border-primary bg-primary/10"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      )}
    >
      <Plus className={cn(
        isOver ? "text-primary" : "text-muted-foreground",
        compact ? "h-5 w-5" : "h-8 w-8"
      )} />
      <p className={cn(
        "text-muted-foreground text-center",
        compact ? "text-[10px]" : "text-sm"
      )}>
        {isOver ? "Drop" : compact ? "Add" : "Drag or click to add"}
      </p>
    </div>
  );
}
