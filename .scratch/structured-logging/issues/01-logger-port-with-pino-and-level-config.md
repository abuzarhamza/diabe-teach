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

**Status:** ready-for-agent

- [ ] Confirm `pino-test` works under vitest; if not, use a plain `Writable` sink and say why in the Resolution
- [ ] Adapter tests (in-memory sink): level filtering at each level, `silent` writes nothing, base fields present, no `pid` or `hostname`, `child()` fields on every line
- [ ] Config tests: env beats YAML beats defaults; invalid level → `info` plus one warning; pretty is off unless `NETLIFY_DEV=true`, and when on the output isn't JSON
- [ ] Domain and application code import only the port (boundaries stay green)
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse
