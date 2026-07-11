import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { BadgeExplorerClient } from "./badge-explorer-client";

export const metadata: Metadata = {
  title: "NBA 2K27 Badges — Complete Badge Explorer",
  description: "Explore every NBA 2K27 badge by category and tier, then see exactly which players hold it or run the same filter in the Playground.",
  alternates: { canonical: "/badges" },
};

export default async function BadgesPage() {
  const badges = await fetchQuery(api.badges.getBadgeDirectory, {});
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,#fffdf8,#faf9f5_420px)] font-body text-[#1a1918]">
      <TopNav />
      <main className="mx-auto max-w-[1360px] px-[clamp(20px,4vw,48px)] pt-2 pb-12">
        <Suspense fallback={null}><BadgeExplorerClient badges={badges} /></Suspense>
      </main>
      <FooterStrip />
    </div>
  );
}
