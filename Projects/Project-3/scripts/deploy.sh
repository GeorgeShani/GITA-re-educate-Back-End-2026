#!/usr/bin/env bash
# Brings the running app up to date with the branch on GitHub, and puts it back if the new version does not come up.
#
#   scripts/deploy.sh            deploy only if the branch has new commits (what the timer runs)
#   scripts/deploy.sh --force    rebuild and relaunch the current commit even if nothing is new
#
# What it does, in order:
#   1. takes a lock, so two runs never overlap;
#   2. `git fetch`, and stops if there is nothing new (or if that exact commit already failed to start once);
#   3. `git merge --ff-only`: the server never makes its own commits, it only follows the branch;
#   4. `docker compose up -d --build` with the production layer. The `migrate` service applies new migrations first;
#   5. waits for https://<SITE_ADDRESS>/api/health;
#   6. if that never answers, goes back to the previous commit and rebuilds it, and remembers the bad commit so it is
#      not tried again every few minutes. A fix pushed afterwards is a different commit and is deployed normally.
#
# Database migrations are not undone by a rollback. Migrations here only add (a column, a table, an enum value), which
# the previous version tolerates; keep it that way.
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_TIMEOUT_SECONDS="${DEPLOY_HEALTH_TIMEOUT:-180}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_FILE="$PROJECT_DIR/.deploy-last-failed"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

log() { printf '%s deploy: %s\n' "$(date -u +%FT%TZ)" "$*"; }

cd "$PROJECT_DIR"

exec 9>/tmp/gridline-deploy.lock
if ! flock -n 9; then
  log "another deploy is running; leaving it to finish"
  exit 0
fi

FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

# Where to ask "is it up?": the public address when there is one, the local port otherwise (no domain set).
site_address=""
if [ -f .env ]; then
  site_address="$(grep -E '^SITE_ADDRESS=' .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
fi
if [ -n "$site_address" ] && [ "${site_address#:}" = "$site_address" ]; then
  HEALTH_URL="https://${site_address}/api/health"
else
  HEALTH_URL="http://localhost:3000/api/health"
fi

# Records the commit in the root .env, where Compose reads it (docker-compose.yml passes it to the api as GIT_SHA, for Observe's
# releases). Writing it there, not only exporting it, keeps a later hand-run `docker compose up` from blanking it.
record_commit() {
  local sha
  sha="$(git rev-parse --short HEAD)"
  touch .env
  if grep -q '^GIT_SHA=' .env; then
    sed -i "s/^GIT_SHA=.*/GIT_SHA=$sha/" .env
  else
    echo "GIT_SHA=$sha" >> .env
  fi
  export GIT_SHA="$sha"
}

healthy() { curl -fsS --max-time 10 -o /dev/null "$HEALTH_URL"; }

wait_until_healthy() {
  local waited=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT_SECONDS" ]; do
    if healthy; then return 0; fi
    sleep 5
    waited=$((waited + 5))
  done
  return 1
}

git fetch --quiet origin "$BRANCH"
current="$(git rev-parse HEAD)"
target="$(git rev-parse "origin/$BRANCH")"

if [ "$current" = "$target" ] && [ "$FORCE" -eq 0 ]; then
  exit 0 # nothing new: say nothing, this runs every few minutes
fi
if [ "$FORCE" -eq 0 ] && [ -f "$STATE_FILE" ] && [ "$(cat "$STATE_FILE")" = "$target" ]; then
  exit 0 # this commit already failed to start; wait for a newer one
fi

log "updating ${current:0:7} -> ${target:0:7} on $BRANCH"
if [ "$current" != "$target" ]; then
  if ! git merge --ff-only "origin/$BRANCH"; then
    log "cannot fast-forward (the server has changes of its own). Fix that by hand: git status"
    exit 1
  fi
fi

record_commit
if "${COMPOSE[@]}" up -d --build && wait_until_healthy; then
  rm -f "$STATE_FILE"
  docker image prune -f >/dev/null 2>&1 || true
  log "deployed ${target:0:7}; $HEALTH_URL answers"
  exit 0
fi

log "${target:0:7} did not come up healthy; going back to ${current:0:7}"
echo "$target" > "$STATE_FILE"
"${COMPOSE[@]}" logs --tail=60 api web migrate 2>&1 | sed 's/^/    /' || true
git reset --hard "$current"
record_commit
"${COMPOSE[@]}" up -d --build
if wait_until_healthy; then
  log "rolled back to ${current:0:7}; the app is up on the old version"
else
  log "ROLLBACK ALSO FAILED: the app is down. Look at: docker compose logs api"
fi
exit 1
