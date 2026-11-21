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

**Status:** done

- [x] A full vitest run prints no API log lines by default
- [x] All 5 BDD features pass, one per process, with no API log noise in the runner output
- [x] Local check (recorded in the Resolution): a readable line with the request id under `dev:local`; with `LOG_PRETTY=false`, a JSON line that `jq` parses
- [x] The docs and example config describe both variables and their defaults
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution

- **Vitest quiet default:** Added `tests/support/vitest-setup.ts` (`process.env.LOG_LEVEL ??= "silent"`) and wired it in `vitest.config.ts` via `setupFiles: ["tests/support/vitest-setup.ts"]`. Added a test in `tests/app-runtime-logging-config.test.ts` verifying `process.env.LOG_LEVEL` defaults to `"silent"` under vitest and `AppRuntime.loadEnvConfig().logLevel` resolves to `"silent"`. A full vitest run (`npx vitest run --no-file-parallelism`) prints `0` `diabe-teach-api` log lines.
- **BDD runner & local dev scripts:** `scripts/run-bdd-sequential.ts` sets `process.env.LOG_LEVEL ??= "silent"` for spawned cucumber processes and documents in its header comment how `LOG_LEVEL=silent` or `LOG_LEVEL=debug` can be passed to `npm run dev:local` (which runs in a separate process and writes to `.netlify/dev-local.log`) or `npm run test:bdd` when debugging a single run. `scripts/start-dev-with-mongodb.ts` also documents `LOG_PRETTY=false npm run dev:local` and `LOG_LEVEL=silent npm run dev:local`.
- **Deploy default:** Confirmed `netlify.toml` sets no `LOG_LEVEL`, so deployed functions keep the `info` default.
- **Local dev verification (recorded output):**
  - Under default `npm run dev:local` (`NETLIFY_DEV=true`, default `LOG_LEVEL=debug`, `LOG_PRETTY=true`), `pino-pretty` loads in-process inside the Netlify dev bundle and produces readable, coloured lines with `requestId` in `.netlify/dev-local.log`:
    ```
    [23:36:42.848] INFO: session phase changed
        service: "diabe-teach-api"
        requestId: "01M7Y9PQ3D6JEPBC7ZV7H7N229"
        route: "/api/v1/sessions/:sessionId/phase"
        method: "POST"
        sessionId: "30f3f047-f696-4309-baca-e5887f2a0256"
        from: "feedback-survey"
        to: "completed"
    [23:36:42.849] INFO: request completed
        service: "diabe-teach-api"
        requestId: "01M7Y9PQ3D6JEPBC7ZV7H7N229"
        route: "/api/v1/sessions/:sessionId/phase"
        method: "POST"
        status: 200
        durationMs: 36
    ```
  - Under `LOG_PRETTY=false npm run dev:local`, requests emit raw single-line JSON objects in `.netlify/dev-local.log` that `jq` parses and filters cleanly:
    ```json
    {"level":"debug","time":1795239524801,"service":"diabe-teach-api","requestId":"01M7Y9TE6KBC9X1Q1PX80QKMC6","route":"/api/v1/sessions/:sessionId/phase","method":"POST","sessionId":"5a7398bd-c0a0-4db8-a247-cbc23d504212","roundNumber":1,"seed":"bc785b53c104e4e9","rows":7,"cols":7,"msg":"board dealt"}
    {"level":"info","time":1795239524810,"service":"diabe-teach-api","requestId":"01M7Y9TE6KBC9X1Q1PX80QKMC6","route":"/api/v1/sessions/:sessionId/phase","method":"POST","sessionId":"5a7398bd-c0a0-4db8-a247-cbc23d504212","from":"trial-orientation","to":"round-1:chain-mapping","msg":"session phase changed"}
    {"level":"info","time":1795239524811,"service":"diabe-teach-api","requestId":"01M7Y9TE6KBC9X1Q1PX80QKMC6","route":"/api/v1/sessions/:sessionId/phase","method":"POST","status":200,"durationMs":35,"msg":"request completed"}
    {"level":"info","time":1795239553472,"service":"diabe-teach-api","requestId":"01M7Y9V9YTRGSSHW1HZZY8VGD2","route":"/api/v1/packs/:packId/archive","method":"POST","status":403,"durationMs":21,"errorCode":"PACK_IS_SYSTEM_PACK","msg":"request completed"}
    ```
- **Documentation & example config:**
  - `.env.dev.yaml.example` documents `logging.level` (`[LOG_LEVEL]`) and `logging.pretty` (`[LOG_PRETTY]`) with their defaults and `NETLIFY_DEV` guard (`tests/no-committed-secrets.test.ts` and `tests/app-runtime-yaml-integration.test.ts` pass).
  - `docs/agents/api-architecture.md` gains Section 8 ("Logging") covering `LoggerPort`, `PinoLogger`, `SilentLogger`, `requestLoggerOf(event)`, per-request child loggers and the `"request completed"` summary line, `LOG_LEVEL` and `LOG_PRETTY` defaults across environments, the never-log rule + 33-path `redact` safety net + `MongoCredentialStripper`, the Ticket 06 event catalogue (`info`, `debug`, `warn`), and `netlify logs --json | jq` examples (filtering by `requestId`, `errorCode`, `level`) with a link to `.scratch/research/netlify-logging-and-log-services.md`.
- **Verification:** `npm run typecheck` clean; `npx vitest run --no-file-parallelism` 53 files / 962 tests passed (0 API log lines printed); `npm run test:bdd` 5 features / 53 scenarios / 574 steps passed sequentially (0 API log lines in runner output); `npm run dev:local:stop` confirmed port 8888 free; `npm run lint` 29 errors (baseline ≤ 29); `npm run lint:boundaries` 6 violations (baseline ≤ 6).
