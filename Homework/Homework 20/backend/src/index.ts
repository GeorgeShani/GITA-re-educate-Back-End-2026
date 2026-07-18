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

    // Bind explicitly to 0.0.0.0: Fly's proxy connects over its private
    // network, and Node's default host resolution doesn't reliably bind
    // there in Fly's container networking.
    httpServer.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
