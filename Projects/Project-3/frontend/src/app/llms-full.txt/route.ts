import { llmsFull } from "@/lib/llms";
import { publicOrigin } from "@/lib/session/request";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return new Response(llmsFull(publicOrigin(request)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
