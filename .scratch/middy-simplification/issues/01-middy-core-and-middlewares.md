# 01: Install Middy Packages & Implement Core Middlewares

**What to build:** Install `@middy/core`, `@middy/http-router`, and `@middy/http-header-normalizer`. Implement standard authentication and error mapping middlewares that normalize headers, validate API keys, verify capability JWT tokens, and transform domain errors (`PackNotFoundError`, `UnauthorizedTokenError`) into standard JSON responses.

**Blocked by:** None (can start immediately)

**Status:** wontfix (superseded by discrete-domain-functions-middy 01-03, 2026-11-20)

Closed 2026-11-20: superseded by `3c5f131` (one Netlify function per route with the shared middy chain `createApiHandler`; no central `@middy/http-router` or `netlify/functions/api.ts`, and `openapi-backend` is gone).

- [ ] Install `@middy/core`, `@middy/http-router`, and `@middy/http-header-normalizer`
- [ ] Implement `authMiddleware` for `x-api-key` validation and Bearer JWT verification
- [ ] Implement `errorMappingMiddleware` mapping `DomainError` instances to `{ code, message }` JSON responses (401, 404, 500)
- [ ] Unit tests for middlewares in isolation
