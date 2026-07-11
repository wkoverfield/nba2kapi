import { CURRENT_GAME_VERSION } from "@/convex/gameVersion";

export const SITE_URL = "https://nba2kapi.com";

export const ERA_LABELS = {
  curr: "Current",
  class: "Classic",
  allt: "All-Time",
} as const;

export function gameLabel() {
  return `NBA 2K${String(CURRENT_GAME_VERSION).slice(-2)}`;
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function teamCanonical(slug: string, teamType: "curr" | "class" | "allt") {
  const path = `/teams/${slug}`;
  return teamType === "curr" ? path : `${path}?type=${teamType}`;
}
