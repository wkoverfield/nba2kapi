import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA 2K27 Lineup Builder & Matchup Analyzer",
  description: "Build an NBA 2K27 five-player lineup, analyze its offense, defense, fit and role coverage, or compare two lineups in a head-to-head matchup.",
  alternates: { canonical: "/lineups" },
};

export default function LineupsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
