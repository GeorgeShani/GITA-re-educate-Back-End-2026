import type { RequestHandler } from "express";

/**
 * Wraps an async route handler so any rejected promise is forwarded to
 * Express's error middleware instead of crashing the process.
 */
export const asyncHandler =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
