# 09: The OpenAPI contract matches the code

**What to build:** `docs/api/openapi.yaml` stops disagreeing with the running API:
- `validateCurriculumPack` documents `{ valid, errors, warnings }` with `{ path, code, message }` items, and its 400 for a pack with a missing or wrongly typed field;
- `getGameSessionState` and `getRoundStandings` declare `BearerAuth` with 401/403;
- `streamGameSessionEvents` is marked not implemented (`x-implemented: false`, with a description pointing to polling);
- `jump` is documented as next-phase only, with ending early going through the end route.

Regenerate the request schemas, and update the matching prototype catalog deviations.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Each point above is reflected in `openapi.yaml`
- [x] Request-schema staleness test and catalog drift and sample tests pass
- [x] The prototype catalog's deviations for these points are removed or reworded
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

Contract-only change; no runtime code changed. Each claim was checked against the code first, and all four held.

- `validateCurriculumPack`: 200 is now `{ valid, errors, warnings }`; `PackValidationIssue` items are `{ path, code, message }` (as `PackValidator` returns). The 400 gets its own description: the body is checked against `CurriculumPackInput` first, so a missing or wrongly typed field is 400 `INVALID_REQUEST_BODY`, not `{ valid: false }`.
- `getGameSessionState` and `getRoundStandings`: `security: BearerAuth`, 401 and 403 `FORBIDDEN_ROLE` (another session's token); either Capability Token works.
- `streamGameSessionEvents`: `x-implemented: false`, with a description pointing to polling `getGameSessionState`.
- `transitionSessionPhase` / `TransitionPhaseRequest`: `jump` must name the next phase (else 409 `INVALID_PHASE_TRANSITION`); ending early is `endGameSession`.
- Ticket 03's deviation (`phaseEndsAt` equals `phaseStartedAt` on `completed`, and on both round summaries): settled by changing the contract, not the code. `PublicSessionState.phaseEndsAt` now documents it. That was the smaller change: making it `null` would also change round-summary extend behaviour (it would start returning 409 `PHASE_HAS_NO_TIMER`) and need BDD reruns.
- Request schemas regenerated (descriptions only). Prototype catalog: the matching deviations are removed and moved to notes; the 401/403 errors and participant auth are added; `validateCurriculumPack` is now `implemented` with a real-shaped sample.
- Not done (out of scope): `ConceptChain (API overlay).html` line 935 still shows the old `{ valid, issues }` shape; the catalog's `activeBoard` deviation is left for the Leftovers work; `jump` without `targetPhase` returns 200 with the state unchanged.
- Checks: typecheck clean, lint 29, boundaries 6, vitest 877/877 (`--no-file-parallelism`), catalog drift and sample tests and the staleness test green. BDD was not run because no runtime code changed.
