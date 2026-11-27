#!/usr/bin/env bash
# Tear down what launch.sh started, keep the evidence.
#
# Usage:
#   .agents/skills/verify-diabe-teach-web/scripts/cleanup.sh
#
# 1. Stops Vite: SIGTERM to the npm PID and the :5173 listener PID that launch.sh
#    recorded (only those PIDs; never by process name). Confirms :5173 is free.
# 2. Stops the API with the API skill's cleanup.sh (recorded dev:prototype PID, then
#    `npm run dev:local:stop`), which also copies the server log into the run dir and
#    deletes <run-dir>/vars.json (live tokens).
# 3. Lists the evidence that survived. Nothing under .verification/ is deleted.
# Close the browser tabs you opened yourself (tabs_close_mcp); this script cannot.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
RUN_ID="$(cat .verification/CURRENT 2>/dev/null || true)"
RUN_DIR=".verification/${RUN_ID}"

if [[ -n "$RUN_ID" && -d "$RUN_DIR" ]]; then
  for file in web.pid web-listener.pid; do
    [[ -f "$RUN_DIR/$file" ]] || continue
    PID="$(cat "$RUN_DIR/$file")"
    [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null && kill -TERM "$PID" 2>/dev/null
  done
  for _ in $(seq 1 20); do
    lsof -ti tcp:5173 -sTCP:LISTEN >/dev/null 2>&1 || break
    sleep 0.5
  done
fi

WEB_OK=0
if lsof -ti tcp:5173 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "CLEANUP FAILED: port 5173 still in use by $(lsof -ti tcp:5173 -sTCP:LISTEN | tr '\n' ' ') (not started by this run, or did not stop)"
  WEB_OK=1
else
  echo "PORT 5173 FREE"
fi

.agents/skills/verify-diabe-teach-api/scripts/cleanup.sh
API_OK=$?
exit $(( WEB_OK || API_OK ))
