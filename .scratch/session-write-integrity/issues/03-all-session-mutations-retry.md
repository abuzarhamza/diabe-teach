# 03: Every other session-changing request uses the same retry

**What to build:** The remaining session-mutating use cases go through the retry helper from ticket 02: join session, transition phase, adjudicate Concept Chain, submit Assessment Attempt, and submit perception survey. Each recovers from a single conflicting write by reloading and re-applying, and returns 409 `CONCURRENT_UPDATE_CONFLICT` only after 3 conflicting attempts. OpenAPI documents the 409 response on every session-mutating operation.

See spec: `.scratch/session-write-integrity/spec.md`.

**Blocked by:** 02 (chain submission retries on conflict)

**Status:** ready-for-agent

- [ ] Join, transition, adjudicate, assessment and survey all use the retry helper; no session-mutating use case calls the repository update directly
- [ ] Handler test per use case: one scripted conflict, then success with the correct final state (e.g. both concurrent joiners appear in the roster)
- [ ] OpenAPI documents 409 `CONCURRENT_UPDATE_CONFLICT` on all session-mutating operations
- [ ] Existing tests, BDD and lint baselines unchanged
