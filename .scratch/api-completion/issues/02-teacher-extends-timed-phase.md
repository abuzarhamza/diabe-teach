# 02: Teacher extends a timed phase

**What to build:** `POST /api/v1/sessions/{sessionId}/phase/extend` with `{ seconds }` (integer 1–600), instructor Capability Token only. The new deadline is `max(phaseEndsAt, now) + seconds`, so a phase whose timer just ran out reopens, including chain submissions. An instructor-driven phase (no timer) → 409 `PHASE_HAS_NO_TIMER`; a completed session → 409 `SESSION_ALREADY_COMPLETED`. Returns the updated public state. The rule is a Game Session method. The new function routes by `config.path` only (no redirect).

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler tests (fake clock): extending a timed phase moves `phaseEndsAt`; extending after expiry reopens chain submissions
- [ ] Handler tests: untimed phase → 409, completed → 409, seconds 0 or 601 → 400, participant token → 403
- [ ] OpenAPI documents the operation; request schemas regenerated; the route declares its operationId
- [ ] Cucumber: the teacher extends chain-mapping and a learner submits in the added time
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
