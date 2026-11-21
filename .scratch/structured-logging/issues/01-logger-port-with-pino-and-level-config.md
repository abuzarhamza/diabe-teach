# 01: A logger port backed by pino, with LOG_LEVEL and LOG_PRETTY

**What to build:**
- **Port:** an application-layer `LoggerPort` (`debug`, `info`, `warn`, `error` taking `(fields, msg)`, plus `child(fields)`).
- **`PinoLogger` outbound adapter:**
  - writes one JSON object per line to stdout through `pino.destination({ dest: 1, sync: true })`, with no transports;
  - level as a label; base `service: "diabe-teach-api"`; no `pid` or `hostname`.
- **`SilentLogger` no-op adapter:** the default when none is given.
- **`AppRuntime`:**
  - builds the logger once per function instance and provides it in `ProductionDependencies`;
  - reads `LOG_LEVEL` and `LOG_PRETTY` in `loadEnvConfig`, and from `.env.dev.yaml` (`logging.level`, `logging.pretty`) for local runs, with an environment variable winning as for other settings.
- **Defaults:**
  - `LOG_LEVEL`: `info`, or `debug` when `NETLIFY_DEV=true`; an invalid value falls back to `info` with one `warn` line naming it;
  - `LOG_PRETTY`: defaults to true under `NETLIFY_DEV=true` and is ignored otherwise.
- **Pretty mode:** uses `pino-pretty` in-process as a sync stream, loaded dynamically, falling back to JSON if it can't load.
- **Packages:** `pino` (dependency); `pino-pretty` and `pino-test` (devDependencies).

Nothing calls the logger yet, except the invalid-level warning.

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Confirm `pino-test` works under vitest; if not, use a plain `Writable` sink and say why in the Resolution
- [x] Adapter tests (in-memory sink): level filtering at each level, `silent` writes nothing, base fields present, no `pid` or `hostname`, `child()` fields on every line
- [x] Config tests: env beats YAML beats defaults; invalid level → `info` plus one warning; pretty is off unless `NETLIFY_DEV=true`, and when on the output isn't JSON
- [x] Domain and application code import only the port (boundaries stay green)
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- **Port:** `src/application/ports/logger.port.ts` (`LoggerPort`, `LogFields`, `LogLevel`).
- **Adapters:** `src/adapters/outbound/pino-logger.ts` (+ `.types.ts`): `pino.destination({ dest: 1, sync: true })`, no transports, `formatters.level` writes labels, `base: { service: "diabe-teach-api" }` (no `pid`/`hostname`). Pretty mode loads `pino-pretty` with `createRequire` inside a `try`, as `pretty({ sync: true, colorize })`, and falls back to JSON. `src/adapters/outbound/silent-logger.ts` is the no-op.
- **Config:** `AppRuntime.loadEnvConfig` resolves `logLevel` / `invalidLogLevel` / `logPretty` (env > `.env.dev.yaml` `logging.level` / `logging.pretty` > defaults; pretty only when `NETLIFY_DEV=true`). `AppRuntime.buildLogger` builds the logger and writes the single invalid-level `warn`; `buildProductionDependencies` provides `logger` (built once, cached with the other dependencies). Nothing else logs yet.
- **Packages:** `pino` 10.4.0 (dependency), `pino-pretty` 13.2.0 (devDependency). **`pino-test` was not kept.** It does run under vitest (`sink()` / `once()` passed with a default pino logger), but its `once`/`consecutive` assert that every line has `pid === process.pid` and `hostname === os.hostname()`, so they reject every line from our logger, which drops both fields by design. Tests use a plain `Writable` sink instead: `tests/support/in-memory-log-sink.ts` (raw string + parsed lines, which ticket 04's raw-output redaction test also needs).
- **Tests:** `tests/adapters/pino-logger.test.ts`, `tests/app-runtime-logging-config.test.ts` (27 tests).
- **Checks:** typecheck passes; vitest `--no-file-parallelism` 935 passed (baseline 908, no intermittent failures); lint 29 (baseline 29); boundaries 6 (baseline 6, none new); BDD `classroom-session-journey` 24/24 scenarios against `npm run dev:local`.
- **Not verified:** pretty output inside the netlify dev esbuild bundle (nothing logs there until ticket 02; if `createRequire` can't resolve `pino-pretty` it falls back to JSON) and the Netlify UI's level filter on label levels. Check both in ticket 02/05. `.env.dev.yaml.example` and the architecture doc are left to ticket 05.
