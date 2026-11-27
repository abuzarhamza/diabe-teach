# 03: No console.* left in the API

**What to build:**
- **500 errors:** `unexpectedErrorMiddleware` logs at `error` through the request's logger, with `{ err }` (pino's standard error serializer: class, message, stack). The HTTP body stays the generic `INTERNAL_ERROR`.
- **Parameter mismatch:** the wrapper's route-parameter mismatch `console.warn` becomes `logger.warn({ pathname }, …)`, carrying the request id.
- **Lint:** ESLint `no-console` is an error for `src/**` and `netlify/**`; `scripts/` is exempt.

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** 02 (Every request logs one summary line with its request id)

**Status:** resolved

- [x] Handler test: an unexpected error logs `err` with class, message and stack at `error`, while the response body has no stack (as in the bad-request-body tests)
- [x] Wrapper test: a parameter mismatch logs `warn` with the request id
- [x] `grep` finds no `console.` in `src/` or `netlify/`; lint fails if one is added (shown in the Resolution)
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `unexpectedErrorMiddleware(logger = new SilentLogger())` now takes a `LoggerPort` instead of a `log` function. It logs `error` with `{ err }`, `"unhandled error in API handler"`, through the request's `event.logger` (which carries `requestId`, `route` and `method`), else through the injected logger. The body is still the generic `INTERNAL_ERROR`.
- `resolvePathParameters(pathname, config, contextParams, logger = new SilentLogger())`: the wrapper passes its per-invocation child logger, and a mismatch logs `logger.warn({ pathname }, "route parameters from URL and context.params disagree; using the URL")`.
- `eslint.config.js`: `no-console: ["error", {}]` for `src/**` and `netlify/**`. The options object has to be given explicitly. A bare `"error"` keeps antfu's `allow: ["warn", "error"]`, so `console.warn` and `console.error` would still pass. `scripts/` is exempt through antfu's own `**/scripts/**` override.
- Tests:
  - `tests/functions/bad-request-body.test.ts` checks that a `TypeError` logs `err.type`, `err.message` and `err.stack` at `error`, and that the body has no stack (`expectNoLeak`);
  - `tests/functions/request-summary-log.test.ts` checks that the 500 line carries `requestId`;
  - `tests/adapters/lambda-to-v2-wrapper.test.ts` checks that a mismatch logs `warn` with `requestId: "req-1"` and `pathname`, and that a plain request logs nothing.
  The `console.error` spies are gone.

**Lint proof:** `grep -rn "console\." src netlify` finds nothing. A probe file with `console.warn` plus `console.error` gives 2 `no-console` errors in `src/` and 2 in `netlify/functions/`. The same file in `scripts/` is clean. The probes were deleted.

**Checks**, run one at a time:

| Check | Result | Baseline |
|---|---|---|
| typecheck | passes | |
| lint | 29 | 29 |
| boundaries | 6 | 6 |
| vitest (`--no-file-parallelism`) | 942 passed, 51 files, no intermittent failures | 940 |
| BDD `classroom-session-journey` | 24/24 scenarios | |
| BDD `teacher-account-journey` | passed | |

Both BDD features ran against `npm run dev:local`, one per process.
