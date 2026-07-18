import { createServer } from "http";
import { connectDB } from "./config/database";
import { createApp } from "./http/app";
import { createSocketServer } from "./socket";
import "dotenv/config";

const PORT = process.env.PORT || 3000;

async function startServer(): Promise<void> {
  try {
    await connectDB();

    const app = createApp();
    const httpServer = createServer(app);

    // Attach the WebSocket layer to the same HTTP server.
    createSocketServer(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
