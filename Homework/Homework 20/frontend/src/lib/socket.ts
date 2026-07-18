import { io, type Socket } from "socket.io-client";

// Mirrors backend/src/socket/events.ts.
export const SocketEvent = {
  USER_JOIN: "user:join",
  ANSWER_SUBMIT: "answer:submit",
  USERS_ONLINE: "users:online",
  ANSWER_RESULT: "answer:result",
  LEADERBOARD_UPDATE: "leaderboard:update",
  ERROR: "error",
} as const;

export const socket: Socket = io(import.meta.env.VITE_SOCKET_URL, {
  path: "/socket",
  autoConnect: false,
});
