# Midterm 4 — NestJS GraphQL API

A NestJS application exposing `auth`, `users`, and `posts` functionality entirely through GraphQL (code-first), backed by MongoDB via Mongoose, with JWT-based authentication.

## Stack

- NestJS 12 (ESM)
- GraphQL (code-first) via `@nestjs/graphql` + `@nestjs/apollo`
- MongoDB via `@nestjs/mongoose`
- JWT auth via `@nestjs/jwt` + `passport-jwt`
- `class-validator` for input validation
- `bcryptjs` for password hashing

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` and point `MONGODB_URI` at a running MongoDB instance (local or Atlas), and set a real `JWT_SECRET`.

```bash
npm run start:dev
```

The GraphQL endpoint (and Apollo Sandbox in development) is served at `http://localhost:3000/graphql`.

## Modules

- **auth** — `register` and `login` mutations. Both return an `accessToken` (JWT) and the created/authenticated `user`.
- **users** — `me` query (protected) returns the currently authenticated user.
- **posts** — full CRUD on posts. Every query and mutation in this module requires a valid JWT; `updatePost`/`deletePost` additionally require the caller to be the post's author.

## Example operations

Register:

```graphql
mutation {
  register(input: { email: "jane@example.com", firstName: "Jane", lastName: "Doe", password: "password123" }) {
    accessToken
    user { id email firstName lastName }
  }
}
```

Login:

```graphql
mutation {
  login(input: { email: "jane@example.com", password: "password123" }) {
    accessToken
    user { id email firstName lastName }
  }
}
```

Authenticated requests must send the returned `accessToken` as an `Authorization: Bearer <token>` header.

Posts (all require the `Authorization` header):

```graphql
query { posts { id title content authorId createdAt } }

mutation {
  createPost(input: { title: "Hello", content: "My first post" }) {
    id title content authorId
  }
}

mutation {
  updatePost(id: "<postId>", input: { title: "Updated title" }) {
    id title
  }
}

mutation {
  deletePost(id: "<postId>")
}
```

## Seeding

```bash
npm run seed
```

Builds the project and runs `dist/seed.js`, which ensures two sample users (`jane.doe@example.com`, `john.smith@example.com`, password `password123`) and a few sample posts exist in the configured `MONGODB_URI` database. It's idempotent — running it again won't create duplicates.

## Tests

```bash
npm run test:e2e
```

The e2e suite spins up the full app (including the Mongoose connection), so a reachable `MONGODB_URI` is required.
