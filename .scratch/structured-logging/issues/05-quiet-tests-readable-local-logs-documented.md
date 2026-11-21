# 05: Quiet tests and readable local logs, documented

**What to build:**
- **Tests:** vitest's setup sets `LOG_LEVEL=silent` unless it's already set. The BDD runner passes `LOG_LEVEL=silent` to the server it checks against, unless set, and documents how to turn it up for one run.
- **Local dev:** `npm run dev:local` shows readable, coloured lines by default, and raw JSON with `LOG_PRETTY=false`.
- **Deploy:** `netlify.toml` sets no `LOG_LEVEL`, so the deployed default stays `info`.
- **Docs:**
  - `.env.dev.yaml.example` gains `logging.level` and `logging.pretty`, with comments;
  - `docs/agents/api-architecture.md` gains a "Logging" section covering the port, the summary line, the env variables with their defaults, the never-log list, the event catalogue from ticket 06, and `netlify logs --json | jq` examples (filter by `requestId`, by `errorCode`, by `level`).

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** 02 (Every request logs one summary line), 03 (No console.* left in the API), 06 (Key events log at info, diagnostics at debug)

**Status:** ready-for-agent

- [ ] A full vitest run prints no API log lines by default
- [ ] All 5 BDD features pass, one per process, with no API log noise in the runner output
- [ ] Local check (recorded in the Resolution): a readable line with the request id under `dev:local`; with `LOG_PRETTY=false`, a JSON line that `jq` parses
- [ ] The docs and example config describe both variables and their defaults
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse
