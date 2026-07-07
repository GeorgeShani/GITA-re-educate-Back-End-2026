import mongoose from "mongoose";

// Cached at module scope so a warm serverless invocation (Vercel) reuses the
// existing connection instead of opening a new one per request — repeated
// fresh connections would otherwise exhaust MongoDB Atlas's connection limit
// under concurrent invocations. Locally this just means "connect once, on
// first request."
let connectionPromise = null;

export function connectToMongoDB() {
  if (connectionPromise) return connectionPromise;

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing in .env");
  }

  connectionPromise = mongoose
    .connect(mongoUri, {
      // Fail in ~8s on a cold/unreachable cluster instead of hanging on the
      // 30s default — a slow connect should surface as an error the client
      // can retry (Home has a "Try again"), not a request that stalls for half
      // a minute. Kept above 5s so a paused M0 tier still has time to wake.
      serverSelectionTimeoutMS: 8000,
      // A single warm serverless instance handles requests serially, so a
      // small pool is plenty and keeps us well under Atlas's connection limit
      // across concurrent invocations.
      maxPoolSize: 10,
    })
    .then(() => {
      console.log("Connected to MongoDB");
    });

  return connectionPromise;
}
