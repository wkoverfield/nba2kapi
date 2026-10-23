"use client";

import { useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Play } from "lucide-react";
import { API_KEY_STORAGE_KEY, CONVEX_SITE_URL, PUBLIC_API_ORIGIN } from "@/lib/constants";
import { cn } from "@/lib/utils";

type KeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (apiKey: string) => void;
};

const FIELD_LABEL = "mb-[5px] font-plex text-[8.5px] tracking-[0.1em] text-[#8a8577]";
const FIELD_INPUT =
  "w-full rounded-[10px] border border-[#e5e2da] bg-[#faf9f5] px-3.5 py-2.5 font-body text-[13.5px] text-[#1a1918] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#b5b0a1] focus:border-[#1a1918] focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,25,24,0.07)]";

const FIRST_CALL_PATH = "/api/players?minRating=95";

const firstCallCurl = (key: string) =>
  `curl -H "X-API-Key: ${key}" "${PUBLIC_API_ORIGIN}${FIRST_CALL_PATH}"`;

type RunResult =
  | { ok: true; status: number; ms: number; total: number; preview: string }
  | { ok: false; status: number | null; message: string };

/** Make the first call from the browser and summarize the response. */
async function runFirstCall(key: string): Promise<RunResult> {
  const started = performance.now();
  try {
    const res = await fetch(`${CONVEX_SITE_URL}${FIRST_CALL_PATH}`, {
      headers: { "X-API-Key": key },
    });
    const json = await res.json();
    const ms = Math.round(performance.now() - started);
    if (!res.ok || !json?.success) {
      return { ok: false, status: res.status, message: json?.error?.message ?? "Request failed" };
    }
    const players: Array<Record<string, unknown>> = json.data ?? [];
    const sample = players.slice(0, 3).map(({ name, overall, team, positions }) => ({
      name,
      overall,
      team,
      positions,
    }));
    return {
      ok: true,
      status: res.status,
      ms,
      total: json.meta?.pagination?.total ?? players.length,
      preview: JSON.stringify(sample, null, 2),
    };
  } catch {
    return { ok: false, status: null, message: "Could not reach the API" };
  }
}

/**
 * Create a key through POST /api/register, which applies the per-IP
 * registration limit. Throws with a user-facing message on any failure.
 */
