# 11: Oversized request bodies are refused with 413

**What to build:** `createApiHandler` refuses any request body over 256 KB with 413 `PAYLOAD_TOO_LARGE` in the standard error body, before the JSON parse. On token-protected routes an unauthenticated request still gets 401 first. Every route gets it automatically.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler tests: a body just under the limit is accepted; over the limit gives 413; over the limit with no token gives 401
- [ ] OpenAPI lists 413 on routes with a body
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
