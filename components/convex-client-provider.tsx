"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { CONVEX_URL } from "@/lib/constants";
import { PageviewTracker } from "@/components/pageview-tracker";

const convex = new ConvexReactClient(CONVEX_URL);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      {children}
      <PageviewTracker />
    </ConvexProvider>
  );
}
