# Mood Tracker API

REST API for the [Mood Tracker](../frontend) app: accounts, profile/avatar
management, and daily mood check-ins. Node + Express + MongoDB, layered
architecture (routes → validation → controllers → services → models).

**Live API:** https://moodtracker-api.vercel.app (the root path serves
interactive API docs) · **Web app:** https://moodtracker-web-app.vercel.app

## Tech stack

- **Express 5** (ES modules)
- **MongoDB** + **Mongoose**
- **JWT** (Bearer token) auth, **bcrypt** password hashing
- **Cloudinary** for avatar image uploads (via **multer**, memory storage)
- **Zod** for request validation
- **cors** for cross-origin requests from the frontend

## Project structure

```
config/         mongoose connection, JWT sign/verify, Cloudinary SDK config
constants/      mood/sleep/tag enums — mirrored from the frontend's
                src/constants/*.js, kept manually in sync
lib/            Cloudinary upload/delete helpers
middlewares/    isAuth (JWT), validate (zod), upload (multer)
models/         User, MoodLog (Mongoose schemas)
validations/    zod schemas per route group
controllers/    request/response handling, maps service errors to HTTP status
services/       business logic + database access
routes/         Express routers
docs/           the HTML API docs page served at GET /
scripts/        one-off maintenance scripts (see "Scripts" below)
index.js        app setup, CORS, route mounting, server start
```

## Getting started

```bash
npm install
cp .env.example .env   # fill in your own values
npm run dev             # node --watch index.js
```

### Environment variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas (or any Mongo) connection string |
| `JWT_SECRET` | Secret used to sign/verify JWTs |
| `PORT` | Local dev port (default 3000) — unused on Vercel |
| `CLOUDINARY_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

## Auth

Stateless Bearer JWT — no server-side session, no cookies. Send
`Authorization: Bearer <token>` on every request to a protected endpoint. The
`isAuth` middleware verifies the token and sets `req.userId`; nothing else
(mood logs, profile updates) ever trusts a client-supplied user ID.

Tokens expire after 7 days.

## Endpoints

All bodies are JSON except `PATCH /users/me` (`multipart/form-data`). Every
error response is `{ "message": "..." }`.

### `POST /auth/sign-up`
Body: `{ email, password }`. Creates the account and returns a token
immediately (no separate login step). `201 { token, user }`, or `400` if the
email is already registered.

### `POST /auth/sign-in`
Body: `{ email, password }`. `200 { token, user }`, or `400` on bad
credentials.

### `GET /auth/current` 🔒
Returns the authenticated user. `200 { user }`.

### `PATCH /users/me` 🔒
`multipart/form-data`: `name` (required) + optional `avatar` file (PNG/JPEG,
max 3MB). Replaces both "complete onboarding" and "update profile" — they're
the same operation; if the account hadn't onboarded yet, this flips
`hasOnboarded` to `true`. Replacing an avatar deletes the previous Cloudinary
asset first. `200 { user }`.

### `POST /mood-logs` 🔒
Body: `{ mood, tags, reflection, sleepHours }`. `user` and `loggedAt` are set
server-side from the authenticated request — never from the body. `201 { log }`.

### `GET /mood-logs` 🔒
All of the current user's logs, oldest first. `200 MoodLog[]`.

🔒 = requires `Authorization: Bearer <token>`

### Enums

- `mood`: `veryHappy` · `happy` · `neutral` · `sad` · `verySad`
- `sleepHours`: `9+` · `7-8` · `5-6` · `3-4` · `0-2`
- `tags`: 1–3 of the 20 values in `constants/emotionTags.js`

## Scripts

Both run against whatever `MONGODB_URI` points at, so double-check your `.env`
before using them on the live database.

| Command | What it does |
|---|---|
| `npm run dev` | Start the API locally (`node --watch index.js`). |
| `npm start` | Start the API without watch. |

## Performance notes

**Region co-location is the biggest lever.** The function, the MongoDB Atlas
cluster, and your users should all be in the same region — a cross-region layout
(e.g. function in US-East querying a cluster in Singapore) adds hundreds of ms to
every request. `vercel.json` pins the function to `fra1` (Frankfurt); the Atlas
cluster should live in the matching region (`eu-central-1`).

On Vercel's serverless runtime the Mongo connection is cached at module scope
(`config/db.js`) so warm invocations reuse it. The remaining latency source is
**cold starts** after the function idles; a periodic external ping to `/`
(e.g. UptimeRobot every ~5 min) keeps the function and its DB connection warm.
The `dns.setServers(...)` SRV workaround in `index.js` runs only outside Vercel
(local dev), and `mongoose.connect` uses an 8s server-selection timeout so a
cold/unreachable cluster fails fast instead of hanging.

## Deployment (Vercel)

`vercel.json` contains **only** a `regions` pin (`fra1`) — no `builds`/`routes`,
so Vercel's zero-config Express support still applies: it detects `index.js` at
the project root and invokes its default export per request. (A `builds` array
is deliberately avoided — an earlier one derived the serverless function's *name*
from the full Root Directory path, which broke when that path contained a space.
A `regions`-only config doesn't create a named build, so it's safe.) `index.js`
only calls `app.listen()` when `process.env.VERCEL` isn't set, so local dev is
unaffected.

Import as its own Vercel project with **Root Directory** set to
`Projects/Project-1/backend` (this is a monorepo). Framework Preset
"Express" (or "Other" — either works); Build Command/Output Directory don't
apply. Add all five environment variables above in Project Settings, and
make sure MongoDB Atlas's Network Access allows connections from anywhere
(`0.0.0.0/0`), since serverless functions don't have a fixed IP.

The `fra1` region is also selectable in **Project Settings → Functions →
Function Region** if you prefer the dashboard over `vercel.json`; keep the two
in agreement.
