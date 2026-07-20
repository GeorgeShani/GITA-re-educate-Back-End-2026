import { io, type Socket } from "socket.io-client";

// Mirrors backend/src/socket/events.ts.
export const SocketEvent = {
  USER_JOIN: "user:join",
  ANSWER_SUBMIT: "answer:submit",
  USERS_ONLINE: "users:online",
  ANSWER_RESULT: "answer:result",
  LEADERBOARD_UPDATE: "leaderboard:update",
  SESSION_KICKED: "session:kicked",
  ERROR: "error",
} as const;

export const socket: Socket = io(import.meta.env.VITE_SOCKET_URL, {
  path: "/socket",
  autoConnect: false,
  // Default polling->upgrade transport (NOT websocket-only). A silently-dropped
  // idle connection recovers more reliably through polling than a wedged
  // websocket, and the latency reason we once forced websocket for is gone now
  // that the DB is co-located with the server.
  // Reconnection settings are mostly the socket.io defaults, made explicit.
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
