"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { CommandPalette } from "@/components/chrome/command-palette";
import { cn } from "@/lib/utils";
import { SHELL_WIDTH } from "@/components/chrome/shell-widths";
import { useStoredApiKey } from "@/lib/stored-api-key";

const NAV_LINKS = [
  { label: "Playground", href: "/playground" },
  { label: "Teams", href: "/teams" },
  { label: "Lineups", href: "/lineups" },
  { label: "Docs", href: "/docs" },
];

const GITHUB_REPO = "wkoverfield/nba2kapi";

// TopNav remounts on every route change. Remembering the count at module
// scope lets the next mount render it on its first frame instead of showing
// the placeholder again. Empty on a hard load, so hydration still matches.
let lastKnownStars: number | null = null;

function useGitHubStars(repo: string) {
  const [stars, setStarsState] = useState<number | null>(lastKnownStars);

  useEffect(() => {
    const setStars = (count: number) => {
      lastKnownStars = count;
      setStarsState(count);
    };
    // Shares the sessionStorage cache with components/github-stars.tsx
    const cached = sessionStorage.getItem(`github-stars-${repo}`);
    if (cached) {
      const { count, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 3600000) {
        setStars(count);
        return;
      }
    }
    fetch(`https://api.github.com/repos/${repo}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.stargazers_count !== undefined) {
          setStars(data.stargazers_count);
          sessionStorage.setItem(
            `github-stars-${repo}`,
            JSON.stringify({ count: data.stargazers_count, timestamp: Date.now() })
          );
        }
      })
      .catch(() => {});
  }, [repo]);

  return stars;
}

function OctocatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

type TopNavProps = {
  /** Override the primary CTA's default link-to-dashboard behavior. */
  onCtaClick?: () => void;
  /**
   * Forces the returning-user CTA label. The nav already detects a key saved
   * in this browser; pass this only for a key the page knows about sooner.
   */
  hasApiKey?: boolean;
  /** Signed-in chip: masked key ("2k_••••xB7q") shown next to the CTA. */
  maskedKey?: string | null;
};

/**
 * Shared chrome for reskinned (paper/editorial) pages: wordmark, pill nav,
 * search pill, GitHub star chip, and the primary API-key CTA. It is one row
 * from `md` up and two rows below that: wordmark and actions, then the nav
 * pill at full width. Search is icon-only below `sm` and from `md` to `lg`,
 * the star chip is hidden at those same widths, and the key chip shows from
 * `lg`.
 *
 * The bar is the same width on every page (SHELL_WIDTH), so the wordmark and
 * nav hold their position across route changes.
 */
export function TopNav({
  onCtaClick,
  hasApiKey: hasApiKeyProp = false,
  maskedKey = null,
}: TopNavProps) {
  const storedKey = useStoredApiKey();
  const hasApiKey = hasApiKeyProp || !!storedKey;
  const ctaLabel = hasApiKey ? "View dashboard" : "Get an API key";
  const pathname = usePathname();
  const stars = useGitHubStars(GITHUB_REPO);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const updateCompactState = () => {
      setIsCompact((compact) => {
        if (!compact && window.scrollY > 40) return true;
        if (compact && window.scrollY < 8) return false;
        return compact;
      });
    };

    const initialFrame = window.requestAnimationFrame(updateCompactState);
    window.addEventListener("scroll", updateCompactState, { passive: true });
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.removeEventListener("scroll", updateCompactState);
    };
  }, []);

  // ⌘K / Ctrl+K opens the global command palette (a modal, so it's safe to
  // fire even while an input has focus).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setPaletteOpen((o) => !o);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ctaClasses =
    "whitespace-nowrap rounded-full bg-ink px-3.5 py-[9px] text-[13px] font-semibold sm:px-5 sm:py-2.5 sm:text-[13.5px] text-on-ink no-underline transition-[background,transform] duration-150 ease-out hover:bg-ink-hover active:scale-[0.97] motion-reduce:transition-none";

  return (
    <header
      className="pointer-events-none sticky top-0 z-40"
      data-compact={isCompact ? "true" : "false"}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 origin-top border-b border-line/80 bg-paper/92 shadow-[0_10px_30px_-24px_rgba(26,25,24,0.45)] backdrop-blur-xl transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transform-none motion-reduce:transition-opacity",
          isCompact ? "opacity-100 md:scale-y-[0.76]" : "scale-y-100 opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-auto relative mx-auto flex w-full origin-top flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-[clamp(20px,4vw,48px)] py-3 sm:gap-3 md:py-5 md:grid md:grid-cols-[1fr_auto_1fr] transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transform-none motion-reduce:transition-none",
          isCompact && "md:-translate-y-[7px] md:scale-[0.96]",
          SHELL_WIDTH
        )}
      >
        <Link
          href="/"
          className="justify-self-start font-display text-[20px] font-extrabold sm:text-[22px] tracking-[-0.02em] text-ink no-underline"
        >
          nba2kapi
        </Link>

        <nav
          aria-label="Main navigation"
          className="order-last flex w-full max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-surface p-1 sm:gap-1 sm:p-[5px] md:order-none md:w-auto"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex-1 shrink-0 rounded-full px-1.5 py-[7px] text-center text-[13px] font-medium text-ink no-underline transition-[background,transform] duration-150 ease-out hover:bg-soft active:scale-[0.97] sm:text-[13.5px] md:flex-none md:px-3 lg:px-4 motion-reduce:transition-none",
                pathname.startsWith(link.href) && "bg-soft"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 justify-self-end sm:gap-2.5">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            title="Search players, teams, badges, and queries"
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-[11px] py-[11px] sm:px-3.5 sm:py-[9px] md:px-[11px] md:py-[11px] lg:px-3.5 lg:py-[9px] transition-[border-color,transform] duration-150 ease-out hover:border-ink active:scale-[0.97] motion-reduce:transition-none"
          >
            <Search className="h-[13px] w-[13px] text-ink-2" strokeWidth={2} />
            <span className="hidden text-[12.5px] text-ink-3 sm:inline md:hidden lg:inline">Search</span>
            <span className="hidden rounded-[5px] border border-line bg-paper px-[5px] py-[2px] font-plex text-[9px] text-ink-4 sm:inline md:hidden lg:inline">
              ⌘K
            </span>
          </button>

          <a
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Star on GitHub"
            className="hidden items-center gap-2 rounded-full border border-line bg-surface px-4 py-[9px] text-[13px] font-semibold text-ink no-underline transition-[border-color,transform] duration-150 ease-out hover:border-ink active:scale-[0.97] sm:inline-flex md:hidden lg:inline-flex motion-reduce:transition-none"
          >
            <OctocatIcon />
            <span className="tabular-nums">{stars ?? "★"}</span>
          </a>

          {maskedKey && (
            <span className="hidden items-center gap-[7px] rounded-full border border-line bg-surface px-3.5 py-2 font-plex text-[10px] text-ink-2 lg:inline-flex">
              <span className="h-[7px] w-[7px] rounded-full bg-pos" />
              {maskedKey}
            </span>
          )}
          {onCtaClick ? (
            <button type="button" onClick={onCtaClick} className={cn(ctaClasses, "cursor-pointer")}>
              {ctaLabel}
            </button>
          ) : (
            <Link href="/dashboard" className={ctaClasses}>
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
