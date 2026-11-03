# 01: Install Middy Packages & Implement Core Middlewares

**What to build:** Install `@middy/core`, `@middy/http-router`, and `@middy/http-header-normalizer`. Implement standard authentication and error mapping middlewares that normalize headers, validate API keys, verify capability JWT tokens, and transform domain errors (`PackNotFoundError`, `UnauthorizedTokenError`) into standard JSON responses.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Install `@middy/core`, `@middy/http-router`, and `@middy/http-header-normalizer`
- [ ] Implement `authMiddleware` for `x-api-key` validation and Bearer JWT verification
- [ ] Implement `errorMappingMiddleware` mapping `DomainError` instances to `{ code, message }` JSON responses (401, 404, 500)
- [ ] Unit tests for middlewares in isolation
