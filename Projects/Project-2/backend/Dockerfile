# syntax=docker/dockerfile:1

# Deploy image for Fly.io — built once here, run as-is by fly.toml's
# Dockerfile-based build. Two stages so the final image ships only
# production node_modules + compiled dist/, not the TypeScript source,
# devDependencies, or the build toolchain.

FROM node:24-slim AS builder
WORKDIR /app

# bcrypt is a native addon. Debian glibc almost always resolves a
# prebuilt binary for it with no compiler needed, but these are here as
# a fallback so the build never silently breaks if one isn't published
# for this exact Node/arch combination.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Dependencies first, for layer caching — patches/ has to be present
# before `npm ci` runs, since its postinstall (patch-package) reads it.
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Drop devDependencies from the already-built node_modules — `npm prune`,
# not a second `npm ci --omit=dev`: a fresh install reruns every
# lifecycle script, including patch-package's own postinstall hook,
# which fails once --omit=dev has removed patch-package itself (it's a
# devDependency, since its one patch target, tsc-alias, is build-only).
# `--ignore-scripts` would dodge that, but it also skips bcrypt's own
# install-time native-binding build — breaking login at runtime instead.
# Pruning removes packages without re-running scripts on what remains.
RUN npm prune --omit=dev

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 4000
CMD ["node", "dist/main"]
