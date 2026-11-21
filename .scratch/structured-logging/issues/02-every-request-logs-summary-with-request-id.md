# 02: Every request logs one summary line with its request id

**What to build:**
- **Child logger:** `wrapLambdaHandler(handler, config)` makes one child logger per invocation with `{ requestId: context.requestId, route: config.path, method }`, and passes it on the event to the middy chain and handlers.
- **Summary line:** when the invocation ends, it writes one `"request completed"` line with `status` and `durationMs`, plus `errorCode` on a domain error.
  - 5xx logs at `error`; 4xx and 2xx at `info`.
- **Default:** with no logger given, `SilentLogger` is used, so every existing handler test passes unchanged.
- Each netlify dev `.html` retry is its own invocation, and is logged as one.

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** 01 (A logger port backed by pino)

**Status:** ready-for-agent

- [ ] Wrapper test: a 200 request writes one summary line with `requestId`, `route`, `method`, `status` and `durationMs`
- [ ] Handler test: a domain refusal (for example 403 `PACK_IS_SYSTEM_PACK`) logs `errorCode` at `info`
- [ ] Handler test: an unexpected error's summary line is at `error` with status 500
- [ ] Existing handler and wrapper tests pass without changes
- [ ] Under `npm run dev:local`, a request prints its summary line (recorded in the Resolution)
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse
