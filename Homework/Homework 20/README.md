# cs-quiz.arena

A real-time multiplayer computer science quiz app. Join with a username, race
through 12 CS quizzes (10 questions each), and watch a shared leaderboard and
online-users count update live over WebSockets as everyone answers.

Built as a monorepo: an Express + Socket.IO + MongoDB backend, and a Vite +
React + Zustand frontend styled as a hacker-terminal / Matrix theme.

```
Homework 20/
|-- backend/    Express + TypeScript + Socket.IO + Mongoose API
`-- frontend/   Vite + React 19 + TypeScript + Tailwind v4 + Zustand
```

## Features

- **12 CS quizzes, 10 questions each**: data structures, algorithms, OS,
  networks, databases, programming languages, web dev, computer architecture,
  cybersecurity, AI theory, design patterns, distributed systems. Questions and
  answer options are shuffled per request so position never gives it away.
- **Username-only identity**: no passwords. Usernames follow Instagram-style
  rules (letters/numbers/`.`/`_`, no leading/trailing/consecutive periods) and
  are case-insensitive; rejoining with an existing username resumes that
  account instead of failing.
- **Live leaderboard**: every correct answer (10 points, each question scores
  once per user) is graded server-side and broadcast to every connected client
  instantly.
- **Online presence**: a live count and list of who's currently connected.
- **Full account CRUD**: rename or permanently delete your account from an
  in-app settings modal (deletion requires typing `rm -rf /` to confirm).
- **Terminal/Matrix UI**: digital-rain canvas background, CRT scanlines,
  typewriter question prompts, keyboard shortcuts (`a`-`d` to answer, `Enter`
  to advance), and quiz cards "written" in the language each topic's lore is
  tied to (e.g. Design Patterns -> `.java`, Distributed Systems -> `.erl`).

## Tech stack

**Backend**: Express 5, TypeScript, Socket.IO, Mongoose/MongoDB, layered
architecture (`routes -> controllers -> services -> models`) with the HTTP and
WebSocket layers kept fully separate so `index.ts` just wires them together.

**Frontend**: Vite, React 19 (React Compiler), TypeScript, Tailwind CSS v4
(CSS-first config), Zustand for state, Framer Motion for animation, Axios for
REST calls, `socket.io-client` for the realtime layer.

## Getting started

**Prerequisites:** Node.js 22+, a MongoDB connection string (Atlas or local).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # then fill in MONGODB_URI
npm run dev             # http://localhost:3000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # defaults already point at localhost:3000
npm run dev             # http://localhost:5173
```

Open the frontend URL, pick a username, and play. Open a second browser tab
with a different username to see the leaderboard and online count update live
across clients.

## Scripts

| Location   | Script          | What it does                                              |
| ---------- | --------------- | ----------------------------------------------------------- |
| `backend/`  | `npm run dev`   | Runs the API with `tsx watch` (auto-restart on change)     |
| `backend/`  | `npm run build` | Type-checks and compiles `src/` -> `dist/` with `tsc`       |
| `backend/`  | `npm start`     | Runs the compiled build (`dist/index.js`)                   |
| `frontend/` | `npm run dev`   | Starts the Vite dev server                                   |
| `frontend/` | `npm run build` | Type-checks and builds a production bundle to `dist/`      |
| `frontend/` | `npm run lint`  | Runs `oxlint`                                                |

## Environment variables

**`backend/.env`**

| Variable      | Description                                  |
| ------------- | --------------------------------------------- |
| `MONGODB_URI` | MongoDB connection string                     |
| `PORT`        | HTTP/WebSocket port (default `3000`)          |

**`frontend/.env`**

| Variable            | Description                          |
| ------------------- | ------------------------------------- |
| `VITE_API_URL`      | Base URL for the REST API (`/api`)   |
| `VITE_SOCKET_URL`   | Base URL for the Socket.IO server    |

## REST API

Base path: `/api`.

| Method   | Path            | Description                                          |
| -------- | --------------- | ----------------------------------------------------- |
| `GET`    | `/health`       | Health check                                          |
| `GET`    | `/quizzes`      | All 12 quizzes with their questions (no answers); shuffled by default, `?shuffle=false` to disable |
| `GET`    | `/quizzes/:id`  | A single quiz                                         |
| `POST`   | `/users`        | Create a user: `{ "username": string }`              |
| `GET`    | `/users`        | List all users, sorted by score desc                 |
| `GET`    | `/users/:id`    | Get one user                                          |
| `PATCH`  | `/users/:id`    | Update a user: `{ "username"?, "score"? }`            |
| `DELETE` | `/users/:id`    | Delete a user                                         |

## Socket.IO events

| Direction        | Event                | Payload                                                                 |
| ----------------- | --------------------- | ------------------------------------------------------------------------ |
| client -> server  | `user:join`          | `{ userId }`                                                             |
| client -> server  | `answer:submit`      | `{ userId, quizId, questionId, answer }` (`answer` is the option text)  |
| server -> client  | `users:online`       | `{ count, users: [{ userId, username }] }`                              |
| server -> client  | `answer:result`      | `{ quizId, questionId, correct, correctAnswer, awardedPoints, totalScore, alreadyAnswered }` |
| server -> client  | `leaderboard:update` | `[{ rank, userId, username, score }]`, broadcast to all clients         |
| server -> client  | `error`               | `{ message }`                                                            |

Correct answers are worth 10 points; each question can only score once per
user (tracked via `answeredQuestions` on the user document).

## Project structure

```
backend/src/
|-- index.ts              entry point: connects DB, wires HTTP + sockets, listens
|-- config/                database connection
|-- http/app.ts             Express app factory (middleware + routes)
|-- socket/                 Socket.IO server setup, event contracts, handlers
|-- routes/, controllers/, services/, models/    layered REST API
|-- data/quizzes.ts         the 12 seeded quizzes
`-- middleware/              async error handling

frontend/src/
|-- App.tsx                 screen routing (join / lobby / quiz)
|-- screens/                 JoinScreen, LobbyScreen, QuizScreen
|-- components/               presentational UI (terminal chrome, leaderboard, etc.)
|-- store/sessionStore.ts    Zustand store: session, socket lifecycle, live state
|-- lib/                       REST client, socket client, validation, helpers
`-- hooks/                     small reusable hooks (typewriter, keyboard shortcuts)
```
