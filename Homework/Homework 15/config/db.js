import mongoose from "mongoose";

export async function connectToMongoDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing in .env");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");
}
