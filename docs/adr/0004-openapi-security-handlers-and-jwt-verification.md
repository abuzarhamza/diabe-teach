# ADR 0004: Centralized OpenAPI Security Handlers & Standard RFC 7519 JSON Web Tokens (JWT)

## Status
Accepted

## Context
Our API is centrally routed by `OpenApiHttpApp` via `openapi-backend` reading `docs/api/openapi.yaml`. Previously:
1. `ApiKeyAuth` was verified via a custom security handler in `OpenApiHttpApp`, but `BearerAuth` was a stub (`() => true`), leaving Bearer token extraction and verification to downstream endpoint handlers.
2. `HmacCapabilityTokenAdapter` used a custom 2-part JSON base64url string (`payload.signature`) rather than the industry-standard 3-part RFC 7519 JSON Web Token (`header.payload.signature`).
3. On routes with optional Bearer tokens (such as `GET /api/v1/packs/{packId}`, where anonymous access is allowed with `ApiKeyAuth` alone, but elevated instructor access is granted with `BearerAuth`), an invalid or tampered token could mistakenly fall back to anonymous access if security handlers did not fail closed.

## Decision
1. **Centralize Authentication in `OpenApiHttpApp.securityHandlers`**:
   - `ApiKeyAuth`: Validates `c.request.headers['x-api-key']` against configured client keys.
   - `BearerAuth`: Extracts `c.request.headers['authorization']` (`Bearer <token>`), verifies the signature and claims using `CapabilityTokenPort`, and attaches the verified identity (`{ role, sessionId, participantId }`) to `c.security.BearerAuth`.
2. **Fail-Closed Verification on Optional Routes**:
   - If no `Authorization` header is present on a route with optional `BearerAuth`, `securityHandlers.BearerAuth` returns `null` (allowing anonymous fallback via `ApiKeyAuth`).
   - If an `Authorization` header is present but malformed, invalid, or tampered, `securityHandlers.BearerAuth` throws an explicit authentication error, causing `unauthorizedHandler` to return `401 UNAUTHORIZED_TOKEN` with `"Malformed, invalid, or expired capability token."`.
3. **Standard RFC 7519 3-Part JWT**:
   - `HmacCapabilityTokenAdapter` generates and validates standard 3-part JWTs (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<payload>.<signature>`) using built-in `node:crypto` HMAC-SHA256, without adding external npm dependencies.
4. **Contextual 401 Responses**:
   - `unauthorizedHandler(c)` inspects failure context to return the exact message required by the contract:
     - `"Missing or invalid x-api-key header."` when `ApiKeyAuth` fails.
     - `"Malformed, invalid, or expired capability token."` when `BearerAuth` fails.

## Consequences
- **Positive**: Clean separation of concerns; zero duplicate header parsing in use cases; strict fail-closed security; industry-standard JWT format compatible with third-party tools and client libraries.
- **Trade-off**: Requires `c.security.BearerAuth` to be passed from the OpenAPI router context into endpoint handler invocation arguments.
