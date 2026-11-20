# 01: Session state lists the learners

**What to build:** `GET /api/v1/sessions/{sessionId}` returns `participants`: `{ participantId, displayName, joinedAt, leftAt }` for everyone who joined (`leftAt` is null until ticket 04 can set it). Both the instructor and participants receive it; no email or account id. `participantCount` counts participants whose `leftAt` is null. The teacher's roster and the learner's classmate list can then come from the state the screens already poll.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler test: after two learners join, the instructor's and a participant's state both list both, with names and join times
- [x] Handler test: no email or account id appears in the state
- [x] OpenAPI `PublicSessionState` documents `participants`; the generated schemas are regenerated if affected
- [x] Cucumber: in the classroom journey, the teacher's state lists the learner who joined
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

`PublicSessionStateProjector` now adds `participants` (`SessionParticipantViewDto`: `participantId`, `displayName`, `joinedAt`, `leftAt`) to every session state, in join order, for the instructor and participants alike; it carries no email or account id. `leftAt` is always `null` until ticket 04 lets a learner leave, so `participantCount` still counts every participant (equivalent to counting those with `leftAt: null`). `openapi.yaml` documents `participants` (required) and a new `SessionParticipantView` schema; the generated request schemas were regenerated and did not change (response-only schema). Handler tests in `tests/functions/get-session.test.ts` cover both roles and the absence of email/account ids; the classroom journey has a new `@roster` scenario. The prototype catalog's `C.roster` / `C.classmates` notes and the get-session deviation now point at `state.participants`, and its sample states include `participants`.

Checks: typecheck passes; vitest 792 passing (`--no-file-parallelism`); lint 49; boundaries 6; BDD classroom-session-journey (20 scenarios) and solo-session-journey (8 scenarios) pass against `dev:local`.
