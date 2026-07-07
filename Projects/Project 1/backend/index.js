import "dotenv/config";
import { connectToMongoDB } from "./config/db.js";
import { API_DOCS_HTML } from "./docs/apiDocsPage.js";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import moodLogRouter from "./routes/moodLog.route.js";
import express from "express";
import cors from "cors";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

const PORT = Number(process.env.PORT) || 3000;

// Vite dev server, Vite preview, and the deployed frontend. No credentials
// (auth is a Bearer token, not a cookie), so no need for `credentials: true`.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://moodtracker-web-app.vercel.app",
];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get("/", (req, res) => {
  res.type("html").send(API_DOCS_HTML);
});

app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/mood-logs", moodLogRouter);

// Vercel's Node runtime invokes this exported app directly as the request
// handler for every request (per vercel.json's builds/routes config) — it
// never calls .listen(), so that only happens for local dev below. Mongoose
// queues queries until connectToMongoDB() resolves, so a cold-start request
// arriving before that finishes just waits rather than failing.
export default app;

async function startServer() {
  try {
    await connectToMongoDB();
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
      });
    }
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();