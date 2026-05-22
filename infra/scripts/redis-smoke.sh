#!/usr/bin/env bash
# redis-smoke.sh — Tiny smoke test for Redis-backed API caching.
#
# Usage examples:
#   BASE_URL="http://127.0.0.1:3005" CACHE_ADMIN_KEY="secret" bash infra/scripts/redis-smoke.sh
#   BASE_URL="https://ghs.socx.org.uk" CACHE_ADMIN_KEY="secret" bash infra/scripts/redis-smoke.sh
#
# Verifies:
#   1) Redis responds to PING (local mode only)
#   2) API health is reachable
#   3) Dashboard endpoint returns cache miss then hit
#   4) Leaderboard endpoint returns cache miss then hit
#   5) Settings endpoint returns cache miss then hit
#   6) Cache invalidation succeeds and dashboard becomes miss again

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3005}"
CACHE_ADMIN_KEY="${CACHE_ADMIN_KEY:-}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"
CHECK_LOCAL_REDIS="${CHECK_LOCAL_REDIS:-true}"

if [ -z "$CACHE_ADMIN_KEY" ]; then
  echo "[redis-smoke] ERROR: CACHE_ADMIN_KEY must be set for invalidation checks." >&2
  exit 1
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[redis-smoke] ERROR: required command not found: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd node

if [ "$CHECK_LOCAL_REDIS" = "true" ]; then
  need_cmd redis-cli
fi

json_field() {
  local json="$1"
  local field="$2"

  printf '%s' "$json" | node -e '
const fs = require("node:fs");
const input = fs.readFileSync(0, "utf8");
const path = process.argv[1].split(".");
const value = path.reduce((acc, key) => (acc == null ? undefined : acc[key]), JSON.parse(input));
if (value === undefined) {
  process.exit(2);
}
if (typeof value === "object") {
  process.stdout.write(JSON.stringify(value));
} else {
  process.stdout.write(String(value));
}
' "$field"
}

http_get() {
  curl -fsS "$BASE_URL$1"
}

http_post() {
  curl -fsS -X POST "$BASE_URL$1" "$@"
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local message="$3"

  if [ "$actual" != "$expected" ]; then
    echo "[redis-smoke] FAIL: $message (expected=$expected actual=$actual)" >&2
    exit 1
  fi

  echo "[redis-smoke] PASS: $message"
}

echo "[redis-smoke] BASE_URL=$BASE_URL"

if [ "$CHECK_LOCAL_REDIS" = "true" ]; then
  echo "[redis-smoke] Checking Redis PING on ${REDIS_HOST}:${REDIS_PORT}..."
  redis_ping="$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping)"
  assert_eq "$redis_ping" "PONG" "Redis responds to PING"
fi

echo "[redis-smoke] Checking API health..."
health_json="$(http_get "/api/health")"
health_status="$(json_field "$health_json" "status")"
assert_eq "$health_status" "ok" "API health endpoint returns status=ok"

echo "[redis-smoke] Verifying dashboard cache miss -> hit..."
dash_1="$(http_get "/api/dashboard")"
dash_1_hit="$(json_field "$dash_1" "cache.hit")"
assert_eq "$dash_1_hit" "false" "Dashboard first request is cache miss"

dash_2="$(http_get "/api/dashboard")"
dash_2_hit="$(json_field "$dash_2" "cache.hit")"
assert_eq "$dash_2_hit" "true" "Dashboard second request is cache hit"

echo "[redis-smoke] Verifying leaderboard cache miss -> hit..."
lead_1="$(http_get "/api/leaderboard?clubId=smoke")"
lead_1_hit="$(json_field "$lead_1" "cache.hit")"
assert_eq "$lead_1_hit" "false" "Leaderboard first request is cache miss"

lead_2="$(http_get "/api/leaderboard?clubId=smoke")"
lead_2_hit="$(json_field "$lead_2" "cache.hit")"
assert_eq "$lead_2_hit" "true" "Leaderboard second request is cache hit"

echo "[redis-smoke] Verifying settings cache miss -> hit..."
settings_1="$(http_get "/api/settings")"
settings_1_hit="$(json_field "$settings_1" "cache.hit")"
assert_eq "$settings_1_hit" "false" "Settings first request is cache miss"

settings_2="$(http_get "/api/settings")"
settings_2_hit="$(json_field "$settings_2" "cache.hit")"
assert_eq "$settings_2_hit" "true" "Settings second request is cache hit"

echo "[redis-smoke] Verifying invalidation endpoint..."
invalidate_json="$(http_post "/api/cache/invalidate?target=all" -H "x-cache-admin-key: ${CACHE_ADMIN_KEY}")"
invalidate_target="$(json_field "$invalidate_json" "target")"
assert_eq "$invalidate_target" "all" "Invalidation target accepted"

dash_after_invalidate="$(http_get "/api/dashboard")"
dash_after_invalidate_hit="$(json_field "$dash_after_invalidate" "cache.hit")"
assert_eq "$dash_after_invalidate_hit" "false" "Dashboard cache is miss after invalidation"

echo "[redis-smoke] SUCCESS: Redis/API caching smoke checks passed."
