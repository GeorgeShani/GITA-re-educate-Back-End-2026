import { NextResponse } from "next/server";

// Liveness check for docker-compose.yml's `web` healthcheck — Caddy's
// catch-all forwards everything not matched to a more specific rule here, so
// this must exist for the frontend container to ever report healthy.
// Convention borrowed from the Datodia nextjs-starter (see SCOPE.md, "What
// to take from the Datodia starters").
export function GET() {
  return NextResponse.json({ status: "ok" });
}
