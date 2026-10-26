# 03: Wire Verified Security Context into Endpoint Handlers and End-to-End Test Suite

**What to build:** Pass the verified `c.security.BearerAuth` capability directly from the OpenAPI routing context into `GetPackByIdHttpHandler` and query execution, update test fixtures and token tests, and verify end-to-end security compliance with zero I/O leaks.

**Blocked by:** 01, 02

**Status:** done

- [x] `GetPackByIdHttpHandler` consumes the verified capability from `c.security.BearerAuth` (with graceful fallback for direct non-OpenAPI handler invocations).
- [x] Role-aware projection properly applies: anonymous/participant requests redact `correctIndex` and `explanation`; valid instructor requests receive full answer keys.
- [x] All test cases in `tests/get-pack-by-id.test.ts` pass, testing valid/invalid API keys, missing/tampered JWTs, anonymous vs instructor access.
- [x] `npm test`, `npm run typecheck`, and `npm run lint:boundaries` pass with zero violations.
