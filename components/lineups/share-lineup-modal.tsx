"use client";

import * as React from "react";
import Image from "next/image";
import html2canvas from "html2canvas-pro";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRatingClasses } from "@/lib/rating-colors";
import { Download, Copy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Player } from "@/types/player";

interface ShareLineupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineup1: (Player | undefined)[];
  lineup2?: (Player | undefined)[];
  lineup1Name: string;
  lineup2Name: string;
  showLineup2: boolean;
}

export function ShareLineupModal({
  open,
  onOpenChange,
  lineup1,
  lineup2,
  lineup1Name,
  lineup2Name,
  showLineup2,
}: ShareLineupModalProps) {
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleDownload = async () => {
    if (!previewRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.download = `${lineup1Name}-lineup.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          toast.success("Lineup image downloaded!");
        }
      });
    } catch (error) {
      // Error handled via toast
      toast.error("Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!previewRef.current) return;

    setIsGenerating(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            toast.success("Lineup image copied to clipboard!");
          } catch (err) {
            toast.error("Failed to copy to clipboard");
          }
        }
      });
    } catch (error) {
      // Error handled via toast
      toast.error("Failed to generate image");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share Your Lineup</DialogTitle>
          <DialogDescription>
            Download or copy your lineup image to share with others
          </DialogDescription>
        </DialogHeader>

        {/* Preview Section - This gets captured */}
        <div
          ref={previewRef}
          className="bg-background p-8 rounded-lg border"
        >
          {/* Lineup 1 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: "oklch(0.646 0.222 41.116)" }}
              />
              <h3 className="text-xl font-bold">{lineup1Name}</h3>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {lineup1.map((player, index) => (
                <PlayerCardPreview key={index} player={player} />
              ))}
            </div>
          </div>

          {/* Lineup 2 */}
          {showLineup2 && lineup2 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "oklch(0.6 0.118 184.704)" }}
                />
                <h3 className="text-xl font-bold">{lineup2Name}</h3>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {lineup2.map((player, index) => (
                  <PlayerCardPreview key={index} player={player} />
                ))}
              </div>
            </div>
          )}

          {/* Branding */}
          <div className="text-center text-sm text-muted-foreground mt-6">
            Created with NBA 2K Lineup Builder
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={isGenerating}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button onClick={handleDownload} disabled={isGenerating}>
            <Download className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Download Image"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Preview card component for share image
function PlayerCardPreview({ player }: { player: Player | undefined }) {
  if (!player) {
    return (
      <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
        <User className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] bg-muted rounded-lg overflow-hidden">
      {/* Player Image */}
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

      {/* Team Logo */}
      {player.teamImg && (
        <div className="absolute top-1 left-1 z-10 w-4 h-4">
          <Image
            src={player.teamImg}
            alt={player.team}
            fill
            className="object-contain drop-shadow-md"
          />
        </div>
      )}

      {/* Overall Rating */}
      <div
        className={cn(
          "absolute top-1 right-1 z-10 w-5 h-5 rounded flex items-center justify-center shadow-lg",
          getRatingClasses(player.overall).bg,
          getRatingClasses(player.overall).shadow
        )}
      >
        <span className="text-[10px] font-bold tabular-nums text-white">
          {player.overall}
        </span>
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      {/* Player Info */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 z-10">
        <div className="min-w-0">
          {/* Position Badges */}
          <div className="flex gap-0.5 mb-0.5">
            {player.positions?.slice(0, 2).map((pos, idx) => (
              <Badge
                key={`${pos}-${idx}`}
                variant="secondary"
                className="text-[6px] px-0.5 py-0 h-3 bg-white/20 text-white border-0"
              >
                {pos}
              </Badge>
            ))}
          </div>
          <p className="font-bold text-[9px] text-white truncate drop-shadow-sm">
            {player.name}
          </p>
          <p className="text-[7px] text-white/80 truncate">
            {player.team}
          </p>
        </div>
      </div>
    </div>
  );
}
