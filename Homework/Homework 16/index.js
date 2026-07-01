import "dotenv/config";
import express from "express";
import { connectToMongoDB } from "./config/db.js";
import authRouter from "./routes/auth.route.js";
import blogRouter from "./routes/blog.route.js";
import userRouter from "./routes/user.route.js";
import dns from "dns";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use("/auth", authRouter);
app.use("/blogs", blogRouter);
app.use("/users", userRouter);

async function startServer() {
  try {
    await connectToMongoDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();
