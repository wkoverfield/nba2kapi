import { LLMS_FULL } from "@/lib/llms-docs";

export const dynamic = "force-static";

export function GET() {
  return new Response(LLMS_FULL, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
