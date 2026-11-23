# 02: Teacher extends a timed phase

**What to build:** `POST /api/v1/sessions/{sessionId}/phase/extend` with `{ seconds }` (integer 1–600), instructor Capability Token only. The new deadline is `max(phaseEndsAt, now) + seconds`, so a phase whose timer just ran out reopens, including chain submissions. An instructor-driven phase (no timer) → 409 `PHASE_HAS_NO_TIMER`; a completed session → 409 `SESSION_ALREADY_COMPLETED`. Returns the updated public state. The rule is a Game Session method. The new function routes by `config.path` only (no redirect).

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler tests (fake clock): extending a timed phase moves `phaseEndsAt`; extending after expiry reopens chain submissions
- [x] Handler tests: untimed phase → 409, completed → 409, seconds 0 or 601 → 400, participant token → 403
- [x] OpenAPI documents the operation; request schemas regenerated; the route declares its operationId
- [x] Cucumber: the teacher extends chain-mapping and a learner submits in the added time
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- Domain: `GameSession.extendPhase(seconds, now)` sets the deadline to `max(phaseEndsAt, now) + seconds` and stores it as `extendedPhaseEndsAt`, which `phaseEndsAt` returns until the next transition clears it. Refusals: `SessionAlreadyCompletedError` (409 `SESSION_ALREADY_COMPLETED`), `PhaseHasNoTimerError` (409 `PHASE_HAS_NO_TIMER`), `InvalidPhaseExtensionError` (400, a backstop behind the request schema). `MAX_PHASE_EXTENSION_SEC = 600`.
- Persistence: `extendedPhaseEndsAt` is stored in Mongo (default `null`; legacy documents load as `null`) and copied by the in-memory repository; contract test round-trips it.
- Application: `ExtendSessionPhaseUseCase` (instructor only, through `GameSessionUpdateRetrier`).
- Route: `netlify/functions/extend-phase.ts` (`config.path` `/api/v1/sessions/:sessionId/phase/extend`, `POST`, no netlify.toml redirect), handler in `netlify/functions/sessions/extend-phase.ts`, operationId `extendSessionPhase`.
- Contract: `extendSessionPhase` + `ExtendPhaseRequest` in `docs/api/openapi.yaml`; `SESSION_ALREADY_COMPLETED` and `PHASE_HAS_NO_TIMER` added to `ApiErrorCode`; request schemas regenerated; the route was added to `tests/functions/request-body-schema.test.ts`.
- Tests: `tests/functions/extend-phase.test.ts` (fake clock); two Cucumber scenarios in `classroom-session-journey.feature` (extend after the window closed, then submit; untimed phase → 409).
- Prototype catalog: the `extend` gap is gone; `extendSessionPhase` is an implemented operation and teacher.html's +1 min button points at target `D.extend`. The prototype still extends its local timer only (no network call wired).

