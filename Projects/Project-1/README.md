# Mood Tracker

A full-stack daily **mood and sleep tracker**. Log one check-in a day — mood,
emotion tags, a short reflection, and hours slept — and see it reflected back on
a dashboard with your current entry, running averages, and a scrollable
mood/sleep trends chart.

<table>
<tr>
<td><strong>🌐 Live app</strong></td>
<td><a href="https://moodtracker-web-app.vercel.app">moodtracker-web-app.vercel.app</a></td>
</tr>
<tr>
<td><strong>🔌 Live API</strong></td>
<td><a href="https://moodtracker-api.vercel.app">moodtracker-api.vercel.app</a> (root path serves interactive API docs)</td>
</tr>
<tr>
<td><strong>🔑 Demo login</strong></td>
<td><code>john.doe@example.com</code> / <code>password123</code> — pre-seeded with three weeks of check-ins</td>
</tr>
</table>

This is a monorepo with two independently deployed apps:

```
Project-1/
  frontend/   React SPA          → https://moodtracker-web-app.vercel.app
  backend/    Express REST API   → https://moodtracker-api.vercel.app
  README.md   (you are here)
```

Each has its own detailed README — [`frontend/README.md`](frontend/README.md)
and [`backend/README.md`](backend/README.md).

## Features

- **Auth flow** — sign up, log in, and onboarding (name + avatar), with route
  guards that redirect based on session and onboarding state.
- **Mood Logger** — a 4-step dialog (mood → tags → reflection → sleep hours)
  with reactive, inline validation.
- **Dashboard** — today's check-in cards, last-5-check-in averages with a trend
  vs. the previous 5, and a per-day Mood & Sleep Trends chart with hover detail.
- **Profile management** — update name and avatar; images are uploaded to
  Cloudinary (PNG/JPEG, up to 3MB).

## Tech stack

| | |
|---|---|
| **Frontend** | React 19 + Vite (React Compiler), Tailwind CSS v4 (CSS-first `@theme`), Framer Motion, react-router-dom v7, Oxlint |
| **Backend** | Express 5 (ES modules), MongoDB + Mongoose, JWT + bcrypt auth, Cloudinary + multer uploads, Zod validation, CORS |
| **Hosting** | Both apps on Vercel; MongoDB Atlas; Cloudinary for image assets |

## How it fits together

```
Browser ──HTTPS──▶ Frontend (Vercel static SPA)
                        │
                        │  fetch + Authorization: Bearer <JWT>
                        ▼
                   Backend API (Vercel serverless)
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
        MongoDB Atlas        Cloudinary
        (users, logs)      (avatar images)
```

- Auth is a **stateless Bearer JWT** (no cookies, no server session). The
  frontend stores the token in `localStorage` under one key and sends it on
  every protected request; the API's `isAuth` middleware verifies it and sets
  `req.userId`. The client never supplies a user ID.
- The frontend's `AuthContext` resolves the session once on load via
  `GET /auth/current` and is the single source of truth for the current user;
  route guards wait on its loading state.

## API at a glance

| Method | Path | Auth | Purpose |
|---|---|:---:|---|
| `POST` | `/auth/sign-up` | | Create account, returns `{ token, user }` |
| `POST` | `/auth/sign-in` | | Log in, returns `{ token, user }` |
| `GET` | `/auth/current` | 🔒 | The authenticated user |
| `PATCH` | `/users/me` | 🔒 | Update name/avatar (multipart) — also completes onboarding |
| `POST` | `/mood-logs` | 🔒 | Create today's check-in |
| `GET` | `/mood-logs` | 🔒 | All of the user's logs, oldest first |

Full request/response shapes are in [`backend/README.md`](backend/README.md).

## Getting started

Both apps are standard `npm` projects. Run each in its own terminal.

**Backend** (needs its own `.env` — see [`backend/README.md`](backend/README.md)
for the required Mongo / JWT / Cloudinary variables):

```bash
cd backend
npm install
cp .env.example .env   # fill in your values
npm run dev            # http://localhost:3000
```

**Frontend:**

```bash
cd frontend
npm install
cp .env.example .env   # set VITE_API_BASE_URL (defaults to the deployed API)
npm run dev            # http://localhost:5173
```

To run fully locally, point the frontend at your local backend by setting
`VITE_API_BASE_URL=http://localhost:3000` in `frontend/.env`.

## Demo data

The backend ships a seed script that creates the **John Doe** showcase account
with a profile photo and ~3 weeks of realistic daily check-ins (including one
for today, so the dashboard shows the fully populated state):

```bash
cd backend
npm run seed:john      # john.doe@example.com / password123
```

It's re-runnable (wipes John's previous data first) and dates are relative to
"today," so re-running keeps the demo current. See the backend README's
**Scripts** section for `clean-db` and options.

## Deployment

Each app is imported as its own Vercel project (monorepo — set the Root
Directory to `frontend/` or `backend/` respectively). The frontend is a static
SPA with a rewrite so client-side routing survives deep links; the backend runs
as zero-config serverless Express. Deployment specifics — including the required
environment variables and MongoDB Atlas network settings — are documented in
each app's README.