async function registerKey(body: { email: string; name: string; purpose?: string }) {
  const res = await fetch(`${CONVEX_SITE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error("Could not reach the API. Check your connection and try again.");
  });
  const json = await res.json().catch(() => null);
  if (res.ok && json?.success && typeof json.data?.apiKey === "string") {
    return json.data.apiKey as string;
  }
  if (res.status === 429) {
    throw new Error("Too many keys created from this network. Try again in an hour.");
  }
  if (json?.error?.code === "VALIDATION_ERROR") {
    throw new Error("Check your name and email, then try again.");
  }
  const message = json?.error?.code === "KEY_LIMIT_EXCEEDED" ? json.error.message : null;
  throw new Error(typeof message === "string" ? message : "Failed to create the key. Try again.");
}

/**
 * Two-step key creation modal (paper/editorial design): form, then the key
 * shown in full exactly once. The key is the login — it lands in
 * localStorage and the dashboard remembers the browser.
 */
export function KeyDialog({ open, onOpenChange, onSuccess }: KeyDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const apiKey = await registerKey({ email, name, purpose: purpose || undefined });
      setNewKey(apiKey);
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      onSuccess?.(apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the key. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  const copyCurl = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(firstCallCurl(newKey)).then(() => {
      setCurlCopied(true);
      setTimeout(() => setCurlCopied(false), 1600);
    });
  };

  const runIt = async () => {
    if (!newKey || running) return;
    setRunning(true);
    setRunResult(await runFirstCall(newKey));
    setRunning(false);
  };

  const handleClose = (next: boolean) => {
    if (!next && newKey) {
      setName("");
      setEmail("");
      setPurpose("");
      setNewKey(null);
      setError(null);
      setCopied(false);
      setCurlCopied(false);
      setRunResult(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(26,25,24,0.35)] backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[min(420px,calc(100vw-40px))] -translate-x-1/2 overflow-y-auto -translate-y-1/2 rounded-[18px] border border-[#e5e2da] bg-white px-7 py-[26px] font-body text-[#1a1918] shadow-[0_40px_80px_-24px_rgba(26,25,24,0.5)] animate-[pop-in_220ms_cubic-bezier(0.23,1,0.32,1)_both] focus:outline-none motion-reduce:animate-none">
          {!newKey ? (
            <>
              <Dialog.Title className="m-0 font-display text-[26px] font-extrabold tracking-[-0.03em]">
                Get your key
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 mb-0 text-[13px] leading-[1.5] text-[#57534a]">
                Free. 500 requests an hour. No credit card, no password. The key is your login.
              </Dialog.Description>
              <form onSubmit={handleSubmit} className="mt-[18px] flex flex-col gap-3">
                <div>
                  <div className={FIELD_LABEL}>NAME</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="Will K"
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <div className={FIELD_LABEL}>EMAIL</div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder="will@example.com"
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <div className={FIELD_LABEL}>
                    WHAT ARE YOU BUILDING? <span className="text-[#b5b0a1]">(OPTIONAL)</span>
                  </div>
                  <input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    disabled={loading}
                    placeholder="A fantasy draft tool…"
                    className={FIELD_INPUT}
                  />
                </div>
                {error && (
                  <div className="rounded-[10px] border border-[#c03a2b]/30 bg-[#c03a2b]/5 px-3.5 py-2.5 text-[12.5px] text-[#c03a2b]">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 cursor-pointer rounded-full bg-[#1a1918] py-3 text-center text-[14px] font-semibold text-[#faf9f5] transition-[background,transform] duration-150 select-none hover:bg-[#333] active:scale-[0.98] disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none"
                >
                  {loading ? "Creating…" : "Create my key"}
                </button>
                <p className="m-0 text-center font-plex text-[8px] text-[#b5b0a1]">
                  3 KEYS MAX PER EMAIL · RATE LIMITED BY IP
                </p>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#eaf5ee] text-[#0a7f3f]">
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <Dialog.Title className="m-0 font-display text-[24px] font-extrabold tracking-[-0.03em]">
                  You&apos;re in
                </Dialog.Title>
              </div>
              <div className="mt-4 flex items-center overflow-hidden rounded-[10px] bg-[#1a1918]">
                <span className="flex-1 overflow-hidden px-3.5 py-3 font-plex text-[12px] text-ellipsis whitespace-nowrap text-[#6ee7a0]">
                  {newKey}
                </span>
                <button
                  type="button"
                  onClick={copyKey}
                  className="cursor-pointer border-l border-white/12 px-3.5 py-3 font-plex text-[9.5px] text-white/70 transition-colors duration-150 hover:text-white"
                >
                  {copied ? "COPIED ✓" : "COPY"}
                </button>
              </div>
              <Dialog.Description className="mt-2.5 mb-0 text-[12px] leading-[1.5] text-[#57534a]">
                Saved to this browser, so the dashboard will remember you. Copy it somewhere safe
                too; it&apos;s shown in full only this once.
              </Dialog.Description>
              <div className="mt-[18px] mb-1.5 font-plex text-[8.5px] tracking-[0.1em] text-[#8a8577]">
                YOUR FIRST CALL
              </div>
              <div className="overflow-hidden rounded-[10px] border border-[#e5e2da] bg-[#faf9f5]">
                <pre className="m-0 overflow-x-auto px-3.5 py-[11px] font-plex text-[10.5px] leading-[1.6] break-all whitespace-pre-wrap text-[#57534a]">
                  curl -H &quot;X-API-Key:{" "}
                  <span className="font-bold text-[#1a1918]">{newKey}</span>&quot; \
                  {"\n"}
                  {"  "}&quot;{PUBLIC_API_ORIGIN}
                  {FIRST_CALL_PATH}&quot;
                </pre>
                <div className="flex border-t border-[#e5e2da]">
                  <button
                    type="button"
                    onClick={copyCurl}
                    className="flex-1 cursor-pointer py-2 font-plex text-[9.5px] tracking-[0.06em] text-[#57534a] transition-colors duration-150 hover:bg-white hover:text-[#1a1918]"
                  >
                    {curlCopied ? "COPIED ✓" : "COPY COMMAND"}
                  </button>
                  <button
                    type="button"
                    onClick={runIt}
                    disabled={running}
                    className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-l border-[#e5e2da] py-2 font-plex text-[9.5px] tracking-[0.06em] text-[#0a7f3f] transition-colors duration-150 hover:bg-white disabled:cursor-default disabled:opacity-60"
                  >
                    {running ? (
                      <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Play className="h-3 w-3" strokeWidth={2.5} />
                    )}
                    {running ? "RUNNING…" : runResult ? "RUN AGAIN" : "RUN IT"}
                  </button>
                </div>
              </div>
              {runResult && (
                <div
                  aria-live="polite"
                  className="mt-2 overflow-hidden rounded-[10px] bg-[#1a1918] animate-[rise-in_220ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
                >
                  <div className="flex items-center justify-between border-b border-white/12 px-3.5 py-2 font-plex text-[9px] tracking-[0.06em]">
                    {runResult.ok ? (
                      <>
                        <span className="text-[#6ee7a0]">{runResult.status} OK · YOUR KEY WORKS</span>
                        <span className="text-white/50">
                          {runResult.total} PLAYERS · {runResult.ms} MS
                        </span>
                      </>
                    ) : (
                      <span className="text-[#ff8a7a]">
                        {runResult.status ?? "ERROR"} · {runResult.message.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {runResult.ok && (
                    <pre className="m-0 max-h-[132px] overflow-auto px-3.5 py-2.5 font-plex text-[10px] leading-[1.55] text-white/80">
                      {runResult.preview}
                    </pre>
                  )}
                </div>
              )}
              <div className="mt-3.5 flex gap-2">
                <Link
                  href="/dashboard"
                  onClick={() => handleClose(false)}
                  className="flex-1 cursor-pointer rounded-full bg-[#1a1918] py-2.5 text-center text-[12.5px] font-semibold text-[#faf9f5] no-underline transition-[background,transform] duration-150 select-none hover:bg-[#333] active:scale-[0.98] motion-reduce:transition-none"
                >
                  Go to the dashboard →
                </Link>
                <Link
                  href="/playground"
                  onClick={() => handleClose(false)}
                  className={cn(
                    "flex-1 rounded-full border border-[#e5e2da] bg-white py-2.5 text-center text-[12.5px] font-semibold text-[#1a1918] no-underline transition-[border-color,transform] duration-150 hover:border-[#1a1918] active:scale-[0.98] motion-reduce:transition-none"
                  )}
                >
                  Open playground
                </Link>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
