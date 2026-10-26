# 01: Standard RFC 7519 3-Part JWT in `HmacCapabilityTokenAdapter`

**What to build:** Upgrade `HmacCapabilityTokenAdapter` to generate and verify standard 3-part RFC 7519 JSON Web Tokens (`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.<payloadB64>.<signatureB64>`) using Node.js built-in `node:crypto`, verifying header `alg: "HS256"`, payload structure `{ role, sessionId, participantId? }`, and constant-time HMAC-SHA256 signature matching.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `HmacCapabilityTokenAdapter.signToken` produces standard 3-part JWT with base64url encoded header `{"alg":"HS256","typ":"JWT"}`, base64url encoded JSON payload, and base64url HMAC-SHA256 signature.
- [ ] `HmacCapabilityTokenAdapter.verifyToken` verifies 3-part format, validates header `alg === "HS256"`, checks signature via `timingSafeEqual`, and extracts `{ role, sessionId, participantId? }`.
- [ ] Returns `null` for malformed, non-3-part, invalid algorithm, or signature-tampered tokens.
- [ ] Unit tests in test suite verify standard 3-part JWT signing and rejection of tampered tokens.
