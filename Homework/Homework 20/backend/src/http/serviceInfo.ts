import type { Request, Response } from "express";

/**
 * A machine- and human-readable map of the whole backend surface: the REST
 * endpoints under `/api` and the Socket.IO event contract. Served at the root
 * `/` so anyone hitting the bare origin gets a self-describing index instead
 * of a 404. Kept in sync by hand with `routes/` and `socket/events.ts`.
 */
const SERVICE_INFO = {
  name: "cs-quiz.arena API",
  version: "1.0.0",
  status: "ok",
  rest: {
    base: "/api",
    endpoints: [
      { method: "GET", path: "/api/health", description: "Liveness probe." },
      { method: "GET", path: "/api/quizzes", description: "List all quizzes (answers stripped, order shuffled)." },
      { method: "GET", path: "/api/quizzes/:id", description: "Fetch a single quiz by id." },
      { method: "POST", path: "/api/users", description: "Create a user (username)." },
      { method: "GET", path: "/api/users", description: "List users." },
      { method: "GET", path: "/api/users/:id", description: "Fetch a single user by id." },
      { method: "PATCH", path: "/api/users/:id", description: "Update a user's username." },
      { method: "DELETE", path: "/api/users/:id", description: "Delete a user and their history." },
    ],
  },
  websocket: {
    transport: "socket.io",
    path: "/socket",
    events: {
      "client->server": [
        { name: "user:join", payload: "{ userId }", description: "Register as online; triggers a users:online broadcast." },
        { name: "answer:submit", payload: "{ userId, quizId, questionId, answer }", description: "Submit an answer for grading." },
      ],
      "server->client": [
        { name: "users:online", payload: "{ count, users }", description: "Current online users, broadcast on join/disconnect." },
        { name: "answer:result", payload: "{ quizId, questionId, correct, correctAnswer, awardedPoints, totalScore, alreadyAnswered }", description: "Grading result for a submission." },
        { name: "leaderboard:update", payload: "LeaderboardEntry[]", description: "Broadcast whenever a score changes." },
        { name: "error", payload: "{ message }", description: "A malformed request or server-side problem." },
      ],
    },
  },
} as const;

/** Serves the service index at the root path. */
export function serviceInfo(_req: Request, res: Response): void {
  res.json(SERVICE_INFO);
}
