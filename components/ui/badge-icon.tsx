"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface BadgeIconProps {
  src: string | null | undefined;
  alt?: string;
  /** Rendered edge length in px; also drives the optimizer's `sizes`. */
  size: number;
  /** Shown instead when the source is missing or fails to load. */
  fallback?: ReactNode;
  className?: string;
}

/**
 * A badge's tier icon, sourced from 2kratings.
 *
 * Falls back when the source is missing or fails to load. 2kratings has
 * renamed badge image files before, which strands stored URLs on a 404 and
 * leaves a broken-image glyph inline with the badge name; degrading to the
 * caller's fallback keeps the badge legible until a scrape repairs the URL.
 */
export function BadgeIcon({ src, alt = "", size, fallback = null, className }: BadgeIconProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <>{fallback}</>;

  return (
    <span
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
