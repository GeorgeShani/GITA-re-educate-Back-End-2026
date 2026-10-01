import type { INestApplication } from '@nestjs/common';
import { json, type NextFunction, type Request, type Response } from 'express';
import { MAX_MCP_UPLOAD_BYTES } from './uploads.js';

/** Base64 inflates by a third; the rest is room for the JSON around it. */
export const MCP_BODY_LIMIT_BYTES = Math.ceil((MAX_MCP_UPLOAD_BYTES * 4) / 3) + 64 * 1024;

/**
 * Express's default JSON limit (100 KB) is far too small for an agent that sends a file inside a tool call. This
 * raises it for `/mcp` ONLY and must run BEFORE `app.init()` (Nest registers its own parser then, and a body that
 * is already parsed is skipped by it). Every other route keeps the default: files go through multipart there.
 *
 * A request with no `Authorization` header skips the large parser and meets the default limit, so an anonymous caller
 * cannot make the server buffer megabytes only to answer 401. (The header is not checked here; `AuthGuard` does that.)
 */
export function installMcpBodyParser(app: INestApplication): void {
  const parse = json({ limit: MCP_BODY_LIMIT_BYTES });
  app.use('/mcp', (request: Request, response: Response, next: NextFunction) =>
    request.headers.authorization ? parse(request, response, next) : next(),
  );
}
