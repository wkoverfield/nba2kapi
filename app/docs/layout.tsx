"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TopNav } from "@/components/chrome/top-nav";
import { FooterStrip } from "@/components/chrome/footer-strip";
import { API_KEY_STORAGE_KEY } from "@/lib/constants";
import { cn } from "@/lib/utils";

const DOCS_NAV = [
  {
    title: "GETTING STARTED",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Quickstart", href: "/docs/quickstart" },
      { title: "Authentication", href: "/docs/authentication" },
    ],
  },
  {
    title: "API REFERENCE",
    items: [
      { title: "Players", href: "/docs/endpoints/players" },
      { title: "Teams", href: "/docs/endpoints/teams" },
      { title: "Search", href: "/docs/endpoints/search" },
    ],
  },
  {
    title: "GUIDES",
    items: [
      { title: "Rate limits", href: "/docs/rate-limits" },
      { title: "Error handling", href: "/docs/errors" },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    setHasApiKey(!!localStorage.getItem(API_KEY_STORAGE_KEY));
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f5] font-body text-[#1a1918]">
      <div className="border-b border-[#f1efe8]">
        <TopNav hasApiKey={hasApiKey} />
      </div>

      <div className="mx-auto flex max-w-[1360px] flex-wrap items-start gap-[clamp(20px,3vw,32px)] px-[clamp(20px,4vw,48px)] pt-[26px] pb-14">
        {/* Sidebar tree */}
        <div className="flex min-w-[160px] flex-[0_1_190px] flex-col gap-5 animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none">
          {DOCS_NAV.map((section) => (
            <div key={section.title}>
              <div className="mb-2 font-plex text-[8.5px] tracking-[0.12em] text-[#b5b0a1]">
                {section.title}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-2.5 py-[5px] text-[13px] no-underline transition-colors duration-150",
                      pathname === item.href
                        ? "bg-[#f1efe8] font-semibold text-[#1a1918]"
                        : "font-medium text-[#57534a] hover:bg-[#f1efe8]"
                    )}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Page body */}
        <main
          className="min-w-0 flex-[1_1_640px] animate-[rise-in_350ms_cubic-bezier(0.23,1,0.32,1)_both] motion-reduce:animate-none"
          style={{ animationDelay: "60ms" }}
        >
          {children}
        </main>
      </div>

      <FooterStrip />
    </div>
  );
}
