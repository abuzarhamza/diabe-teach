# Spec: OpenAPI Security Handlers & Standard RFC 7519 JSON Web Token Verification

**Status:** ready-for-agent

## Problem Statement

Currently, our central HTTP router (`OpenApiHttpApp`) delegates Bearer capability token parsing and verification to downstream endpoint handlers and application use cases rather than enforcing it at the OpenAPI transport boundary. Furthermore, the token format uses a custom 2-part string (`payload.signature`) rather than standard RFC 7519 JSON Web Tokens (JWT: `header.payload.signature`), and public routes with optional Bearer tokens do not fail closed when callers provide malformed or tampered tokens.

## Solution

1. Implement active `securityHandlers` directly in `OpenApiHttpApp` (`openapi-backend`):
   - `ApiKeyAuth`: Validates `x-api-key` header against configured application keys.
   - `BearerAuth`: Extracts `Authorization: Bearer <token>`, verifies the HMAC-SHA256 signature and claims via `CapabilityTokenPort`, and attaches the verified identity (`{ role, sessionId, participantId }`) to `c.security.BearerAuth`.
2. Upgrade `HmacCapabilityTokenAdapter` to generate and verify standard 3-part RFC 7519 JSON Web Tokens (JWT) using `node:crypto`.
3. Enforce fail-closed security for optional authentication: if an `Authorization` header is provided on an open route but contains an invalid/tampered token, reject the request with `401 UNAUTHORIZED_TOKEN` rather than silently degrading to anonymous access.
4. Provide contextual 401 error messages in `unauthorizedHandler` based on which security scheme failed (`x-api-key` vs. `Bearer token`).

## User Stories

1. As a platform administrator, I want global API key validation enforced by `ApiKeyAuth` before any operation handler executes, so that unauthenticated client applications are blocked at the router edge.
2. As a client application developer, I want clear `401 UNAUTHORIZED_TOKEN` error responses with `"Missing or invalid x-api-key header."` when my API key is missing or incorrect, so that I can immediately debug integration issues.
3. As an instructor, I want my session capability token formatted as a standard RFC 7519 JSON Web Token (JWT), so that I can inspect and debug token payloads using standard developer tooling.
4. As an instructor, I want my verified role (`instructor`) recognized automatically by `BearerAuth` in `OpenApiHttpApp`, so that I receive full curriculum pack details including assessment answer keys and explanations without repetitive manual auth checks.
5. As a participant, I want my verified role (`participant`) recognized by `BearerAuth` in `OpenApiHttpApp`, so that I can participate in games while answer keys remain securely redacted.
6. As a student learner accessing public curriculum packs anonymously, I want requests without an `Authorization` header to succeed with redacted answer keys, so that I can study curriculum content without needing a session token.
7. As a security engineer, I want requests that supply a corrupted, expired, or tampered `Authorization` header on public routes to be rejected with `401 UNAUTHORIZED_TOKEN`, so that malicious or misconfigured clients cannot bypass security controls.
8. As an API client receiving a 401 response, I want the response body to conform strictly to `#/components/schemas/ApiErrorResponse` (`{ code, message }`), so that my error handling logic remains uniform across all endpoints.
9. As a backend developer, I want `OpenApiHttpApp` to attach verified token claims to the request context, so that downstream handlers and use cases do not perform duplicate header parsing and cryptographic verification.
10. As a DevOps engineer, I want token signing and verification implemented using Node.js built-in `node:crypto` primitives, so that zero external third-party dependencies are required in the production serverless bundle.

## Implementation Decisions

1. **Centralized OpenAPI Security Handlers**:
   - Register `ApiKeyAuth` and `BearerAuth` inside `OpenAPIBackend` constructor in `OpenApiHttpApp`.
   - `ApiKeyAuth` reads `c.request.headers['x-api-key']` (or `request.headers.get('x-api-key')`).
   - `BearerAuth` reads `c.request.headers['authorization']`, extracts the bearer token, and calls `deps.tokenVerifier.verifyToken(token)`.
   - When verified, returns the `VerifiedCapability` object (`{ role, sessionId, participantId }`), which `openapi-backend` populates into `c.security.BearerAuth`.
2. **Fail-Closed Security on Optional Routes**:
   - When no `Authorization` header is present on routes where `security` permits anonymous access (`[ { ApiKeyAuth: [] }, { ApiKeyAuth: [], BearerAuth: [] } ]`), `BearerAuth` returns `null` or `false` without throwing, allowing `ApiKeyAuth` alone to authenticate the request.
   - When an `Authorization` header *is* present but cannot be parsed or verified, `BearerAuth` throws an explicit `DomainError` or `AuthenticationError` so that `openapi-backend` treats the security requirement as failed and invokes `unauthorizedHandler`.
3. **Contextual `unauthorizedHandler`**:
   - `unauthorizedHandler(c, request)` checks the failure cause:
     - If the error originated from `BearerAuth` (or an invalid token was supplied), responds with `401` and `message: "Malformed, invalid, or expired capability token."`.
     - Otherwise, responds with `401` and `message: "Missing or invalid x-api-key header."`.
4. **Standard 3-Part RFC 7519 JSON Web Token (JWT)**:
   - `HmacCapabilityTokenAdapter.signToken` produces:
     `base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + base64url(JSON.stringify(payload)) + "." + base64url(hmacSha256(headerAndPayload, secret))`
   - `HmacCapabilityTokenAdapter.verifyToken` verifies:
     - Splits token by `.` into exactly 3 segments: `headerB64`, `payloadB64`, `signatureB64`.
     - Validates HMAC-SHA256 signature using `timingSafeEqual`.
     - Parses header: verifies `alg === "HS256"`.
     - Parses payload: extracts `{ role, sessionId, participantId? }`.
5. **Downstream Handler Token Consumption**:
   - In `GetPackByIdHttpHandler`, extract verified capability directly from `c.security?.BearerAuth` (or fallback to query token if called outside `openapi-backend`), passing the verified role into the query execution.

## Testing Decisions

- **Single High-Level Seam**: All tests execute against `app.fetch(request)` on `OpenApiHttpApp` with in-memory test dependencies.
- **Test Scenarios**:
  1. Requests without `x-api-key` return 401 with `"Missing or invalid x-api-key header."`.
  2. Requests with valid `x-api-key` and no `Authorization` header return 200 with redacted answer keys.
  3. Requests with valid `x-api-key` and valid instructor 3-part JWT return 200 with complete answer keys.
  4. Requests with valid `x-api-key` and valid participant 3-part JWT return 200 with redacted answer keys.
  5. Requests with valid `x-api-key` but tampered/malformed JWT return 401 with `"Malformed, invalid, or expired capability token."`.
  6. Unit tests on `HmacCapabilityTokenAdapter` verifying RFC 7519 3-part JWT structure (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`) and constant-time signature verification.

## Out of Scope

- Asymmetric RSA/ECDSA public/private key pairs (HMAC-SHA256 symmetric secret is sufficient for internal capability verification).
- Third-party OAuth2 / OpenID Connect provider integration.
- Refresh token rotation (capability tokens are short-lived session-scoped credentials).

## Further Notes

- Governed by ADR-0004 (`docs/adr/0004-openapi-security-handlers-and-jwt-verification.md`).
- Follows official guidance from [OpenAPI Stack Security Documentation](https://openapistack.co/docs/openapi-backend/security/).
