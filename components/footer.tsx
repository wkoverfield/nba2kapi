import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Github, Heart, Star, MessageSquare } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 font-semibold mb-3">
              <span>nba2kapi</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Access NBA 2K player ratings and team data via REST API.
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/playground" className="text-muted-foreground hover:text-foreground">
                  Playground
                </Link>
              </li>
              <li>
                <Link href="/teams" className="text-muted-foreground hover:text-foreground">
                  Teams
                </Link>
              </li>
              <li>
                <Link href="/playground" className="text-muted-foreground hover:text-foreground">
                  Player Search
                </Link>
              </li>
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Developers</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/docs" className="text-muted-foreground hover:text-foreground">
                  API Documentation
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/docs/authentication" className="text-muted-foreground hover:text-foreground">
                  Authentication
                </Link>
              </li>
              <li>
                <Link href="/docs/rate-limits" className="text-muted-foreground hover:text-foreground">
                  Rate Limiting
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://github.com/wkoverfield/nba2kapi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <Star className="h-3.5 w-3.5" />
                  Star on GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://buymeacoffee.com/wkoverfield"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <Heart className="h-3.5 w-3.5" />
                  Buy Me a Coffee
                </a>
              </li>
              <li>
                <Link
                  href="/feedback"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Feedback
                </Link>
              </li>
              <li>
                <a
                  href="https://2kratings.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  2K Ratings Source
                </a>
              </li>
              <li>
                <span className="text-muted-foreground text-xs block mt-4">
                  Data sourced from 2kratings.com
                </span>
              </li>
              <li>
                <span className="text-muted-foreground text-xs">
                  Not affiliated with 2K Sports or NBA
                </span>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col gap-4 text-center text-sm text-muted-foreground md:flex-row md:justify-between">
          <p>Built with Next.js, Convex, and Playwright</p>
          <a
            href="https://github.com/wkoverfield"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-2 justify-center md:justify-end"
          >
            <Github className="h-4 w-4" />
            github.com/wkoverfield
          </a>
        </div>
      </div>
    </footer>
  );
}
