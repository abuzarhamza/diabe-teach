# 01: Teacher lists a round's Concept Chains

**What to build:** A teacher running a Classroom Game can list every Concept Chain submitted in a Gameplay Round with `GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains`, using the session's instructor Capability Token. Each chain comes back in the same `SubmittedChain` shape that submit and adjudicate return (path, keywords, narrative, step rationales, status, peer votes, verdict), sorted by `submittedAt` and then `chainId`. A round with no chains, or one that hasn't started yet, returns 200 with an empty list.

The route shares its path with the existing `POST` that submits a chain. A forced `netlify.toml` redirect currently sends that path to the submit function, so narrow or remove it so that a `GET` and a `POST` each reach their own function.

Until ticket 03, a learner who calls the route with their participant Capability Token sees only their own chains, in every phase.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler test: the instructor sees every learner's chains for the round, in submission order, with status, peer votes and verdict
- [ ] Handler test: a participant sees only their own chains
- [ ] Handler test: a round with no chains, and Round 2 before it starts, return 200 with `chains: []`
- [ ] Handler test: an unknown session returns 404 `SESSION_NOT_FOUND`; round 0 or 3 returns 400
- [ ] Handler test: no token, an invalid token, an expired token, or an Account Token returns 401; another session's Capability Token returns 403 `FORBIDDEN_ROLE`
- [ ] Under `npm run dev:local`, a `GET` and a `POST` to the chains path each reach their own function, and submitting a chain still works
- [ ] Cucumber: in the classroom journey, after a learner submits a chain, the teacher lists the round's chains and sees it
- [ ] OpenAPI documents the `get` operation (`listRoundChains`), its auth and its 400/401/403/404 responses
- [ ] Typecheck, vitest, BDD (one feature at a time), lint (96) and boundaries (6) are no worse
