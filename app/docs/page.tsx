"use client";

import Link from "next/link";
import { DocColumns, DocH1, DocLabel, DocP, FinePrint, ParamsTable } from "@/components/docs/kit";

export default function DocsIntroduction() {
  return (
    <DocColumns>
      <DocH1>Introduction</DocH1>
      <DocP>
        The NBA 2K Ratings API is programmatic access to player ratings from the NBA 2K video game
        series — data scraped from{" "}
        <a href="https://2kratings.com" target="_blank" rel="noopener noreferrer">
          2kratings.com
        </a>{" "}
        and served through a clean REST interface. Basketball games, Discord bots, ratings
        analysis: one API key, JSON out.
      </DocP>

      <DocLabel>WHAT&apos;S IN THE DATA</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "Player attributes",
            type: "40+ per player",
            desc: (
              <>
                Overall rating, positions, height, weight, archetype, and individual stats across
                shooting, finishing, playmaking, defense, and athleticism.
              </>
            ),
          },
          {
            name: "Badges",
            type: "with tiers",
            desc: <>Complete badge information: Bronze, Silver, Gold, Hall of Fame, Legend.</>,
          },
          {
            name: "Team rosters",
            type: "3 eras",
            desc: <>Current NBA teams, classic teams, and all-time teams.</>,
          },
          {
            name: "Player images",
            type: "URLs",
            desc: <>Headshot URLs for each player, plus team logos.</>,
          },
        ]}
      />
      <FinePrint>159MS AVERAGE RESPONSE TIME · INTELLIGENT CACHING · 99%+ UPTIME.</FinePrint>

      <DocLabel>WHO IT&apos;S FOR</DocLabel>
      <DocP>
        Indie game developers building basketball or fantasy tools, Discord bot creators adding 2K
        stats commands, data analysts researching rating trends, and web developers building
        2K-related sites. Every request authenticates with an API key and is rate limited to
        protect against abuse.
      </DocP>

      <DocLabel>START HERE</DocLabel>
      <DocP>
        The <Link href="/docs/quickstart">quickstart</Link> takes you from key to first response in
        under 5 minutes. Not ready to write code? Explore the data visually in the{" "}
        <Link href="/playground">playground</Link>.
      </DocP>
    </DocColumns>
  );
}
