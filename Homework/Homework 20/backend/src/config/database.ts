import mongoose from "mongoose";
import "dotenv/config";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/quiz-app";

export async function connectDB(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB Connected ✅");
}
