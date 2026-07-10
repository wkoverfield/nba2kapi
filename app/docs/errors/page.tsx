"use client";

import Link from "next/link";
import {
  DarkCode,
  DocColumns,
  DocH1,
  DocLabel,
  DocP,
  FinePrint,
  ParamsTable,
} from "@/components/docs/kit";

const ENVELOPE = `{
  "success": false,
  "error": {
    "message": "A human-readable error message",
    "code": "ERROR_CODE",
    "details": {} // optional additional context
  }
}`;

const RETRY_SNIPPET = `async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.ok) return response.json();

    // Don't retry client errors (4xx except 429)
    if (response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429) {
      throw new Error(\`Client error: \${response.status}\`);
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, i) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error('Max retries exceeded');
}`;

export default function ErrorsPage() {
  return (
    <DocColumns
      rail={
        <div className="flex flex-col gap-2.5">
          <DarkCode title="ERROR ENVELOPE">{ENVELOPE}</DarkCode>
          <DarkCode title="RETRY LOGIC">{RETRY_SNIPPET}</DarkCode>
        </div>
      }
    >
      <DocH1>Error handling</DocH1>
      <DocP>
        Every error is the same shape: HTTP status plus a JSON envelope with a{" "}
        <code>message</code>, a stable <code>code</code>, and optional <code>details</code>. Check
        both the status and the <code>success</code> field.
      </DocP>

      <DocLabel>ERROR CODES</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "MISSING_API_KEY",
            type: "401",
            desc: (
              <>
                No key in the request headers. Add <code>X-API-Key</code>.
              </>
            ),
          },
          {
            name: "INVALID_API_KEY",
            type: "401",
            desc: (
              <>
                Key is invalid or expired. Verify it in your <Link href="/dashboard">dashboard</Link>.
              </>
            ),
          },
          {
            name: "PLAYER_NOT_FOUND",
            type: "404",
            desc: (
              <>
                No such player. Check the slug or find them via{" "}
                <Link href="/docs/endpoints/search">/api/players/search</Link>.
              </>
            ),
          },
          {
            name: "INVALID_PARAMETER",
            type: "400",
            desc: (
              <>
                A parameter value is invalid, e.g. an unknown <code>sort</code> field or an
                attribute bound outside 0–99. <code>details</code> names the constraint. Note:
                values rejected by schema validation (bad enum, <code>limit</code> outside 1–100)
                currently return a raw validation object rather than this envelope.
              </>
            ),
          },
          {
            name: "UNKNOWN_PARAMETERS",
            type: "400",
            desc: (
              <>
                A query parameter this endpoint doesn&apos;t know. The response suggests the
                closest valid parameter or endpoint.
              </>
            ),
          },
          {
            name: "RATE_LIMIT_EXCEEDED",
            type: "429",
            desc: (
              <>
                Over your limit. Wait <code>retryAfter</code> seconds — see{" "}
                <Link href="/docs/rate-limits">rate limits</Link>.
              </>
            ),
          },
        ]}
      />

      <DocLabel>WHEN TO RETRY</DocLabel>
      <DocP>
        Retry <code>429</code> and <code>5xx</code> with exponential backoff (snippet on the
        right). Never retry other <code>4xx</code> errors — they mean the request itself is wrong:
        fix the key, the slug, or the parameter. Log the <code>code</code>, <code>message</code>,
        and <code>details</code> when things fail; they pinpoint the problem.
      </DocP>
      <FinePrint>
        STUCK ON AN ERROR? OPEN A GITHUB ISSUE (WKOVERFIELD/NBA2KAPI) WITH THE REQUEST AND RESPONSE.
      </FinePrint>
    </DocColumns>
  );
}
