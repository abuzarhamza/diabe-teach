# 01: Teacher lists a round's Concept Chains

**What to build:** A teacher running a Classroom Game can list every Concept Chain submitted in a Gameplay Round with `GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains`, using the session's instructor Capability Token. Each chain comes back in the same `SubmittedChain` shape that submit and adjudicate return (path, keywords, narrative, step rationales, status, peer votes, verdict), sorted by `submittedAt` and then `chainId`. A round with no chains, or one that hasn't started yet, returns 200 with an empty list.

The route shares its path with the existing `POST` that submits a chain. A forced `netlify.toml` redirect currently sends that path to the submit function, so narrow or remove it so that a `GET` and a `POST` each reach their own function.

Until ticket 03, a learner who calls the route with their participant Capability Token sees only their own chains, in every phase.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler test: the instructor sees every learner's chains for the round, in submission order, with status, peer votes and verdict
- [x] Handler test: a participant sees only their own chains
- [x] Handler test: a round with no chains, and Round 2 before it starts, return 200 with `chains: []`
- [x] Handler test: an unknown session returns 404 `SESSION_NOT_FOUND`; round 0 or 3 returns 400
- [x] Handler test: no token, an invalid token, an expired token, or an Account Token returns 401; another session's Capability Token returns 403 `FORBIDDEN_ROLE`
- [x] Under `npm run dev:local`, a `GET` and a `POST` to the chains path each reach their own function, and submitting a chain still works
- [x] Cucumber: in the classroom journey, after a learner submits a chain, the teacher lists the round's chains and sees it
- [x] OpenAPI documents the `get` operation (`listRoundChains`), its auth and its 400/401/403/404 responses
- [x] Typecheck, vitest, BDD (one feature at a time), lint (96) and boundaries (6) are no worse

## Resolution (2026-11-19)

- `GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains` (`netlify/functions/list-round-chains.ts`, `sessions/list-round-chains.ts`) runs `ListRoundChainsUseCase` through `createApiHandler` (BearerAuth, token required). The visibility rule lives in `GameSession.getChainsForRoundVisibleTo`: the instructor sees every chain, a participant only their own (ticket 03 widens this from peer-adjudication on). Chains come sorted by `submittedAt`, then `chainId`. A `roundNumber` other than `1`/`2` gets 400 `INVALID_REQUEST_BODY`.
- `netlify.toml`: the forced redirect for the chains path is removed (not narrowed), so the `POST` (submit-chain) and the `GET` each route by their own `config.path` + `method`. Checked under `npm run dev:local`: GET and POST reach their own functions with path params intact, and submitting still returns 201.
- Handler tests: `tests/functions/list-round-chains.test.ts` (15). BDD: "Teacher lists the round's chains after a learner submits one" in `classroom-session-journey.feature`. OpenAPI documents `listRoundChains`.
- Found, not fixed: under `netlify dev`, a function response of 403 or 404 makes the dev server retry the same path with `.html` appended; the retry loses the route params, so the client sees 401 "Missing path parameters." instead of 403/404. This hits get-standings too and is likely the cause of teacher-login ticket 08. Handler tests cover the real 403/404.
- The listed `stepRationales` are the stored strings; `SubmittedChain.stepRationales` in OpenAPI still describes `StepRationale` objects (existing drift, not changed here).
