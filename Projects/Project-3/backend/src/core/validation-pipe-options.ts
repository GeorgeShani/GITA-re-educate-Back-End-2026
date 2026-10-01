import type { ValidationPipeOptions } from '@nestjs/common';

/**
 * The one set of rules every request body and query is validated under: the global `ValidationPipe` (REST) and the
 * MCP tools (which validate their input against the very same DTO classes) both read it, so an agent is held to
 * exactly what a REST client is.
 */
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  // Strip unknown properties, and reject rather than silently ignore
  // them — a client sending `{ role: 'admin' }` at a route that doesn't
  // accept it should get a 400, not have it quietly dropped.
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  // Deliberately NOT enableImplicitConversion. It coerces too eagerly
  // (`?flag=false` becomes `true` for a boolean-typed field), so query
  // DTOs carry explicit `@Type(() => Number)` instead. More verbose,
  // predictable in exchange.
};
