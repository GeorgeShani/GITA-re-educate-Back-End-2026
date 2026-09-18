# syntax=docker/dockerfile:1
#
# Gridline API — NestJS 12, built as ESM ("type": "module" in package.json,
# "module": "nodenext" in tsconfig.json). Nest 12 requires Node 20.19+ or
# 22.12+; this pins to the 24.x line — the current Active LTS — rather than
# 22.x, which is heading into Maintenance LTS. A floating major tag also
# pulls whatever patch Docker Hub has published most recently, so this stays
# reasonably ahead of upstream CVE fixes without pinning a patch version that
# would silently go stale.
#
# Stages:
#   deps       full install (incl. devDependencies) — reused by build + migrate
#   build      `nest build` -> dist/, still has devDependencies
#   prod-deps  a second, dev-dependency-free install for the runtime image
#   runtime    what actually ships: prod deps + compiled dist only

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
