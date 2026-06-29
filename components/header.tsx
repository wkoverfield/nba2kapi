"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Logo } from "@/components/logo";
import { MenuToggleIcon } from "@/components/menu-toggle-icon";
import { GitHubStars } from "@/components/github-stars";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useScroll } from "@/hooks/use-scroll";
import { cn } from "@/lib/utils";
import { Github, SlidersHorizontal, Users, ChevronDown, LayoutGrid } from "lucide-react";
import { basketball } from "@lucide/lab";
import { ModeToggle } from "@/components/mode-toggle";

export function Header() {
  const [open, setOpen] = React.useState(false);
  const [mobileExploreExpanded, setMobileExploreExpanded] = React.useState(false);
  const scrolled = useScroll(10);

  const exploreLinks = [
    {
      label: "Playground",
      href: "/playground",
      icon: SlidersHorizontal,
      description: "Browse and filter all players",
    },
    {
      label: "Teams",
      href: "/teams",
      icon: Users,
      description: "View team rosters and stats",
    },
    {
      label: "Lineups",
      href: "/lineups",
      icon: LayoutGrid,
      description: "Build and compare lineups",
    },
  ];

  const mainLinks = [
    {
      label: "Documentation",
      href: "/docs",
    },
    {
      label: "Dashboard",
      href: "/dashboard",
    },
  ];

  React.useEffect(() => {
    if (open) {
      // Disable scroll
      document.body.style.overflow = "hidden";
    } else {
      // Re-enable scroll
      document.body.style.overflow = "";
    }

    // Cleanup when component unmounts (important for Next.js)
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 mx-auto w-full max-w-4xl border-b border-transparent bg-background dark:bg-background md:rounded-md md:border md:border-transparent md:transition-all md:ease-out",
        {
          "border-slate-200 bg-slate-50/95 backdrop-blur-lg supports-[backdrop-filter]:bg-slate-50/50 md:top-4 md:max-w-3xl md:border-slate-200 md:shadow dark:border-slate-800 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/50 dark:md:border-slate-800":
            scrolled,
        }
      )}
    >
      <nav
        className={cn(
          "flex h-14 w-full items-center justify-between px-4 md:h-12 md:transition-all md:ease-out",
          {
            "md:px-2": scrolled,
          }
        )}
        aria-label="Main navigation"
      >
        <a className="rounded-md p-2 hover:bg-accent" href="/" aria-label="Home">
          <Logo />
        </a>
        <div className="hidden items-center gap-2 md:flex">
          {mainLinks.map((link, i) => (
            <a
              className={buttonVariants({ variant: "ghost" })}
              href={link.href}
              key={i}
            >
              {link.label}
            </a>
          ))}

          {/* Explore Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "ghost" })}
              aria-haspopup="menu"
            >
              Explore
              <ChevronDown className="ml-1 h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {exploreLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <DropdownMenuItem key={link.label} asChild>
                    <a href={link.href} className="flex items-start gap-3 cursor-pointer">
                      <Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="font-medium">{link.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {link.description}
                        </span>
                      </div>
                    </a>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* GitHub Icon with Tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 px-2")}
                  href="https://github.com/wkoverfield/nba2kapi"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Star on GitHub"
                >
                  <Github className="h-4 w-4" />
                  <GitHubStars repo="wkoverfield/nba2kapi" />
                </a>
              </TooltipTrigger>
              <TooltipContent>
                <p>Star on GitHub</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <ModeToggle />

          <Button asChild>
            <a href="/dashboard">Get API Key</a>
          </Button>
        </div>
        <Button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          size="icon"
          variant="outline"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <MenuToggleIcon className="size-5" duration={300} open={open} />
        </Button>
      </nav>

      <MobileMenu className="flex flex-col justify-between gap-2" open={open}>
        <div className="grid gap-y-2">
          {mainLinks.map((link) => (
            <a
              className={buttonVariants({
                variant: "ghost",
                className: "justify-start",
              })}
              href={link.href}
              key={link.label}
            >
              {link.label}
            </a>
          ))}

          {/* Explore Section - Expandable */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
            <button
              onClick={() => setMobileExploreExpanded(!mobileExploreExpanded)}
              className={buttonVariants({
                variant: "ghost",
                className: "justify-between w-full",
              })}
            >
              <span>Explore</span>
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", {
                  "rotate-180": mobileExploreExpanded,
                })}
              />
            </button>
            {mobileExploreExpanded && (
              <div className="ml-4 mt-2 grid gap-y-2">
                {exploreLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      className={buttonVariants({
                        variant: "ghost",
                        className: "justify-start",
                      })}
                      href={link.href}
                      key={link.label}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      {link.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* GitHub */}
          <a
            className={buttonVariants({
              variant: "ghost",
              className: "justify-start",
            })}
            href="https://github.com/wkoverfield/nba2kapi"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="mr-2 h-4 w-4" />
            GitHub
          </a>
        </div>
        <div className="flex flex-col gap-2">
          <Button className="w-full" asChild>
            <a href="/dashboard">Get API Key</a>
          </Button>
        </div>
      </MobileMenu>
    </header>
  );
}

type MobileMenuProps = React.ComponentProps<"div"> & {
  open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "bg-slate-50/95 backdrop-blur-lg supports-[backdrop-filter]:bg-slate-50/50 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/50",
        "fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y border-slate-200 dark:border-slate-800 md:hidden"
      )}
      id="mobile-menu"
    >
      <div
        className={cn(
          "data-[slot=open]:zoom-in-97 ease-out data-[slot=open]:animate-in",
          "size-full p-4",
          className
        )}
        data-slot={open ? "open" : "closed"}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
