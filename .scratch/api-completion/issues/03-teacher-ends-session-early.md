# 03: Teacher ends the session early

**What to build:** `POST /api/v1/sessions/{sessionId}/end`, instructor only, moves the Game Session from any phase straight to `completed` with no deadline. It's a separate domain method, not a `jump`. Ending a completed session → 409 `SESSION_ALREADY_COMPLETED`. Learner screens see `completed` on their next poll.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler tests: ending from every phase gives `completed`; ending twice → 409; a participant token → 403
- [x] Handler test: after ending, chain submission is refused with the existing phase-closed error
- [x] OpenAPI documents the operation; the route declares its operationId (no body)
- [x] Cucumber: the teacher ends the session mid-round and the learner's state shows `completed`
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `POST /api/v1/sessions/{sessionId}/end` (operationId `endGameSession`, no body), instructor Capability Token only. New function `netlify/functions/end-session.ts` routes by `config.path` alone (no `netlify.toml` redirect); handler in `netlify/functions/sessions/end-session.ts`, use case `EndGameSessionUseCase` (retried on write conflicts like the other session writes).
- Domain: `GameSession.endSession(now)`, a separate method from `transitionTo`. It moves any phase straight to `completed`, sets `phaseStartedAt` to now and clears `extendedPhaseEndsAt`, so an extension never survives the end. A completed session (ended or advanced there) refuses with 409 `SESSION_ALREADY_COMPLETED` (reused from ticket 02).
- `phaseEndsAt` for `completed` follows the existing rule (equal to `phaseStartedAt`, the known catalog deviation), so there is no future deadline; making it `null` was left out of scope.
- OpenAPI documents the operation (200/401/403/404/409); `npm run generate:request-schemas` added it to `apiOperationIds`.
- Tests: `tests/functions/end-session.test.ts` (every phase → completed, extension dropped, ending twice → 409, participant → 403, no token → 401, chain submission after the end → 409 `PHASE_CLOSED_FOR_SUBMISSIONS`, learner state shows `completed`); Cucumber scenario `@end-session` in `classroom-session-journey.feature`.
- The prototype catalog had no end-session gap, so it is unchanged.
- Checks: typecheck clean, lint 49, boundaries 6, vitest 831 passed (`--no-file-parallelism`), BDD classroom-session-journey (23/23) and solo-session-journey (8/8).
