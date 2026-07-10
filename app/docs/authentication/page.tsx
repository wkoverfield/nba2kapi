"use client";

import Link from "next/link";
import {
  CodeRail,
  DarkCode,
  DocColumns,
  DocH1,
  DocLabel,
  DocP,
  FinePrint,
  ParamsTable,
} from "@/components/docs/kit";

const SAMPLES = [
  {
    label: "cURL",
    code: `curl 'https://api.nba2kapi.com/api/players' \\
  -H 'X-API-Key: your_api_key_here'`,
  },
  {
    label: "JS",
    code: `const res = await fetch(
  'https://api.nba2kapi.com/api/players',
  { headers: { 'X-API-Key': process.env.NBA2K_API_KEY } }
);`,
  },
  {
    label: "Python",
    code: `import os, requests

res = requests.get(
  'https://api.nba2kapi.com/api/players',
  headers={'X-API-Key': os.getenv('NBA2K_API_KEY')})`,
  },
];

const ERRORS_401 = `// Missing key → 401
{
  "success": false,
  "error": {
    "message": "API key is required",
    "code": "MISSING_API_KEY"
  }
}

// Invalid key → 401
{
  "success": false,
  "error": {
    "message": "Invalid API key",
    "code": "INVALID_API_KEY"
  }
}`;

export default function AuthenticationPage() {
  return (
    <DocColumns
      rail={
        <div className="flex flex-col gap-2.5">
          <CodeRail samples={SAMPLES} />
          <DarkCode title="401 UNAUTHORIZED">{ERRORS_401}</DarkCode>
        </div>
      }
    >
      <DocH1>Authentication</DocH1>
      <DocP>
        Every request must carry a valid API key in the <code>X-API-Key</code> header. That&apos;s
        the whole protocol — no OAuth, no tokens to refresh.
      </DocP>

      <DocLabel>THE KEY MODEL</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "No password",
            type: "design",
            desc: (
              <>
                The key is the login. Get yours from the <Link href="/dashboard">dashboard</Link>{" "}
                and you&apos;re done.
              </>
            ),
          },
          {
            name: "3 keys per email",
            type: "limit",
            desc: <>Each email address can hold up to 3 active keys — one per project, say.</>,
          },
          {
            name: "Regenerate anytime",
            type: "recovery",
            desc: (
              <>
                Exposed a key? Regenerate it immediately in the{" "}
                <Link href="/dashboard">dashboard</Link>. The old key stops working at once.
              </>
            ),
          },
        ]}
      />

      <DocLabel>KEY HYGIENE</DocLabel>
      <ParamsTable
        rows={[
          {
            name: "Env vars, not source",
            type: "do",
            desc: (
              <>
                Never hardcode keys. Put <code>NBA2K_API_KEY=…</code> in <code>.env</code> and add{" "}
                <code>.env</code> to <code>.gitignore</code>.
              </>
            ),
          },
          {
            name: "Server-side only",
            type: "don't",
            desc: (
              <>
                Call the API from your backend, not the browser. A key in client-side JavaScript is
                publicly readable.
              </>
            ),
          },
        ]}
      />

      <DocLabel>WHEN IT FAILS</DocLabel>
      <DocP>
        A missing or invalid key returns <code>401 Unauthorized</code> with the envelope shown on
        the right. See the <Link href="/docs/errors">error handling guide</Link> for the full code
        list, or check the <Link href="/dashboard">dashboard</Link> to verify your key is active.
      </DocP>
      <FinePrint>KEYS ARE CHECKED ON EVERY REQUEST · NO SESSION STATE.</FinePrint>
    </DocColumns>
  );
}
