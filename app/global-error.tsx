"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors force the full reload that brings the root layout back */

import { useEffect } from "react";
import "./globals.css";
import { fontVariables } from "./fonts";
import {
  STATUS_PRIMARY_ACTION,
  STATUS_SECONDARY_ACTION,
} from "@/components/chrome/status-page";

/**
 * Catches errors thrown by the root layout, which app/error.tsx cannot. It
 * replaces the layout, so it renders its own document and has no providers:
 * nothing here may use Convex, next-themes, or the shared nav and footer.
 * Links are plain anchors so leaving the page reloads the full app.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // No ThemeProvider here, so apply the saved or system theme by hand.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("theme");
    } catch {}
    const dark =
      saved === "dark" ||
      (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} antialiased`}>
        <title>Something went wrong | NBA 2K API</title>
        <div className="min-h-screen bg-[linear-gradient(to_bottom,var(--paper-top),var(--paper)_420px)] font-body text-ink">
          <div className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] py-3 md:py-5">
            <a
              href="/"
              className="inline-block py-[7px] font-display text-[20px] font-extrabold tracking-[-0.02em] text-ink no-underline sm:text-[22px]"
            >
              nba2kapi
            </a>
            <div className="pt-[clamp(40px,9vw,112px)] pb-16">
              <div className="mb-3 font-plex text-[11px] tracking-[0.12em] text-ink-3">ERROR</div>
              <h1 className="m-0 font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
                Something went wrong
              </h1>
              <p className="mt-3.5 mb-0 max-w-[520px] text-[15px] leading-[1.6] text-ink-2">
                The site failed to load. Trying again usually fixes it. If it keeps happening,
                send a note through the feedback page.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <button type="button" onClick={reset} className={STATUS_PRIMARY_ACTION}>
                  Try again
                </button>
                <a href="/" className={STATUS_SECONDARY_ACTION}>
                  Back to home
                </a>
                <a href="/feedback" className={STATUS_SECONDARY_ACTION}>
                  Send feedback
                </a>
              </div>
              {error.digest && (
                <div className="mt-6 font-plex text-[10.5px] tracking-[0.04em] text-ink-4">
                  REFERENCE {error.digest}
                </div>
              )}
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
