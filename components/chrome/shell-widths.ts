/**
 * Max-width classes shared by the page shell (TopNav, SiteFooter). Lives in
 * its own module, without "use client", so server components can read the
 * values: a constant imported from a client module arrives on the server as
 * a client reference, and indexing it yields undefined.
 */
export const SHELL_WIDTHS = {
  narrow: "max-w-[1280px]",
  default: "max-w-[1360px]",
  wide: "max-w-[1440px]",
} as const;
