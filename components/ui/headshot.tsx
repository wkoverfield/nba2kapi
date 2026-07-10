"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type HeadshotProps = {
  src: string | null | undefined;
  name: string;
  /** Rendered size in px (square). */
  size: number;
  className?: string;
};

/**
 * Circular player headshot with a monogram fallback when the image is missing
 * or 404s upstream (some scraped 2kratings URLs are stale). Served through the
 * Next image optimizer because 2kratings blocks hotlinking.
 */
export function Headshot({ src, name, size, className }: HeadshotProps) {
  const [errored, setErrored] = useState(false);
  const showImage = src && !errored;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f1efe8] font-display font-extrabold text-[#57534a]",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.36)) }}
    >
      {showImage ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes={`${size}px`}
          className="object-cover object-top"
          onError={() => setErrored(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
