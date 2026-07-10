"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

// Routes that have been migrated to the new (paper/editorial) design render
// their own chrome (TopNav / SiteFooter) inside the page, so the legacy
// header/footer must not double up on them.
const RESKINNED_ROUTES = new Set(["/", "/playground", "/teams", "/lineups", "/dashboard", "/docs"]);
const RESKINNED_PREFIXES = ["/teams/", "/players/", "/docs/"];

function isReskinned(pathname: string) {
  return RESKINNED_ROUTES.has(pathname) || RESKINNED_PREFIXES.some((p) => pathname.startsWith(p));
}

export function LegacyHeader() {
  const pathname = usePathname();
  if (isReskinned(pathname)) return null;
  return <Header />;
}

export function LegacyFooter() {
  const pathname = usePathname();
  if (isReskinned(pathname)) return null;
  return <Footer />;
}
