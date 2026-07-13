"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { ShowcaseCard } from "@/components/showcase/showcase-card";
import { SubmitProjectDialog } from "@/components/showcase/submit-project-dialog";

export default function ShowcasePage() {
  const projects = useQuery(api.showcase.getApprovedProjects, {});

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#fffdf8,#faf9f5_420px)] font-body text-[#1a1918]">
      <TopNav />

      <main className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2 pb-16">
        {/* Header */}
        <div className="pt-8 pb-9">
          <div className="mb-3 font-plex text-[11px] tracking-[0.12em] text-[#8a8577]">
            SHOWCASE
          </div>
          <h1 className="font-display text-[clamp(32px,5vw,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#1a1918]">
            Built with nba2kapi
          </h1>
          <p className="mt-3.5 max-w-[560px] text-[15px] leading-[1.6] text-[#57534a]">
            Apps, bots, league tools, and experiments built on the API. Made something? Add it.
          </p>
          <div className="mt-6">
            <SubmitProjectDialog />
          </div>
        </div>

        {/* Grid */}
        {projects === undefined ? (
          <div className="py-16 text-center text-[14px] text-[#8a8577]">Loading...</div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-[#e5e2da] bg-white py-16 text-center text-[14px] text-[#8a8577]">
            Nothing here yet. Be the first to add a project.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
            {projects.map((p) => (
              <ShowcaseCard key={p._id} project={p} />
            ))}
          </div>
        )}
      </main>

      <FooterStrip />
    </div>
  );
}
