#!/usr/bin/env bash
# Launch the diabe-teach API for verification: `npm run dev:local`
# (in-memory MongoDB seeded with the diabe-teach System Pack, then netlify dev on :8888).
#
# Usage (from anywhere in the repo):
#   .agents/skills/verify-diabe-teach-api/scripts/launch.sh [run-id]
#
# Refuses to start when port 8888 is already in use (only one instance can exist,
# and an instance this run did not start must not be driven). Creates the evidence
# dir .verification/<run-id>/, starts dev:local in the background, records its PID in
# <run-dir>/dev-local.pid, and waits up to 200 s for the `DEV READY` line.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
VAPI=(node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts)

if lsof -ti tcp:8888 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "REFUSE: port 8888 is already in use (pid $(lsof -ti tcp:8888 -sTCP:LISTEN | tr '\n' ' '))."
  echo "Another dev server is running. Do not drive it; ask its owner, or run cleanup.sh if it is yours."
  exit 2
fi

RUN_DIR="$("${VAPI[@]}" init "${1:-}")"
OUT="$RUN_DIR/dev-local.stdout.log"
nohup npm run dev:local >"$OUT" 2>&1 </dev/null &
PID=$!
echo "$PID" >"$RUN_DIR/dev-local.pid"
echo "RUN_DIR $RUN_DIR"
echo "dev:local pid $PID (stdout: $OUT)"

for _ in $(seq 1 400); do
  if grep -q "DEV READY" "$OUT"; then
    grep "DEV READY" "$OUT"
    exit 0
  fi
  if grep -q "DEV NOT READY\|Failed to start" "$OUT" || ! kill -0 "$PID" 2>/dev/null; then
    echo "LAUNCH FAILED; last lines of $OUT:"
    tail -n 30 "$OUT"
    exit 1
  fi
  sleep 0.5
done
echo "LAUNCH TIMED OUT after 200 s; last lines of $OUT:"
tail -n 30 "$OUT"
exit 1
