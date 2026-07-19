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
  // Connect straight over WebSocket instead of socket.io's default
  // long-polling-then-upgrade dance. That default costs an extra HTTP
  // handshake + upgrade round-trip before the real-time channel is live, which
  // is what delays the first users:online / leaderboard:update. Fly's proxy
  // supports WebSocket end-to-end, so there's no need to fall back to polling.
  transports: ["websocket"],
});
