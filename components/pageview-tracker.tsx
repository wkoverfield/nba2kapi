"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getVisitorId } from "@/lib/visitor-id";

/**
 * Fires a Convex `recordPageview` on each route change. Fire-and-forget.
 * usePathname only (no useSearchParams) so no Suspense boundary is needed.
 * A ref guards against double-fires. Renders nothing.
 */
export function PageviewTracker() {
  const pathname = usePathname();
  const recordPageview = useMutation(api.siteStats.recordPageview);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    void recordPageview({ path: pathname, visitorId: getVisitorId() }).catch(() => {});
  }, [pathname, recordPageview]);

  return null;
}
