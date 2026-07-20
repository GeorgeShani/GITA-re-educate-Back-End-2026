import { Server as SocketIoServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { SocketEvent } from "./events";
import { registerQuizHandlers } from "./handlers/quiz.handler";

/**
 * Attaches a Socket.IO server to the given HTTP server and wires up the
 * connection lifecycle. All per-socket event handling lives in the handlers;
 * this file only owns setup and connection routing.
 */
export function createSocketServer(httpServer: HttpServer): SocketIoServer {
  const io = new SocketIoServer(httpServer, {
    path: "/socket",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Detect a silently-dropped connection in ~10-20s instead of the ~45s the
    // 25s/20s defaults give, so the client starts reconnecting sooner after an
    // idle NAT/router timeout kills the TCP without a clean close.
    pingInterval: 10000,
    pingTimeout: 10000,
  });

  // Surface handshake/transport failures that never become a full connection
  // (CORS rejects, failed upgrades) - otherwise they're invisible server-side.
  io.engine.on("connection_error", (err) => {
    console.error(`Engine connection_error: ${err.code} ${err.message}`);
  });

  io.on(SocketEvent.CONNECTION, (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    registerQuizHandlers(io, socket);
  });

  return io;
}
