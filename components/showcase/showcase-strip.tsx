"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ShowcaseCard } from "./showcase-card";

/**
 * Landing-page band that previews a few approved projects and links to the
 * full /showcase page. Renders nothing until at least one project is approved,
 * so the landing is never a wall of empty state.
 */
export function ShowcaseStrip() {
  const projects = useQuery(api.showcase.getApprovedProjects, { limit: 3 });

  if (!projects || projects.length === 0) return null;

  return (
    <div className="border-t border-[#e5e2da] px-[clamp(20px,4vw,48px)] py-[clamp(56px,7vw,96px)]">
      <div className="mx-auto max-w-[1360px]">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 font-plex text-[11px] tracking-[0.12em] text-[#8a8577]">
              BUILT WITH NBA2KAPI
            </div>
            <h2 className="mt-0 mb-0 font-display text-[clamp(28px,3.4vw,42px)] font-bold tracking-[-0.02em] text-[#1a1918]">
              Made by the community
            </h2>
          </div>
          <Link
            href="/showcase"
            className="rounded-full border border-[#d9d4c7] bg-white px-5 py-2.5 text-[13.5px] font-semibold text-[#1a1918] no-underline transition-[background,transform] duration-150 ease-out hover:bg-[#f1efe8] active:scale-[0.97] motion-reduce:transition-none"
          >
            See all →
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
          {projects.map((p) => (
            <ShowcaseCard key={p._id} project={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
