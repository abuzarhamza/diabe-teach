# 03: No console.* left in the API

**What to build:**
- **500 errors:** `unexpectedErrorMiddleware` logs at `error` through the request's logger, with `{ err }` (pino's standard error serializer: class, message, stack). The HTTP body stays the generic `INTERNAL_ERROR`.
- **Parameter mismatch:** the wrapper's route-parameter mismatch `console.warn` becomes `logger.warn({ pathname }, …)`, carrying the request id.
- **Lint:** ESLint `no-console` is an error for `src/**` and `netlify/**`; `scripts/` is exempt.

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** 02 (Every request logs one summary line with its request id)

**Status:** ready-for-agent

- [ ] Handler test: an unexpected error logs `err` with class, message and stack at `error`, while the response body has no stack (as in the bad-request-body tests)
- [ ] Wrapper test: a parameter mismatch logs `warn` with the request id
- [ ] `grep` finds no `console.` in `src/` or `netlify/`; lint fails if one is added (shown in the Resolution)
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse
