# Mood Tracker

A daily mood and sleep tracker: log a check-in once a day (mood, tags, a
reflection, hours slept) and see it reflected back on a dashboard — your
current entry, running averages, and a scrollable mood/sleep trends chart
with per-day details on hover.

**Live app:** https://moodtracker-web-app.vercel.app  ·  **API:** https://moodtracker-api.vercel.app

> **Demo login** — `john.doe@example.com` / `password123`, pre-seeded with three
> weeks of check-ins so the dashboard is fully populated.

## Tech stack

- **React 19** + **Vite** (React Compiler enabled)
- **Tailwind CSS v4** (CSS-first `@theme`, no config file)
- **Framer Motion** for animation
- **react-router-dom v7** for routing/auth guards
- **Oxlint** for linting

## Features

- **Auth flow** — sign up, log in, onboarding (name + avatar), route guards
  that redirect based on session/onboarding state.
- **Mood Logger** — a 4-step dialog (mood → tags → reflection → sleep hours)
  with reactive validation (Continue is always clickable; invalid input
  surfaces an inline error instead of disabling the button).
- **Home dashboard**:
  - Current Mood / Sleep / Reflection cards for today's check-in, or a
    "Log today's mood" prompt if you haven't checked in yet.
  - Average Mood / Average Sleep, computed from your last 5 check-ins with a
    trend vs. the previous 5.
  - A **Mood & Sleep Trends** chart — every day from your first check-in to
    today, horizontally scrollable, with the most recent days animating in
    on load. Hover any bar for its mood, sleep, reflection, and tags.
- **Profile management** — update your name/avatar from the navbar's profile
  menu (Cloudinary-ready upload, PNG/JPEG up to 3MB).
- **404 page** and Vercel SPA rewrite config for deployment.

## Project structure

```
src/
  animations/     Framer Motion variants + duration/easing tokens
  assets/         icons, mood illustrations, logo
  components/
    dashboard/    Home page cards (current mood, sleep, reflection, stats, trends)
    layout/       navbar, page container, profile menu/modal, auth layout
    mood-logger/  the 4-step logging dialog and its steps
    ui/           shared primitives (Button, TextField, Tag, Dialog, ...)
  constants/      moods, emotion tags, sleep options, breakpoints
  context/        AuthProvider — session state shared across the app
  hooks/          useMediaQuery, useReducedMotion
  lib/            apiClient — fetch wrapper (token, JSON/FormData, errors)
  pages/          route-level screens (Home, auth pages, 404)
  routes/         router config + auth guards
  services/       auth + mood-log data access
  utils/          small pure helpers (cn, moodStats, file validation)
```

## Getting started

```bash
npm install
cp .env.example .env   # optional — defaults to the deployed API if unset
npm run dev       # start the dev server
npm run build      # production build to dist/
npm run preview   # preview the production build locally
npm run lint       # oxlint
```

### Environment variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the [Mood Tracker API](../backend) (no trailing slash). Falls back to the deployed API (`https://moodtracker-api.vercel.app`) if unset. On Vercel, set this in Project Settings → Environment Variables. |

## Backend

Wired to the real [Mood Tracker API](../backend) (endpoints, auth, and
Cloudinary uploads documented in [`../backend/README.md`](../backend/README.md)).

- `src/lib/apiClient.js` — thin `fetch` wrapper: attaches the Bearer token,
  serializes JSON (passing `FormData` through for avatar uploads), and
  normalizes the API's `{ message }` errors into thrown `Error`s.
- `src/context/AuthContext.jsx` — resolves the session once on mount from the
  stored token (`GET /auth/current`) and is the single source of truth for the
  current user; route guards wait on its `loading` flag.
- `src/services/{auth,moodLogs}.js` — the API calls.

Auth is a cookieless Bearer JWT, so the token is persisted in `localStorage`
under a single key (`mood-tracker:token`) — the only client-side storage the
app uses. There are no more `localStorage`-backed mocks.

## Deployment

Configured for Vercel (`vercel.json` rewrites all paths to `index.html` so
client-side routing survives a hard refresh/deep link). Root directory for
this project on Vercel should be set to `frontend/`.
