"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Headshot } from "@/components/ui/headshot";
import { getTeamAbbreviation, getTeamConference, formatTeamShortName } from "@/lib/team-abbr";
import { cn } from "@/lib/utils";

type TeamType = "curr" | "class" | "allt";

type PoolPlayer = {
  name: string;
  slug: string;
  team: string;
  teamType: TeamType;
  positions: string[];
  overall: number;
  playerImage: string | null;
};

type DirectoryBadge = {
  name: string;
  slug: string;
  category: string;
  imageUrl: string | null;
  playerCount: number;
};

type Result =
  | { kind: "player"; key: string; name: string; meta: string; href: string; player: PoolPlayer }
  | { kind: "team"; key: string; name: string; meta: string; href: string; abbr: string; logo: string | null }
  | { kind: "badge"; key: string; name: string; meta: string; href: string; badge: DirectoryBadge }
  | { kind: "query"; key: string; name: string; meta: string; href: string };

type Group = { label: string; items: Result[] };

function playerResult(p: PoolPlayer): Result {
  const era = p.teamType === "curr" ? "" : p.teamType === "class" ? " · CLASSIC" : " · ALL-TIME";
  return {
    kind: "player",
    key: `p:${p.slug}:${p.teamType}:${p.team}`,
    name: p.name,
    meta: `${p.positions.join("/")} · ${getTeamAbbreviation(p.team)} · ${p.overall}${era}`,
    href: `/players/${p.slug}?type=${p.teamType}&team=${encodeURIComponent(p.team)}`,
    player: p,
  };
}

function TeamIcon({ logo, abbr, name }: { logo: string | null; abbr: string; name: string }) {
  const [errored, setErrored] = useState(false);
  if (!logo || errored) {
    return (
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#f1efe8] font-display text-[10px] font-extrabold text-[#57534a]">
        {abbr}
      </span>
    );
  }
  return (
    <span className="relative h-[30px] w-[30px] shrink-0">
      <Image src={logo} alt={name} fill sizes="30px" className="object-contain" onError={() => setErrored(true)} />
    </span>
  );
}

