"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const subscribe = () => () => {};

/**
 * Theme switch: follow the device, or force light or dark. The stored choice
 * is only known in the browser, so nothing is marked selected until after
 * hydration.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center gap-0.5 rounded-full border border-line p-[3px]"
    >
      {OPTIONS.map((option) => {
        const selected = hydrated && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(option.value)}
            className={cn(
              "cursor-pointer rounded-full px-2.5 py-1 font-plex text-[10.5px] transition-colors duration-150 motion-reduce:transition-none",
              selected ? "bg-soft text-ink" : "text-ink-3 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
