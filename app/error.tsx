"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  StatusPage,
  STATUS_PRIMARY_ACTION,
  STATUS_SECONDARY_ACTION,
} from "@/components/chrome/status-page";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      label="ERROR"
      title="Something went wrong"
      description="This page failed to load. Trying again usually fixes it. If it keeps happening, send a note through the feedback page."
      actions={
        <>
          <button type="button" onClick={reset} className={STATUS_PRIMARY_ACTION}>
            Try again
          </button>
          <Link href="/" className={STATUS_SECONDARY_ACTION}>
            Back to home
          </Link>
          <Link href="/feedback" className={STATUS_SECONDARY_ACTION}>
            Send feedback
          </Link>
        </>
      }
      footnote={error.digest ? `REFERENCE ${error.digest}` : undefined}
    />
  );
}