function BadgeIcon({ badge }: { badge: DirectoryBadge }) {
  if (badge.imageUrl) {
    return (
      <span className="relative h-[30px] w-[30px] shrink-0">
        <Image src={badge.imageUrl} alt="" fill sizes="30px" className="object-contain" />
      </span>
    );
  }

  return (
    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#f6e9c8] font-display text-[9px] font-extrabold text-[#8a6200]">
      {badge.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
    </span>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [everOpened, setEverOpened] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setEverOpened(true);
      setQ("");
      setSel(0);
    }
  }, [open]);

  // Lazy: the dataset is only subscribed after the palette first opens.
  const players = useQuery(
    api.players.getPlaygroundPlayers,
    everOpened ? {} : "skip"
  ) as PoolPlayer[] | undefined;
  const logoMap = useQuery(api.teams.getTeamLogoMap, everOpened ? {} : "skip") as
    | Record<string, string>
    | undefined;
  const badges = useQuery(api.badges.getBadgeDirectory, everOpened ? {} : "skip") as
    | DirectoryBadge[]
    | undefined;

  const teams = useMemo(() => {
    if (!players) return [];
    const byTeam = new Map<string, { team: string; teamType: TeamType; sum: number; n: number }>();
    for (const p of players) {
      const key = `${p.team}:${p.teamType}`;
      const t = byTeam.get(key) ?? { team: p.team, teamType: p.teamType, sum: 0, n: 0 };
      t.sum += p.overall;
      t.n++;
      byTeam.set(key, t);
    }
    const all = [...byTeam.values()].map((t) => ({
      ...t,
      avg: Math.round((t.sum / t.n) * 10) / 10,
    }));
    // Rank within each era by roster strength (matches the Board)
    const rank = new Map<string, number>();
    for (const era of ["curr", "class", "allt"] as const) {
      all
        .filter((t) => t.teamType === era)
        .sort((a, b) => b.avg - a.avg || a.team.localeCompare(b.team))
        .forEach((t, i) => rank.set(`${t.team}:${t.teamType}`, i + 1));
    }
    return all.map((t): Result & { teamType: TeamType } => {
      const conf = getTeamConference(t.team);
      return {
        kind: "team",
        teamType: t.teamType,
        key: `t:${t.team}:${t.teamType}`,
        name: formatTeamShortName(t.team, t.teamType),
        meta: `#${rank.get(`${t.team}:${t.teamType}`)}${conf ? ` · ${conf}` : ""} · ${t.avg.toFixed(1)} AVG${t.teamType === "curr" ? "" : t.teamType === "class" ? " · CLASSIC" : " · ALL-TIME"}`,
        href: `/teams/${t.team.toLowerCase().replace(/[^a-z0-9]+/g, "-")}?type=${t.teamType}`,
        abbr: getTeamAbbreviation(t.team),
        logo: logoMap?.[t.team] ?? null,
      };
    });
  }, [players, logoMap]);

  const groups: Group[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    const out: Group[] = [];

    if (players) {
      const matchedPlayers = query
        ? players
            .filter((p) => p.name.toLowerCase().includes(query))
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 8)
        : [...players]
            .filter((p) => p.teamType === "curr")
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 5);
      if (matchedPlayers.length) {
        out.push({
          label: query ? "PLAYERS" : "TOP PLAYERS",
          items: matchedPlayers.map(playerResult),
        });
      }

      const matchedTeams = query
        ? teams.filter((t) => t.name.toLowerCase().includes(query)).slice(0, 6)
        : teams
            .filter((t) => t.teamType === "curr")
            .sort((a, b) => Number(a.meta.slice(1).split(" ")[0]) - Number(b.meta.slice(1).split(" ")[0]))
            .slice(0, 3);
      if (matchedTeams.length) out.push({ label: "TEAMS", items: matchedTeams });
    }

    if (badges) {
      const matchedBadges = query
        ? badges
            .filter((badge) =>
              badge.name.toLowerCase().includes(query) || badge.category.toLowerCase().includes(query)
            )
            .sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name))
            .slice(0, 6)
        : [];
      if (matchedBadges.length) {
        out.push({
          label: "BADGES",
          items: matchedBadges.map((badge) => ({
            kind: "badge",
            key: `b:${badge.slug}`,
            name: badge.name,
            meta: `${badge.category.toUpperCase()} · ${badge.playerCount} PLAYER${badge.playerCount === 1 ? "" : "S"}`,
            href: `/badges?badge=${encodeURIComponent(badge.slug)}`,
            badge,
          })),
        });
      }
    }

    out.push({
      label: "RUN AS QUERY",
      items: [
        {
          kind: "query",
          key: "q",
          name: query ? `Show me everyone matching "${q.trim()}"` : "Open the query playground",
          meta: query
            ? `GET /api/players?search=${encodeURIComponent(q.trim())}&era=all`
            : "Build a query as a sentence",
          href: query
            ? `/playground?search=${encodeURIComponent(q.trim())}&era=all`
            : "/playground",
        },
      ],
    });
    return out;
  }, [players, teams, badges, q]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setSel(0), [q]);

  const activate = (index: number) => {
    const item = flat[index];
    if (!item) return;
    onOpenChange(false);
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate(sel);
    }
  };

  // Keep the selected row in view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  let runningIndex = -1;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgba(26,25,24,0.35)] backdrop-blur-[2px]" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          className="fixed top-[12%] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[18px] border border-[#e5e2da] bg-white font-body shadow-[0_40px_80px_-24px_rgba(26,25,24,0.5)] animate-[pop-in_220ms_cubic-bezier(0.23,1,0.32,1)_both] focus:outline-none motion-reduce:animate-none"
        >
          <Dialog.Title className="sr-only">Search players, teams, badges, and queries</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-[#f1efe8] px-5 py-[15px]">
            <Search className="h-4 w-4 text-[#8a8577]" strokeWidth={2} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players, teams, badges…"
              className="flex-1 border-none bg-transparent font-body text-[16px] text-[#1a1918] outline-none placeholder:text-[#b5b0a1]"
            />
            <span className="font-plex text-[9px] text-[#b5b0a1]">ESC TO CLOSE</span>
          </div>

          <div ref={listRef} className="max-h-[56vh] overflow-y-auto px-2 pt-2 pb-1.5">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-3.5 pt-2 pb-1 font-plex text-[8.5px] tracking-[0.12em] text-[#b5b0a1]">
                  {g.label}
                </div>
                {g.items.map((item) => {
                  runningIndex++;
                  const index = runningIndex;
                  const active = index === sel;
                  return (
                    <div
                      key={item.key}
                      data-idx={index}
                      onMouseMove={() => setSel(index)}
                      onClick={() => activate(index)}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[10px] px-3.5 py-[9px]",
                        active && "bg-[#f1efe8]"
                      )}
                    >
                      {item.kind === "player" ? (
                        <Headshot src={item.player.playerImage} name={item.name} size={30} />
                      ) : item.kind === "team" ? (
                        <TeamIcon logo={item.logo} abbr={item.abbr} name={item.name} />
                      ) : item.kind === "badge" ? (
                        <BadgeIcon badge={item.badge} />
                      ) : (
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-[#1a1918]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#faf9f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="4 17 10 11 4 5" />
                            <line x1="12" x2="20" y1="19" y2="19" />
                          </svg>
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="m-0 overflow-hidden text-[13.5px] font-semibold text-ellipsis whitespace-nowrap text-[#1a1918]">
                          {item.name}
                        </p>
                        <p className="mt-px mb-0 overflow-hidden font-plex text-[8.5px] text-ellipsis whitespace-nowrap text-[#8a8577]">
                          {item.meta}
                        </p>
                      </div>
                      {item.kind === "query" ? (
                        <span className="font-plex text-[8px] text-[#b5b0a1]">→ PLAYGROUND</span>
                      ) : (
                        active && <span className="font-plex text-[9px] text-[#b5b0a1]">↵</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {everOpened && !players && (
              <div className="px-3.5 py-6 text-center font-plex text-[9px] tracking-[0.08em] text-[#b5b0a1]">
                LOADING THE DATASET…
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3.5 border-t border-[#f1efe8] bg-[#faf9f5] px-5 py-2.5 font-plex text-[8.5px] text-[#b5b0a1]">
            <span>↑↓ NAVIGATE</span>
            <span>↵ OPEN</span>
            <span className="ml-auto">SEARCHES ALL 3 ERAS</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
