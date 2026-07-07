# Mood Tracker

A daily mood and sleep tracker: log a check-in once a day (mood, tags, a
reflection, hours slept) and see it reflected back on a dashboard — your
current entry, running averages, and a scrollable mood/sleep trends chart
with per-day details on hover.

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
  menu (Cloudinary-ready upload, PNG/JPEG up to 250KB).
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
  hooks/          useMediaQuery, useReducedMotion
  pages/          route-level screens (Home, auth pages, 404)
  routes/         router config + auth guards
  services/       auth + mood-log data access
  utils/          small pure helpers (cn, moodStats, file validation)
```

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build      # production build to dist/
npm run preview   # preview the production build locally
npm run lint       # oxlint
```

## Backend

There's no real backend yet — `src/services/auth.js` and
`src/services/moodLogs.js` are `localStorage`-backed mocks so the app is
fully usable standalone. The API this app is meant to integrate with is
specced out in [`../backend/API_SPEC.md`](../backend/API_SPEC.md) (models,
endpoints, auth, CORS, Cloudinary uploads).

## Deployment

Configured for Vercel (`vercel.json` rewrites all paths to `index.html` so
client-side routing survives a hard refresh/deep link). Root directory for
this project on Vercel should be set to `frontend/`.
