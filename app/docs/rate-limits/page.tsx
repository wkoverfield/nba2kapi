import { CodeBlock } from "@/components/code-block";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function RateLimitsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-4xl font-bold">Rate Limits</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Understand how rate limiting works and how to handle rate limit errors.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="mb-3 text-2xl font-bold">Current Limits</h2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-2 text-lg font-semibold">Requests per Hour</h4>
                <p className="text-3xl font-bold text-primary">100</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Maximum requests allowed per API key per hour
                </p>
              </div>
              <div>
                <h4 className="mb-2 text-lg font-semibold">Requests per Minute</h4>
                <p className="text-3xl font-bold text-primary">20</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Maximum requests allowed per API key per minute
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-bold">Rate Limit Headers</h2>
          <p className="mb-4 text-slate-600 dark:text-slate-400">
            Every API response includes headers that tell you about your current rate limit status:
          </p>
          <CodeBlock
            code={`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642521600`}
            language="bash"
          />
          <div className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">X-RateLimit-Limit</code>: Maximum requests allowed in the current window
            </p>
            <p>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">X-RateLimit-Remaining</code>: Number of requests remaining in the current window
            </p>
            <p>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">X-RateLimit-Reset</code>: Unix timestamp when the rate limit resets
            </p>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-bold">Handling Rate Limit Errors</h2>
          <p className="mb-4 text-slate-600 dark:text-slate-400">
            When you exceed the rate limit, you'll receive a 429 Too Many Requests response:
          </p>
          <CodeBlock
            code={`{
  "success": false,
  "error": {
    "message": "You have exceeded your rate limit. Please try again in 45 seconds",
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 100,
      "reset": "2025-01-15T00:45:00.000Z",
      "retryAfter": 45,
      "message": "You have exceeded your rate limit. Please try again in 45 seconds"
    },
    "timestamp": "2025-01-15T00:00:00.000Z"
  }
}`}
            language="json"
          />
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-bold">Best Practices</h2>
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="mb-1 font-semibold text-green-900 dark:text-green-100">
                  Monitor rate limit headers
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Check the <code className="rounded bg-green-100 px-1 dark:bg-green-950">X-RateLimit-Remaining</code> header and slow down before hitting the limit.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="mb-1 font-semibold text-green-900 dark:text-green-100">
                  Implement exponential backoff
                </h4>
                <p className="mb-2 text-sm text-green-700 dark:text-green-300">
                  If you receive a 429 error, wait before retrying. Use exponential backoff for repeated failures.
                </p>
                <CodeBlock
                  code={`async function fetchWithRetry(url, options, maxRetries = 3) {
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
}`}
                  language="javascript"
                  className="mt-2"
                />
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="mb-1 font-semibold text-green-900 dark:text-green-100">
                  Cache responses
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Store frequently accessed data locally to reduce API calls. Player ratings don't change often.
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
              <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div>
                <h4 className="mb-1 font-semibold text-yellow-900 dark:text-yellow-100">
                  Don't make parallel requests unnecessarily
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Making many simultaneous requests will quickly exhaust your rate limit. Batch requests when possible.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-lg font-semibold">Need higher limits?</h3>
          <p className="text-slate-600 dark:text-slate-400">
            The current rate limits are designed to be generous for most use cases. If you have a legitimate need for higher limits, please reach out via{" "}
            <a
              href="https://github.com/wkoverfield/nba2kapi/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              GitHub Issues
            </a>{" "}
            with details about your use case.
          </p>
        </div>
      </div>
    </div>
  );
}
