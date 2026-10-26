# 20 - Standard RFC 7519 JWT & OpenAPI Security Handlers

Dated architectural record (**2026-10-25**) documenting the migration to standard RFC 7519 3-part JSON Web Tokens (JWT) and centralized OpenAPI security handlers following [ADR-0004](../docs/adr/0004-openapi-security-handlers-and-jwt-verification.md).

---

## 1. Context & Motivation

As of commit `c0428c0`, the engine's capability tokens used an internal two-part base64url string (`payload.signature`) signed with HMAC-SHA256. While functional for internal verification, this format:
- Did not conform to the standard RFC 7519 structure (`header.payload.signature`).
- Lacked an explicit JOSE header defining `alg: "HS256"` and `typ: "JWT"`.
- Depended on downstream endpoint handlers and application use cases to parse and verify the `Authorization: Bearer <token>` header rather than validating it at the central router seam (`openapi-backend` security handlers).

Following the [OpenAPI Stack Security Architecture](https://openapistack.co/docs/openapi-backend/security/) and user alignment on 2026-10-25, the platform migrated to standard 3-part JWTs and centralized security handlers.

---

## 2. Standard 3-Part RFC 7519 JWT Architecture

As of commit `51fa157` (Ticket 01), [`HmacCapabilityTokenAdapter`](../src/adapters/outbound/hmac-capability-token-adapter.ts) produces and validates standard 3-part JWTs using Node.js built-in `node:crypto`:

```
┌───────────────────────────────┐
│          JOSE Header          │ -> base64url({"alg":"HS256","typ":"JWT"})
└───────────────┬───────────────┘
                │ "."
┌───────────────▼───────────────┐
│         Token Payload         │ -> base64url({"role":"instructor","sessionId":"..."})
└───────────────┬───────────────┘
                │ "."
┌───────────────▼───────────────┐
│     HMAC-SHA256 Signature     │ -> base64url(createHmac('sha256', secret).update(header + '.' + payload))
└───────────────────────────────┘
```

### Verification Safeguards
1. **Three-Part Segmentation**: Rejects tokens with `parts.length !== 3` (strictly rejecting legacy 2-part tokens).
2. **Algorithm Enforcement**: Decodes the header and rejects any token where `header.alg !== "HS256"` (preventing `alg: "none"` or algorithm-confusion attacks).
3. **Constant-Time Verification**: Compares cryptographic HMAC digest using `crypto.timingSafeEqual` to prevent timing attacks.
4. **Claim Integrity**: Validates domain requirements: `role` must be `"instructor"` or `"participant"`, and `sessionId` must be a non-empty string.

---

## 3. Centralized OpenAPI Security Pipeline (Ticket 02 & 03)

In accordance with [ADR-0004](../docs/adr/0004-openapi-security-handlers-and-jwt-verification.md), authentication is handled by `openapi-backend` `securityHandlers`:

1. **`ApiKeyAuth`**: Validates the `x-api-key` client header against runtime configuration.
2. **`BearerAuth`**: Extracts the bearer token from `c.request.headers['authorization']` and delegates verification to `tokenVerifier.verifyToken()`.
3. **Fail-Closed Verification on Optional Routes**:
   - For routes with `security: [ { ApiKeyAuth: [] }, { ApiKeyAuth: [], BearerAuth: [] } ]`:
     - Absence of `Authorization` header returns `false`, allowing valid anonymous access.
     - Presence of an invalid or tampered token throws an error, causing `unauthorizedHandler` to return `401 UNAUTHORIZED_TOKEN` with `"Malformed, invalid, or expired capability token."`.
