# 02: Every request logs one summary line with its request id

**What to build:**
- **Child logger:** `wrapLambdaHandler(handler, config)` makes one child logger per invocation with `{ requestId: context.requestId, route: config.path, method }`, and passes it on the event to the middy chain and handlers.
- **Summary line:** when the invocation ends, it writes one `"request completed"` line with `status` and `durationMs`, plus `errorCode` on a domain error.
  - 5xx logs at `error`; 4xx and 2xx at `info`.
- **Default:** with no logger given, `SilentLogger` is used, so every existing handler test passes unchanged.
- Each netlify dev `.html` retry is its own invocation, and is logged as one.

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** 01 (A logger port backed by pino)

**Status:** resolved

- [x] Wrapper test: a 200 request writes one summary line with `requestId`, `route`, `method`, `status` and `durationMs`
- [x] Handler test: a domain refusal (for example 403 `PACK_IS_SYSTEM_PACK`) logs `errorCode` at `info`
- [x] Handler test: an unexpected error's summary line is at `error` with status 500
- [x] Existing handler and wrapper tests pass without changes
- [x] Under `npm run dev:local`, a request prints its summary line (recorded in the Resolution)
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- **Wrapper** (`src/adapters/inbound/http/lambda-to-v2-wrapper.ts`): per invocation, `options.logger` (default `SilentLogger`) gets a child with `{ requestId: context.requestId, route: config.path, method: request.method }`. The handler receives it as `event.logger`, plus a mutable `event.requestOutcome` holder (types `RequestLogFields` / `RequestOutcome` in `lambda-to-v2-wrapper.types.ts`). After the handler returns, one `"request completed"` line is written with `status`, `durationMs` (rounded `performance.now()` delta) and `errorCode` when set. A status of 500 or above logs at `error`, anything else at `info`. If the handler throws (the middy chain normally stops that), the line is written at `error` with status 500 and the error is rethrown.
- **How `errorCode` reaches the line:** `domainErrorMiddleware` writes `error.code` into `request.event.requestOutcome.errorCode`. I chose a holder object on the event over a response header that gets stripped later: nothing that only matters for logging goes near the HTTP response, so nothing can leak to the client if a strip step is skipped. Because it is a shared object reference, it still works when a middleware copies the event. Events built without the wrapper (handler tests) have no holder, so the middleware skips the write.
- **Production logger:** `AppRuntime.invocationOptions.logger` is a getter that returns `getProductionDependencies().logger`, so it is resolved at invocation time, not when the module loads.
- **`SilentLogger` moved** from `src/adapters/outbound/` to `src/application/services/silent-logger.ts`. The inbound wrapper can't import outbound adapters (boundary rule `no-inbound-to-outbound-adapter-imports`), and ticket 06's use cases will need the same default. The pino-logger test import was updated to match.
- **Tests:** `tests/functions/request-summary-log.test.ts` covers five cases: a 200 summary line with all fields, the child logger reaching the handler, `.html` retries logged as separate invocations, the archive route's 403 `PACK_IS_SYSTEM_PACK` logging `errorCode` at `info`, and an unexpected error logging at `error` with status 500 and the generic body. Existing wrapper and handler tests are unchanged.
- **Under `npm run dev:local`:** `POST /api/v1/packs/diabe-teach/archive` without a token printed this in `.netlify/dev-local.log` (pretty):
  ```
  INFO: request completed
      service: "diabe-teach-api"
      requestId: "01M7Y2KMQKYKSZEDNWNZEE0P5Z"
      route: "/api/v1/packs/:packId/archive"
      method: "POST"
      status: 401
      durationMs: 1
      errorCode: "UNAUTHORIZED_TOKEN"
  ```
- **Checks** (run one after another): typecheck passes. Vitest `--no-file-parallelism`: 940 passed (baseline 935 plus 5 new), with no intermittent failures. Lint: 29 (baseline). Boundaries: 6 (baseline). BDD, one feature per process: assessment 6/6, classroom 24/24, solo 8/8, survey 5/5, teacher-account 10/10.
- **Not fixed:** the wrapper's `lambdaResultToResponse` throws when it gets `statusCode: 204` with a body of `""`, because `Response` rejects a null-body status that has a body. This is not new, and no route returns 204 today.
