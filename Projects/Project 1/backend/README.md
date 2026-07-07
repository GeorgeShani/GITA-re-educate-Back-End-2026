# Mood Tracker API

REST API for the [Mood Tracker](../frontend) app: accounts, profile/avatar
management, and daily mood check-ins. Node + Express + MongoDB, layered
architecture (routes → validation → controllers → services → models).

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

## Deployment (Vercel)

`vercel.json` uses the `builds`/`routes` format, pointing directly at
`index.js`. `index.js` exports the Express app as its default export (what
`@vercel/node` invokes per request) and only calls `app.listen()` when
`process.env.VERCEL` isn't set, so local dev is unaffected.

Import as its own Vercel project with **Root Directory** set to
`Projects/Project 1/backend` (this is a monorepo). Framework Preset "Other";
leave Build Command/Output Directory at their defaults — `vercel.json`'s
`builds` config takes over the build. Add all five environment variables
above in Project Settings, and make sure MongoDB Atlas's Network Access
allows connections from anywhere (`0.0.0.0/0`), since serverless functions
don't have a fixed IP.
