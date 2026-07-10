import { LLMS_INDEX } from "@/lib/llms-docs";

export const dynamic = "force-static";

export function GET() {
  return new Response(LLMS_INDEX, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
