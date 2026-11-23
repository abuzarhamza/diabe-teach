# 01: Session state lists the learners

**What to build:** `GET /api/v1/sessions/{sessionId}` returns `participants`: `{ participantId, displayName, joinedAt, leftAt }` for everyone who joined (`leftAt` is null until ticket 04 can set it). Both the instructor and participants receive it; no email or account id. `participantCount` counts participants whose `leftAt` is null. The teacher's roster and the learner's classmate list can then come from the state the screens already poll.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler test: after two learners join, the instructor's and a participant's state both list both, with names and join times
- [ ] Handler test: no email or account id appears in the state
- [ ] OpenAPI `PublicSessionState` documents `participants`; the generated schemas are regenerated if affected
- [ ] Cucumber: in the classroom journey, the teacher's state lists the learner who joined
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
