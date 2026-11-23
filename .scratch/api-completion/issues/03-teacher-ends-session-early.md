# 03: Teacher ends the session early

**What to build:** `POST /api/v1/sessions/{sessionId}/end`, instructor only, moves the Game Session from any phase straight to `completed` with no deadline. It's a separate domain method, not a `jump`. Ending a completed session → 409 `SESSION_ALREADY_COMPLETED`. Learner screens see `completed` on their next poll.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler tests: ending from every phase gives `completed`; ending twice → 409; a participant token → 403
- [ ] Handler test: after ending, chain submission is refused with the existing phase-closed error
- [ ] OpenAPI documents the operation; the route declares its operationId (no body)
- [ ] Cucumber: the teacher ends the session mid-round and the learner's state shows `completed`
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
