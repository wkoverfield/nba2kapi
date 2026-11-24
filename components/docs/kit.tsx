"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { fillApiKey, useStoredApiKey } from "@/lib/stored-api-key";

/** Docs building blocks for the paper/editorial reskin. */

export function MethodBadge({ method = "GET" }: { method?: string }) {
  return (
    <span className="rounded-[6px] bg-[#eaf5ee] dark:bg-[#16261c] px-[9px] py-1 font-plex text-[10px] font-bold text-pos">
      {method}
    </span>
  );
}

export function EndpointHeader({
  method = "GET",
  path,
  title,
  children,
}: {
  method?: string;
  path: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <MethodBadge method={method} />
        <span className="font-plex text-[16px] font-semibold">{path}</span>
      </div>
      <h1 className="mt-3.5 mb-0 font-display text-[clamp(24px,2.6vw,28px)] font-extrabold tracking-[-0.03em]">
        {title}
      </h1>
      {children && (
        <div className="mt-2 text-[14px] leading-[1.6] text-ink-2 [&_a]:font-semibold [&_a]:text-ink">
          {children}
        </div>
      )}
    </div>
  );
}

export function AuthPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5">
      <Lock className="h-[11px] w-[11px] text-warn" strokeWidth={2} />
      <span className="font-plex text-[9.5px] text-ink-2">{children}</span>
    </div>
  );
}

export function DocLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[26px] mb-2.5 font-plex text-[9.5px] tracking-[0.12em] text-ink-3">
      {children}
    </div>
  );
}

export function DocH1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="m-0 font-display text-[clamp(24px,2.6vw,28px)] font-extrabold tracking-[-0.03em]">
      {children}
    </h1>
  );
}

export function DocP({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 mb-0 text-[14px] leading-[1.65] text-ink-2 [&_a]:font-semibold [&_a]:text-ink [&_code]:rounded-[5px] [&_code]:border [&_code]:border-line [&_code]:bg-surface [&_code]:px-[5px] [&_code]:py-px [&_code]:font-plex [&_code]:text-[11.5px] [&_code]:text-ink">
      {children}
    </p>
  );
}

export function FinePrint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3.5 mb-0 font-plex text-[8.5px] text-ink-4">{children}</p>;
}

export type ParamRow = {
  name: string;
  type: string;
  desc: React.ReactNode;
  isNew?: boolean;
};

export function ParamsTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
      {rows.map((p) => (
        <div
          key={p.name}
          className="grid grid-cols-[minmax(140px,200px)_1fr] gap-3.5 border-b border-line-faint px-[18px] py-3 last:border-b-0"
        >
          <div>
            <div className="flex flex-wrap items-center gap-[7px]">
              <span className="font-plex text-[11px] font-bold break-all">{p.name}</span>
              {p.isNew && (
                <span className="rounded-[4px] bg-[#f6e9c8] dark:bg-[#33290f] px-[5px] py-0.5 font-plex text-[7px] font-bold tracking-[0.08em] text-warn">
                  NEW
                </span>
              )}
            </div>
            <div className="mt-[3px] font-plex text-[8.5px] text-ink-4">{p.type}</div>
          </div>
          <div className="m-0 text-[12.5px] leading-[1.55] text-ink-2 [&_code]:font-plex [&_code]:text-[11px] [&_code]:text-ink">
            {p.desc}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DarkCode({
  title,
  right,
  children,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[14px] tone-fixed bg-panel">
      {(title || right) && (
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="font-plex text-[9px] tracking-[0.1em] text-white/60">{title}</span>
          {right}
        </div>
      )}
      <pre className="m-0 overflow-x-auto px-4 py-3.5 font-plex text-[10px] leading-[1.7] text-white/85">
        {children}
      </pre>
    </div>
  );
}

export function CodeRail({
  samples,
  response,
  playgroundHref,
}: {
  samples: { label: string; code: string }[];
  response?: React.ReactNode;
  playgroundHref?: string;
}) {
  const [lang, setLang] = useState(0);
  const [copied, setCopied] = useState(false);
  const storedKey = useStoredApiKey();
  const code = fillApiKey(samples[lang].code, storedKey);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-hidden rounded-[14px] tone-fixed bg-panel">
        <div className="flex items-center border-b border-white/10">
          {samples.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setLang(i)}
              className={cn(
                "cursor-pointer px-[13px] py-2 font-plex text-[9px] transition-colors duration-150 select-none hover:text-on-ink",
                i === lang ? "bg-surface/12 text-on-ink" : "text-white/55"
              )}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={copy}
            className="ml-auto cursor-pointer px-[13px] py-2 font-plex text-[8.5px] text-white/60 transition-colors duration-150 hover:text-on-ink"
          >
            {copied ? "COPIED ✓" : "COPY"}
          </button>
        </div>
        <pre className="m-0 overflow-x-auto px-4 py-3.5 font-plex text-[10px] leading-[1.7] text-white/85">
          {code}
        </pre>
      </div>

      {response && (
        <DarkCode
          title="RESPONSE"
          right={<span className="font-plex text-[8.5px] text-[#6ee7a0]">200 OK</span>}
        >
          {response}
        </DarkCode>
      )}

      {playgroundHref && (
        <Link
          href={playgroundHref}
          className="flex items-center justify-center gap-2 rounded-full border border-ink bg-surface py-2.5 text-[12.5px] font-semibold text-ink no-underline transition-[background,transform] duration-150 hover:bg-soft active:scale-[0.98] motion-reduce:transition-none"
        >
          <Play className="h-3 w-3" strokeWidth={2} />
          Run this in the playground
        </Link>
      )}
    </div>
  );
}

/** Two-column page body: prose (left) + sticky code rail (right). */
export function DocColumns({
  children,
  rail,
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-[clamp(20px,3vw,32px)]">
      <div className="min-w-[min(100%,380px)] flex-[1_1_420px]">{children}</div>
      {rail && (
        <div className="sticky top-5 max-w-[420px] min-w-[min(100%,320px)] flex-[1_1_340px]">
          {rail}
        </div>
      )}
    </div>
  );
}
