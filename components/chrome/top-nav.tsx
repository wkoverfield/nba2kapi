"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Playground", href: "/playground" },
  { label: "Teams", href: "/teams" },
  { label: "Lineups", href: "/lineups" },
  { label: "Docs", href: "/docs" },
];

const GITHUB_REPO = "wkoverfield/nba2kapi";

function useGitHubStars(repo: string) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
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
  /** Swaps the CTA label for returning users who already hold a key. */
  hasApiKey?: boolean;
  /** Page shell width: narrow 1280 (Board), default 1360, wide 1440 (Playground). */
  width?: "narrow" | "default" | "wide";
};

export const SHELL_WIDTHS = {
  narrow: "max-w-[1280px]",
  default: "max-w-[1360px]",
  wide: "max-w-[1440px]",
} as const;

/**
 * Shared chrome for reskinned (paper/editorial) pages: wordmark, pill nav,
 * search pill, GitHub star chip, and the primary API-key CTA.
 */
export function TopNav({ onCtaClick, hasApiKey = false, width = "default" }: TopNavProps) {
  const ctaLabel = hasApiKey ? "View dashboard" : "Get an API key";
  const pathname = usePathname();
  const router = useRouter();
  const stars = useGitHubStars(GITHUB_REPO);

  // Until the global command palette ships, ⌘K and the search pill route to
  // the Playground, where full player search lives.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "k") return;
      // Don't steal the shortcut while the user is typing (e.g. the
      // registration dialog's form fields).
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      e.preventDefault();
      router.push("/playground");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const ctaClasses =
    "rounded-full bg-[#1a1918] px-5 py-2.5 text-[13.5px] font-semibold text-[#faf9f5] no-underline transition-[background,transform] duration-150 ease-out hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none";

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-wrap items-center justify-between gap-3 px-[clamp(20px,4vw,48px)] py-5",
        SHELL_WIDTHS[width]
      )}
    >
      <Link
        href="/"
        className="font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#1a1918] no-underline"
      >
        nba2kapi
      </Link>

      <nav
        aria-label="Main navigation"
        className="flex items-center gap-1 rounded-full border border-[#e5e2da] bg-white p-[5px]"
      >
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-4 py-[7px] text-[13.5px] font-medium text-[#1a1918] no-underline transition-[background,transform] duration-150 ease-out hover:bg-[#f1efe8] active:scale-[0.97] motion-reduce:transition-none",
              pathname.startsWith(link.href) && "bg-[#f1efe8]"
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => router.push("/playground")}
          title="Search everything — players, teams, badges"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#e5e2da] bg-white px-3.5 py-[9px] transition-[border-color,transform] duration-150 ease-out hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
        >
          <Search className="h-[13px] w-[13px] text-[#57534a]" strokeWidth={2} />
          <span className="text-[12.5px] text-[#8a8577]">Search</span>
          <span className="rounded-[5px] border border-[#e5e2da] bg-[#faf9f5] px-[5px] py-[2px] font-plex text-[9px] text-[#b5b0a1]">
            ⌘K
          </span>
        </button>

        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Star on GitHub"
          className="inline-flex items-center gap-2 rounded-full border border-[#e5e2da] bg-white px-4 py-[9px] text-[13px] font-semibold text-[#1a1918] no-underline transition-[border-color,transform] duration-150 ease-out hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
        >
          <OctocatIcon />
          {stars ?? "★"}
        </a>

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
  );
}
