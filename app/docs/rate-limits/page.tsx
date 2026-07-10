"use client";

import {
  DarkCode,
  DocColumns,
  DocH1,
  DocLabel,
  DocP,
  FinePrint,
  ParamsTable,
} from "@/components/docs/kit";

const HEADERS_SAMPLE = `X-RateLimit-Limit: 500
X-RateLimit-Remaining: 463
X-RateLimit-Reset: 2026-01-15T01:00:00.000Z`;

const RESPONSE_429 = `{
  "success": false,
  "error": {
    "message": "You have exceeded your rate limit.
      Please try again in 45 seconds",
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 500,
      "reset": "2025-01-15T00:45:00.000Z",
      "retryAfter": 45
    },
    "timestamp": "2025-01-15T00:00:00.000Z"
  }
}`;

const RETRY_SNIPPET = `async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, i) * 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('Max retries exceeded');
}`;

export default function RateLimitsPage() {
  return (
    <DocColumns
      rail={
        <div className="flex flex-col gap-2.5">
          <DarkCode title="RESPONSE HEADERS">{HEADERS_SAMPLE}</DarkCode>
          <DarkCode title="429 TOO MANY REQUESTS">{RESPONSE_429}</DarkCode>
          <DarkCode title="RETRY WITH BACKOFF">{RETRY_SNIPPET}</DarkCode>
        </div>
      }
    >
      <DocH1>Rate limits</DocH1>
      <DocP>
        One window: requests per API key per hour. Blow through it and you get a{" "}
        <code>429</code> until the hour resets.
      </DocP>

      <DocLabel>CURRENT LIMITS</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "500 / hour",
            type: "per API key",
            desc: (
              <>
                Free-tier default, set per key at creation — the dashboard and{" "}
                <code>X-RateLimit-Limit</code> always show your key&apos;s real number.
              </>
            ),
          },
        ]}
      />

      <DocLabel>RATE LIMIT HEADERS</DocLabel>
      <DocP>Every response tells you where you stand:</DocP>
      <div className="mt-2.5">
        <ParamsTable
          rows={[
            {
              name: "X-RateLimit-Limit",
              type: "number",
              desc: <>Maximum requests allowed in the current window.</>,
            },
            {
              name: "X-RateLimit-Remaining",
              type: "number",
              desc: <>Requests remaining in the current window.</>,
            },
            {
              name: "X-RateLimit-Reset",
              type: "ISO-8601 string",
              desc: (
                <>
                  When the current window resets, e.g.{" "}
                  <code>2026-01-15T01:00:00.000Z</code>.
                </>
              ),
            },
          ]}
        />
      </div>

      <DocLabel>HANDLING 429S</DocLabel>
      <DocP>
        Watch <code>X-RateLimit-Remaining</code> and slow down before you hit zero. On a{" "}
        <code>429</code>, wait <code>retryAfter</code> seconds (or use exponential backoff, right).
        Cache responses locally — ratings don&apos;t change often — and avoid bursts of parallel
        requests; batch where you can.
      </DocP>
      <FinePrint>
        NEED HIGHER LIMITS? OPEN A GITHUB ISSUE (WKOVERFIELD/NBA2KAPI) WITH YOUR USE CASE.
      </FinePrint>
    </DocColumns>
  );
}
