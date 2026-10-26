# 02: Centralized `BearerAuth` & `ApiKeyAuth` Security Handlers in `OpenApiHttpApp`

**What to build:** Implement active `securityHandlers.BearerAuth` and `securityHandlers.ApiKeyAuth` in `OpenApiHttpApp` (`openapi-backend`), extracting `c.request.headers['authorization']`, verifying the token via `deps.tokenVerifier`, returning the verified capability into `c.security.BearerAuth`, and providing contextual 401 responses in `unauthorizedHandler` based on which security scheme failed.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `securityHandlers.ApiKeyAuth` validates `x-api-key` header against configured application key via `BaseHttpHandler.verifyApiKeyHeader`.
- [ ] `securityHandlers.BearerAuth` extracts Bearer token, verifies via `deps.tokenVerifier.verifyToken`, and attaches verified capability to `c.security.BearerAuth`.
- [ ] When no `Authorization` header is present on routes with optional `BearerAuth`, handler returns `false` (allowing anonymous fallback under `ApiKeyAuth`).
- [ ] When an invalid, malformed, or tampered `Authorization` header is provided, handler throws an explicit error so `openapi-backend` invokes `unauthorizedHandler`.
- [ ] `unauthorizedHandler` returns `401 UNAUTHORIZED_TOKEN` with `"Malformed, invalid, or expired capability token."` if BearerAuth failed, and `"Missing or invalid x-api-key header."` if ApiKeyAuth failed.
