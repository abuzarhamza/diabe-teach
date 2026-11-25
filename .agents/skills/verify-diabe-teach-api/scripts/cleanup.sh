#!/usr/bin/env bash
# Tear down what launch.sh started, keep the evidence.
#
# Usage:
#   .agents/skills/verify-diabe-teach-api/scripts/cleanup.sh
#
# 1. Copies .netlify/dev-local.log (server-side log) into the run dir as evidence.
# 2. SIGTERMs the dev:local PID recorded by launch.sh, then runs the repo's
#    `npm run dev:local:stop` to sweep its process tree and confirm port 8888 is free.
# 3. Deletes scratch state (<run-dir>/vars.json holds live tokens).
# 4. Lists the evidence that survived. Evidence in .verification/ is never deleted.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
RUN_ID="$(cat .verification/CURRENT 2>/dev/null || true)"
RUN_DIR=".verification/${RUN_ID}"

if [[ -n "$RUN_ID" && -d "$RUN_DIR" ]]; then
  [[ -f .netlify/dev-local.log ]] && cp .netlify/dev-local.log "$RUN_DIR/dev-local.log"
  if [[ -f "$RUN_DIR/dev-local.pid" ]]; then
    PID="$(cat "$RUN_DIR/dev-local.pid")"
    if kill -0 "$PID" 2>/dev/null; then
      kill -TERM "$PID" 2>/dev/null || true
      for _ in $(seq 1 20); do kill -0 "$PID" 2>/dev/null || break; sleep 0.5; done
    fi
  fi
fi

npm run --silent dev:local:stop
STOP=$?

if lsof -ti tcp:8888 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "CLEANUP FAILED: port 8888 still in use by $(lsof -ti tcp:8888 -sTCP:LISTEN | tr '\n' ' ')"
  exit 1
fi
echo "PORT 8888 FREE"

if [[ -n "$RUN_ID" && -d "$RUN_DIR" ]]; then
  rm -f "$RUN_DIR/vars.json"
  echo "EVIDENCE KEPT in $RUN_DIR:"
  find "$RUN_DIR" -type f | sort
fi
exit "$STOP"
