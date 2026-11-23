# 11: Oversized request bodies are refused with 413

**What to build:** `createApiHandler` refuses any request body over 256 KB with 413 `PAYLOAD_TOO_LARGE` in the standard error body, before the JSON parse. On token-protected routes an unauthenticated request still gets 401 first. Every route gets it automatically.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler tests: a body just under the limit is accepted; over the limit gives 413; over the limit with no token gives 401
- [x] OpenAPI lists 413 on routes with a body
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- New `requestSizeLimitMiddleware` (`src/adapters/inbound/http/middy/request-size-limit.middleware.ts`) sits in `createApiHandler` after auth and before the JSON parse. It measures the raw body in bytes (`Buffer.byteLength`, base64-aware) and throws `PayloadTooLargeError` (`PAYLOAD_TOO_LARGE`, `details.maxBytes`) over `MAX_REQUEST_BODY_BYTES` (256 KB); `domainErrorMiddleware` maps it to 413. No middy package covers a body size limit, so it is a few lines on Node's `Buffer`.
- Tests in `tests/functions/bad-request-body.test.ts`: at and just under the limit is accepted, one byte over is 413 on every body route, multi-byte text is counted in bytes, and without a token the token routes still give 401.
- `docs/api/openapi.yaml`: `PayloadTooLargeError` response, 413 on all 12 operations with a request body, `PAYLOAD_TOO_LARGE` in `ApiErrorCode`. `npm run generate:request-schemas` re-run (no change). `docs/agents/api-architecture.md` lists the new step.
- Checks: typecheck passes; vitest (`--no-file-parallelism`) 896 passed; lint 29; boundaries 6; BDD classroom-session-journey (24/24) and teacher-account-journey (10/10) on dev:local.
