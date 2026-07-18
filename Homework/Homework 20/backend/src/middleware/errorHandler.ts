import type { ErrorRequestHandler, RequestHandler } from "express";
import { Error as MongooseError } from "mongoose";

/** 404 handler for unmatched routes. */
export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

/**
 * Central error handler. Translates the mongoose errors we actually expect
 * (validation, bad ObjectId, duplicate key) into clean HTTP responses.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof MongooseError.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({ message: "Validation failed", errors: messages });
    return;
  }

  if (err instanceof MongooseError.CastError) {
    res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
    return;
  }

  // Duplicate key (e.g. a username that is already taken).
  if (typeof err === "object" && err !== null && "code" in err && err.code === 11000) {
    res.status(409).json({ message: "That username is already taken" });
    return;
  }

  // Errors thrown by body-parser / http-errors carry an HTTP status code
  // (e.g. a malformed JSON body is a 400, not a server fault).
  if (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof err.statusCode === "number" &&
    err.statusCode < 500
  ) {
    const message =
      "type" in err && err.type === "entity.parse.failed"
        ? "Malformed JSON in request body"
        : "message" in err && typeof err.message === "string"
          ? err.message
          : "Bad request";
    res.status(err.statusCode).json({ message });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
};
