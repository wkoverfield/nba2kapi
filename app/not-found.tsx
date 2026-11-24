import type { Metadata } from "next";
import Link from "next/link";
import {
  StatusPage,
  STATUS_PRIMARY_ACTION,
  STATUS_SECONDARY_ACTION,
} from "@/components/chrome/status-page";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <StatusPage
      label="404 · NOT FOUND"
      title="Page not found"
      description="Nothing lives at this address. The link may be mistyped, or the player, team, or badge may not be in the database."
      actions={
        <>
          <Link href="/playground" className={STATUS_PRIMARY_ACTION}>
            Search the playground
          </Link>
          <Link href="/teams" className={STATUS_SECONDARY_ACTION}>
            Browse teams
          </Link>
          <Link href="/docs" className={STATUS_SECONDARY_ACTION}>
            Read the docs
          </Link>
        </>
      }
    />
  );
}
