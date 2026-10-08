import { llmsIndex } from "@/lib/llms";
import { publicOrigin } from "@/lib/session/request";

// The links carry the address the visitor used, so this is built per request (and cached by whoever sits in front for an hour).
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return new Response(llmsIndex(publicOrigin(request)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
