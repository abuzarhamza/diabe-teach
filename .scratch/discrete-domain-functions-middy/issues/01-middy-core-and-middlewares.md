# 01: Install Middy and Implement Reusable Middlewares

**What to build:** Install `@middy/core` and `@middy/http-header-normalizer`. Implement `authMiddleware` (validating `x-api-key` and Bearer JWTs into `event.auth`) and `domainErrorMiddleware` (mapping `DomainError` instances like `PackNotFoundError` and `UnauthorizedTokenError` to standard JSON responses).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Install `@middy/core` and `@middy/http-header-normalizer`
- [x] Implement `authMiddleware` with API key validation and Bearer JWT decoding
- [x] Implement `domainErrorMiddleware` for standard HTTP JSON error formatting (401, 404, 500)
- [x] Unit tests verifying middlewares in isolation
