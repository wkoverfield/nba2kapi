import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NBA 2K27 Player Ratings & Attribute Search",
  description: "Search NBA 2K27 player ratings, attributes, badges, positions, teams, and eras with a fast interactive NBA 2K database and API playground.",
  alternates: { canonical: "/playground" },
};

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
