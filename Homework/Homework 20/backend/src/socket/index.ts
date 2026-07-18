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
  });

  io.on(SocketEvent.CONNECTION, (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    registerQuizHandlers(io, socket);
  });

  return io;
}
