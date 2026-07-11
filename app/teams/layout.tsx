import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA 2K27 Team Rosters, Ratings & Depth Charts",
  description: "Browse current, classic, and all-time NBA 2K27 teams. Compare roster ratings, stars, depth charts, shooting, defense, and team composition.",
  alternates: { canonical: "/teams" },
};

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
