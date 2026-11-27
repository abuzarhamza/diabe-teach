#!/usr/bin/env bash
# Launch the diabe-teach web app for real-browser verification:
#   1. `npm run dev:prototype` (API on :8888, in-memory MongoDB, x-api-key check OFF)
#   2. Vite (`npm --prefix web run dev -- --strictPort`, the same as `npm run dev:web`
#      plus --strictPort) on :5173, proxying /api to :8888, with VITE_API_KEY unset.
#
# Usage (from anywhere in the repo):
#   .agents/skills/verify-diabe-teach-web/scripts/launch.sh [run-id]
#
# Refuses when :8888 or :5173 is already taken (never drive an instance this run did
# not start). Evidence dir: .verification/<run-id>/ (created by the API skill's
# `vapi init`, which also writes .verification/CURRENT). PIDs: dev-local.pid,
# web.pid (npm) and web-listener.pid (the Vite process that owns :5173).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
VAPI=(node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts)

for port in 8888 5173; do
  if lsof -ti "tcp:$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "REFUSE: port $port is already in use (pid $(lsof -ti "tcp:$port" -sTCP:LISTEN | tr '\n' ' '))."
    echo "Another server is running. Do not drive it; ask its owner, or run cleanup.sh if it is yours."
    exit 2
  fi
done

RUN_DIR="$("${VAPI[@]}" init "${1:-}")"
echo "RUN_DIR $RUN_DIR"

# 1. API, key check off (the browser must never hold the API key).
API_OUT="$RUN_DIR/dev-local.stdout.log"
nohup npm run dev:prototype >"$API_OUT" 2>&1 </dev/null &
API_PID=$!
echo "$API_PID" >"$RUN_DIR/dev-local.pid"
echo "dev:prototype pid $API_PID (stdout: $API_OUT)"
ready=""
for _ in $(seq 1 400); do
  if grep -q "DEV READY" "$API_OUT"; then ready=1; break; fi
  if grep -q "DEV NOT READY\|Failed to start" "$API_OUT" || ! kill -0 "$API_PID" 2>/dev/null; then break; fi
  sleep 0.5
done
if [[ -z "$ready" ]]; then
  echo "LAUNCH FAILED (API); last lines of $API_OUT:"
  tail -n 30 "$API_OUT"
  exit 1
fi
grep "DEV READY" "$API_OUT"

# 2. Vite. `env -u` guarantees no API key reaches the bundle even if the caller's shell has one.
WEB_OUT="$RUN_DIR/web.stdout.log"
nohup env -u VITE_API_KEY npm --prefix web run dev -- --strictPort >"$WEB_OUT" 2>&1 </dev/null &
WEB_PID=$!
echo "$WEB_PID" >"$RUN_DIR/web.pid"
echo "vite (npm) pid $WEB_PID (stdout: $WEB_OUT)"
for _ in $(seq 1 120); do
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "LAUNCH FAILED (web); last lines of $WEB_OUT:"
    tail -n 30 "$WEB_OUT"
    exit 1
  fi
  if [[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/login || true)" == "200" ]] \
    && [[ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/api/health || true)" == "200" ]]; then
    lsof -ti tcp:5173 -sTCP:LISTEN | head -n 1 >"$RUN_DIR/web-listener.pid"
    echo "WEB READY http://localhost:5173/login (proxy to :8888 answers /api/health)"
    exit 0
  fi
  sleep 0.5
done
echo "LAUNCH TIMED OUT (web) after 60 s; last lines of $WEB_OUT:"
tail -n 30 "$WEB_OUT"
exit 1
