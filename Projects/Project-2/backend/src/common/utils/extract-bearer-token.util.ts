import type { Request } from 'express';

// Shared by JwtAuthGuard and OptionalJwtAuthGuard (S8) — factored out
// once a second guard needed the exact same "Authorization: Bearer
// <token>" parsing.
export function extractBearerToken(request: Request): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}
