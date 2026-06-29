import { CodeBlock } from "@/components/code-block";
import { AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ErrorsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-4xl font-bold">Error Handling</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Understand error responses and how to handle them in your application.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="mb-3 text-2xl font-bold">Error Response Format</h2>
          <p className="mb-4 text-slate-600 dark:text-slate-400">
            All API errors follow a consistent JSON format:
          </p>
          <CodeBlock
            code={`{
  "success": false,
  "error": {
    "message": "A human-readable error message",
    "code": "ERROR_CODE",
    "details": {} // Optional additional context
  }
}`}
            language="json"
          />
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-bold">HTTP Status Codes</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Common Causes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-sm">200</TableCell>
                  <TableCell>Success</TableCell>
                  <TableCell>Request completed successfully</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">400</TableCell>
                  <TableCell>Bad Request</TableCell>
                  <TableCell>Invalid parameters or malformed request</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">401</TableCell>
                  <TableCell>Unauthorized</TableCell>
                  <TableCell>Missing or invalid API key</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">404</TableCell>
                  <TableCell>Not Found</TableCell>
                  <TableCell>Resource doesn't exist</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">429</TableCell>
                  <TableCell>Too Many Requests</TableCell>
                  <TableCell>Rate limit exceeded</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono text-sm">500</TableCell>
                  <TableCell>Internal Server Error</TableCell>
                  <TableCell>Server-side error occurred</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-bold">Common Error Codes</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-mono text-sm font-semibold">MISSING_API_KEY</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                No API key was provided in the request headers.
              </p>
              <CodeBlock
                code={`{
  "success": false,
  "error": {
    "message": "API key is required",
    "code": "MISSING_API_KEY"
  }
}`}
                language="json"
              />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                <strong>Solution:</strong> Include your API key in the X-API-Key header.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-mono text-sm font-semibold">INVALID_API_KEY</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                The provided API key is invalid or expired.
              </p>
              <CodeBlock
                code={`{
  "success": false,
  "error": {
    "message": "Invalid API key",
    "code": "INVALID_API_KEY"
  }
}`}
                language="json"
              />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                <strong>Solution:</strong> Verify your API key is correct in your dashboard.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-mono text-sm font-semibold">RATE_LIMIT_EXCEEDED</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                You've exceeded the rate limit for your API key.
              </p>
              <CodeBlock
                code={`{
  "success": false,
  "error": {
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "code": "RATE_LIMIT_EXCEEDED",
    "retryAfter": 45
  }
}`}
                language="json"
              />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                <strong>Solution:</strong> Wait for the duration specified in retryAfter or implement exponential backoff.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-mono text-sm font-semibold">PLAYER_NOT_FOUND</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                The requested player doesn't exist in the database.
              </p>
              <CodeBlock
                code={`{
  "success": false,
  "error": {
    "message": "Player not found",
    "code": "PLAYER_NOT_FOUND"
  }
}`}
                language="json"
              />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                <strong>Solution:</strong> Verify the player slug or ID is correct. Use the search endpoint to find players.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-mono text-sm font-semibold">INVALID_PARAMETERS</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                One or more query parameters are invalid or out of range.
              </p>
              <CodeBlock
                code={`{
  "success": false,
  "error": {
    "message": "Invalid parameter: limit must be between 1 and 100",
    "code": "INVALID_PARAMETERS",
    "details": {
      "parameter": "limit",
      "value": 500,
      "constraint": "Must be between 1 and 100"
    }
  }
}`}
                language="json"
              />
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                <strong>Solution:</strong> Check the API documentation for valid parameter values and constraints.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-bold">Error Handling Best Practices</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-semibold">Always Check Response Status</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Check both HTTP status codes and the success field in the response.
              </p>
              <CodeBlock
                code={`const response = await fetch(url, { headers });

if (!response.ok) {
  const error = await response.json();
  console.error('API Error:', error.error.message);

  // Handle specific error codes
  switch (error.error.code) {
    case 'MISSING_API_KEY':
    case 'INVALID_API_KEY':
      // Update credentials
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // Wait and retry
      break;
    case 'PLAYER_NOT_FOUND':
      // Show not found message
      break;
  }
}`}
                language="javascript"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-semibold">Implement Retry Logic</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Retry failed requests with exponential backoff for transient errors.
              </p>
              <CodeBlock
                code={`async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return await response.json();
      }

      // Don't retry client errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw new Error(\`Client error: \${response.status}\`);
      }

      // Exponential backoff
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}`}
                language="javascript"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="mb-2 font-semibold">Log Errors for Debugging</h4>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                Keep detailed logs of API errors to help diagnose issues.
              </p>
              <CodeBlock
                code={`try {
  const data = await fetchPlayer('lebron-james');
} catch (error) {
  // Log full error details
  console.error('Failed to fetch player:', {
    timestamp: new Date().toISOString(),
    endpoint: '/api/players/lebron-james',
    error: error.message,
    code: error.code,
    details: error.details
  });

  // Show user-friendly message
  showErrorMessage('Unable to load player data. Please try again.');
}`}
                language="javascript"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
          <AlertCircle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div>
            <h4 className="mb-1 font-semibold text-yellow-900 dark:text-yellow-100">
              Need Help with an Error?
            </h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              If you're experiencing persistent errors or need clarification about an error code, please open an issue on{" "}
              <a
                href="https://github.com/wkoverfield/nba2kapi/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline"
              >
                GitHub
              </a>{" "}
              with details about the error, your request, and any relevant logs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
