/**
 * Max width of the page shell. TopNav, SiteFooter, and every page body use
 * the same value, so the wordmark, the content's left edge, and the footer
 * columns line up and hold their position across route changes. Page bodies
 * spell the class out literally; change it there too.
 *
 * Lives in its own module, without "use client", so server components can
 * read the value: a constant imported from a client module arrives on the
 * server as a client reference.
 */
export const SHELL_WIDTH = "max-w-[1360px]";
