import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA 2K27 Player Comparison — Attributes, Badges & Builds",
  description: "Compare two NBA 2K27 players across ratings, physical profile, category scores, every attribute, badges, strengths, and build fit.",
  alternates: { canonical: "/compare" },
  robots: { index: true, follow: true },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
