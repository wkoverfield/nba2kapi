"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { KeyDialog } from "@/components/chrome/key-dialog";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

const CARD_LABEL = "font-plex text-[9px] tracking-[0.1em] text-[#8a8577]";

function maskKey(key: string) {
  return `2k_••••${key.slice(-4)}`;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "NOW";
  if (mins < 60) return `${mins}M AGO`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}H AGO`;
  return `${Math.floor(hours / 24)}D AGO`;
}

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

function statusColor(code: number) {
  if (code >= 200 && code < 300) return "#0a7f3f";
  if (code === 429) return "#9a6700";
  if (code >= 400) return "#c03a2b";
  return "#8a8577";
}

/** Map an API endpoint back into the product surface that shows the same data. */
function deepLink(endpoint: string): { href: string; label: string } | null {
  const [path, query] = endpoint.split("?");
  const slugMatch = path.match(/^\/api\/players\/slug\/([a-z0-9-]+)/);
  if (slugMatch) return { href: `/players/${slugMatch[1]}`, label: "→ DOSSIER" };
  const rosterMatch = path.match(/^\/api\/teams\/([^/]+)\/roster/);
  if (rosterMatch) {
    const slug = decodeURIComponent(rosterMatch[1]).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return { href: `/teams/${slug}`, label: "→ TEAM" };
  }
  if (path === "/api/teams") return { href: "/teams", label: "→ BOARD" };
  if (path.startsWith("/api/players")) {
    const passthrough = new URLSearchParams();
    if (query) {
      const params = new URLSearchParams(query);
      for (const k of ["position", "era", "three_ball_gte", "sort", "team"]) {
        const v = params.get(k);
        if (v) passthrough.set(k, v);
      }
    }
    const qs = passthrough.toString();
    return { href: qs ? `/playground?${qs}` : "/playground", label: "→ PLAYGROUND" };
  }
  return null;
}

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const regenerateApiKey = useMutation(api.apiKeys.regenerateApiKey);
  const stats = useQuery(api.apiKeys.getApiKeyStats, apiKey ? { key: apiKey } : "skip");

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) setApiKey(stored);
    else setShowDialog(true);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  const resetsInMin = useMemo(() => {
    if (!stats?.resetAt) return null;
    return Math.max(0, Math.ceil((new Date(stats.resetAt).getTime() - now) / 60000));
  }, [stats?.resetAt, now]);

  const copyKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  const copyCurl = () => {
    if (!apiKey) return;
    navigator.clipboard
      .writeText(`curl -H "X-API-Key: ${apiKey}" https://api.nba2kapi.com/api/players?minRating=95`)
      .then(() => toast.success("curl command copied"));
  };

  const handleRegenerate = async () => {
    if (!apiKey) return;
    if (!window.confirm("Regenerate your key? The current key stops working immediately.")) return;
    try {
      const result = await regenerateApiKey({ oldKey: apiKey });
      localStorage.setItem(API_KEY_STORAGE_KEY, result.apiKey);
      setApiKey(result.apiKey);
      setReveal(true);
      toast.success("New key issued — the old one is dead. It's revealed above; copy it now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate the key");
    }
  };

  const usagePct = stats ? Math.min(100, Math.round((stats.requestCount / stats.rateLimit) * 100)) : 0;

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <TopNav
        hasApiKey={!!apiKey}
        maskedKey={mounted && apiKey ? maskKey(apiKey) : null}
        width="narrow"
      />

      <div className="mx-auto max-w-[1280px] px-[clamp(20px,4vw,48px)] pt-2">
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          <div>
            <h1 className="m-0 font-display text-[clamp(28px,3.2vw,36px)] font-extrabold tracking-[-0.03em]">
              Dashboard
            </h1>
            <p className="mt-1.5 mb-0 font-plex text-[9.5px] tracking-[0.1em] text-[#8a8577]">
              {stats
                ? `KEY CREATED ${formatDate(stats.apiKey.createdAt)} · FREE TIER · ${stats.rateLimit} REQ/HR`
                : apiKey
                  ? "LOADING KEY…"
                  : "NO KEY IN THIS BROWSER YET"}
            </p>
          </div>
          {apiKey && (
            <button
              type="button"
              onClick={handleRegenerate}
              className="cursor-pointer font-plex text-[9.5px] tracking-[0.06em] text-[#c03a2b] hover:underline"
            >
              ↻ REGENERATE KEY
            </button>
          )}
        </div>

        {!mounted || (!apiKey && !showDialog) ? null : !apiKey ? (
          <div className="mt-16 mb-24 text-center">
            <h2 className="m-0 font-display text-[24px] font-extrabold tracking-[-0.02em]">
              The key is the login
            </h2>
            <p className="mx-auto mt-2 mb-6 max-w-[380px] text-[13.5px] leading-[1.6] text-[#57534a]">
              No account, no password. Create a free key and this browser becomes your dashboard.
            </p>
            <button
              type="button"
              onClick={() => setShowDialog(true)}
              className="cursor-pointer rounded-full bg-[#1a1918] px-7 py-3.5 text-[15px] font-semibold text-[#faf9f5] transition-[background,transform] duration-150 hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
            >
              Get an API key
            </button>
          </div>
        ) : (
          <>
            {/* Cards */}
            <div
              className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
              style={{ animationDelay: "60ms" }}
            >
              <div className="flex min-w-0 flex-col justify-between rounded-[14px] bg-[#1a1918] px-[18px] py-4">
                <div className="flex items-center justify-between">
                  <span className="font-plex text-[9px] tracking-[0.1em] text-white/60">
                    YOUR API KEY
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      title={reveal ? "Mask the key" : "Reveal the key"}
                      className="cursor-pointer text-white/70 transition-colors duration-150 hover:text-white"
                    >
                      <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={copyKey}
                      title="Copy the key"
                      className="cursor-pointer text-white/70 transition-colors duration-150 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 overflow-hidden font-plex text-[14px] text-ellipsis whitespace-nowrap text-[#faf9f5]">
                  {copied ? "COPIED TO CLIPBOARD ✓" : reveal ? apiKey : `2k_${"•".repeat(25)}${apiKey.slice(-4)}`}
                </div>
                <div className="mt-2 font-plex text-[8px] text-white/45">
                  {reveal ? "CLICK THE EYE TO MASK AGAIN" : "SEND IT IN THE X-API-KEY HEADER"}
                </div>
              </div>

              <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-4">
                <div className={CARD_LABEL}>THIS HOUR</div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-display text-[32px] leading-none font-extrabold">
                    {stats?.requestCount ?? "—"}
                  </span>
                  <span className="font-plex text-[11px] text-[#8a8577]">
                    / {stats?.rateLimit ?? "—"}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-[#f1efe8]">
                  <div
                    className="h-full rounded-full bg-[#1a1918] transition-[width] duration-400"
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <div className="mt-2 font-plex text-[8px] text-[#b5b0a1]">
                  {resetsInMin !== null ? `RESETS IN ${resetsInMin} MIN` : "…"}
                </div>
              </div>

              <div className="rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-4">
                <div className={CARD_LABEL}>ALL TIME</div>
                <div className="mt-2 font-display text-[32px] leading-none font-extrabold">
                  {stats ? stats.totalRequests.toLocaleString() : "—"}
                </div>
                <div className="mt-2.5 font-plex text-[8px] text-[#b5b0a1]">
                  {stats ? `REQUESTS SINCE ${formatDate(stats.apiKey.createdAt)}` : "…"}
                </div>
              </div>
            </div>

            {/* Recent requests */}
            <div
              className="mt-3.5 overflow-hidden rounded-[14px] border border-[#e5e2da] bg-white animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
              style={{ animationDelay: "120ms" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f1efe8] px-[18px] py-3">
                <span className="font-plex text-[9.5px] tracking-[0.12em] text-[#8a8577]">
                  RECENT REQUESTS — LAST 10
                </span>
                <span className="font-plex text-[8.5px] text-[#b5b0a1]">
                  ROWS LINK BACK INTO THE PRODUCT
                </span>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {stats?.recentRequests.length ? (
                    stats.recentRequests.map((r, i) => {
                      const link = deepLink(r.endpoint);
                      const row = (
                        <>
                          <span className="font-plex text-[8.5px] text-[#b5b0a1]">
                            {timeAgo(r.timestamp)}
                          </span>
                          <span className="font-plex text-[9px] font-bold text-[#57534a]">
                            {r.method}
                          </span>
                          <span className="overflow-hidden font-plex text-[10.5px] text-ellipsis whitespace-nowrap">
                            {r.endpoint}
                          </span>
                          <span
                            className="font-plex text-[10px] font-bold"
                            style={{ color: statusColor(r.statusCode) }}
                          >
                            {r.statusCode}
                          </span>
                          <span className="text-right font-plex text-[9.5px] text-[#8a8577]">
                            {r.responseTime}MS
                          </span>
                          <span className="text-right font-plex text-[8.5px] font-bold text-[#57534a]">
                            {link?.label ?? ""}
                          </span>
                        </>
                      );
                      const rowClass =
                        "grid grid-cols-[70px_44px_minmax(220px,1fr)_46px_60px_140px] items-center gap-3 border-b border-[#faf8f2] px-[18px] py-2 text-[#1a1918] no-underline";
                      return link ? (
                        <Link
                          key={i}
                          href={link.href}
                          className={cn(rowClass, "transition-colors duration-100 hover:bg-[#faf8f2]")}
                        >
                          {row}
                        </Link>
                      ) : (
                        <div key={i} className={rowClass}>
                          {row}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-[18px] py-8 text-center font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]">
                      {stats ? "NO REQUESTS YET — MAKE YOUR FIRST CALL BELOW" : "LOADING…"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* First call strip */}
            <div
              className="my-3.5 mb-12 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border border-[#e5e2da] bg-white px-[18px] py-3.5 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
              style={{ animationDelay: "180ms" }}
            >
              <span className="shrink-0 font-plex text-[9.5px] tracking-[0.1em] text-[#8a8577]">
                FIRST CALL?
              </span>
              <span className="min-w-[200px] flex-1 overflow-hidden font-plex text-[10.5px] text-ellipsis whitespace-nowrap text-[#57534a]">
                curl -H &quot;X-API-Key: {maskKey(apiKey)}&quot;
                api.nba2kapi.com/api/players?minRating=95
              </span>
              <button
                type="button"
                onClick={copyCurl}
                className="shrink-0 cursor-pointer rounded-full border border-[#e5e2da] bg-white px-[13px] py-1.5 text-[11.5px] font-semibold text-[#1a1918] transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.97] motion-reduce:transition-none"
              >
                Copy
              </button>
              <Link
                href="/playground"
                className="shrink-0 rounded-full bg-[#1a1918] px-[13px] py-1.5 text-[11.5px] font-semibold text-[#faf9f5] no-underline transition-[background,transform] duration-150 hover:bg-[#333] active:scale-[0.97] motion-reduce:transition-none"
              >
                Run it in the playground →
              </Link>
            </div>
          </>
        )}
      </div>

      <FooterStrip width="narrow" />

      <KeyDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onSuccess={(key) => setApiKey(key)}
      />
    </div>
  );
}
