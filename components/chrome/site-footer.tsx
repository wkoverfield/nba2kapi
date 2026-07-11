import Link from "next/link";

const FOOTER_LINK =
  "text-[13.5px] text-[#57534a] no-underline transition-colors duration-150 hover:text-[#1a1918]";

const COLUMN_LABEL =
  "mb-3.5 font-plex text-[11px] tracking-[0.12em] text-[#8a8577]";

/**
 * Shared footer for reskinned (paper/editorial) pages.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-[#e5e2da] bg-[#f5f3ec]">
      <div className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-14 pb-10">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10">
          <div>
            <div className="mb-3 font-display text-[19px] font-extrabold tracking-[-0.02em] text-[#1a1918]">
              nba2kapi
            </div>
            <p className="mb-4 max-w-[260px] text-[13.5px] leading-[1.6] text-[#8a8577]">
              Access NBA 2K player ratings and team data via REST API.
            </p>
            <p className="text-[11.5px] leading-[1.7] text-[#b5b0a1]">
              Data sourced from 2kratings.com.
              <br />
              Not affiliated with 2K Sports or the NBA.
            </p>
          </div>

          <div>
            <div className={COLUMN_LABEL}>EXPLORE</div>
            <div className="flex flex-col gap-[9px]">
              <Link href="/playground" className={FOOTER_LINK}>
                Playground
              </Link>
              <Link href="/teams" className={FOOTER_LINK}>
                Teams
              </Link>
              <Link href="/lineups" className={FOOTER_LINK}>
                Lineups
              </Link>
              <Link href="/badges" className={FOOTER_LINK}>
                Badge explorer
              </Link>
              <Link href="/playground" className={FOOTER_LINK}>
                Player dossiers
              </Link>
            </div>
          </div>

          <div>
            <div className={COLUMN_LABEL}>DEVELOPERS</div>
            <div className="flex flex-col gap-[9px]">
              <Link href="/docs" className={FOOTER_LINK}>
                API Documentation
              </Link>
              <Link href="/dashboard" className={FOOTER_LINK}>
                Dashboard
              </Link>
              <Link href="/docs/authentication" className={FOOTER_LINK}>
                Authentication
              </Link>
              <Link href="/docs/rate-limits" className={FOOTER_LINK}>
                Rate limiting
              </Link>
            </div>
          </div>

          <div>
            <div className={COLUMN_LABEL}>RESOURCES</div>
            <div className="flex flex-col gap-[9px]">
              <a
                href="https://github.com/wkoverfield/nba2kapi"
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK}
              >
                Star on GitHub
              </a>
              <a
                href="https://buymeacoffee.com/wkoverfield"
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK}
              >
                Buy me a coffee
              </a>
              <Link href="/feedback" className={FOOTER_LINK}>
                Feedback
              </Link>
              <a
                href="https://2kratings.com"
                target="_blank"
                rel="noopener noreferrer"
                className={FOOTER_LINK}
              >
                2K Ratings source
              </a>
            </div>
          </div>
        </div>

        <div className="mt-11 flex flex-wrap items-center justify-between gap-2.5 border-t border-[#e5e2da] pt-5 font-plex text-[11.5px] text-[#8a8577]">
          <span>Built with Next.js, Convex, and Playwright</span>
          <a
            href="https://github.com/wkoverfield"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8a8577] no-underline transition-colors duration-150 hover:text-[#1a1918]"
          >
            github.com/wkoverfield
          </a>
        </div>
      </div>
    </footer>
  );
}
