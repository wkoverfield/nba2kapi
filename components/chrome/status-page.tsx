import type { ReactNode } from "react";
import { TopNav } from "@/components/chrome/top-nav";
import { SiteFooter } from "@/components/chrome/site-footer";

export const STATUS_PRIMARY_ACTION =
  "cursor-pointer whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-on-ink no-underline transition-[background,transform] duration-150 ease-out hover:bg-ink-hover active:scale-[0.97] motion-reduce:transition-none";

export const STATUS_SECONDARY_ACTION =
  "cursor-pointer whitespace-nowrap rounded-full border border-line bg-surface px-4 py-[9px] text-[13px] font-semibold text-ink no-underline transition-[border-color,transform] duration-150 ease-out hover:border-ink active:scale-[0.97] motion-reduce:transition-none";

type StatusPageProps = {
  /** Mono eyebrow above the title, e.g. "404 · NOT FOUND". */
  label: string;
  title: string;
  description: string;
  /** Links or buttons, styled with the STATUS_*_ACTION classes. */
  actions: ReactNode;
  /** Small mono line under the actions, e.g. an error reference. */
  footnote?: ReactNode;
};

/**
 * Full-page shell for the app-level not-found and error states: the shared
 * nav and footer around a short message and a row of actions.
 */
export function StatusPage({ label, title, description, actions, footnote }: StatusPageProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,var(--paper-top),var(--paper)_420px)] font-body text-ink">
      <TopNav />
      <div className="mx-auto min-h-screen max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2 pb-16">
        <div className="pt-[clamp(40px,9vw,112px)] animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          <div className="mb-3 font-plex text-[11px] tracking-[0.12em] text-ink-3">{label}</div>
          <h1 className="m-0 font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="mt-3.5 mb-0 max-w-[520px] text-[15px] leading-[1.6] text-ink-2">
            {description}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">{actions}</div>
          {footnote && (
            <div className="mt-6 font-plex text-[10.5px] tracking-[0.04em] text-ink-4">
              {footnote}
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
