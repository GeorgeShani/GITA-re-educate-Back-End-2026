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

  connectionPromise = mongoose.connect(mongoUri).then(() => {
    console.log("Connected to MongoDB");
  });

  return connectionPromise;
}
