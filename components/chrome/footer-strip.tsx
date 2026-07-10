import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Compact one-line footer used by data-dense reskinned pages (Playground,
 * Board, Whiteboard). Marketing-weight pages use SiteFooter instead.
 */
export function FooterStrip({ wide = false }: { wide?: boolean }) {
  return (
    <div className="border-t border-[#e5e2da] bg-[#f5f3ec]">
      <div
        className={cn(
          "mx-auto flex flex-wrap items-center justify-between gap-2.5 px-[clamp(20px,4vw,48px)] py-[18px] font-plex text-[11px] text-[#8a8577]",
          wide ? "max-w-[1440px]" : "max-w-[1360px]"
        )}
      >
        <span className="font-display text-[15px] font-extrabold text-[#1a1918]">nba2kapi</span>
        <span>Data from 2kratings.com · Not affiliated with 2K Sports or the NBA</span>
        <Link
          href="/docs"
          className="text-[#57534a] no-underline transition-colors duration-150 hover:text-[#1a1918]"
        >
          API Docs →
        </Link>
      </div>
    </div>
  );
}
