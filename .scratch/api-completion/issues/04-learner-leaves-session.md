# 04: Learner leaves the session

**What to build:** `POST /api/v1/sessions/{sessionId}/leave`, participant only, sets that participant's `leftAt`. Leaving again is a no-op 200. A participant who has left gets 403 `PARTICIPANT_HAS_LEFT` on submit-chain, peer votes, assessments and the survey. Read routes still work, and their chains, votes and standings are kept. `participantCount` drops by one, and the roster shows `leftAt`. `leftAt` is stored in Mongo; legacy participants load with null.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 01 (Session state lists the learners)

**Status:** resolved

- [x] Handler tests: after leaving, every write route returns 403 `PARTICIPANT_HAS_LEFT`; reads still work; leaving twice → 200; an instructor token → 403
- [x] Handler test: chains and standings of a learner who left are kept
- [x] Game Session repository contract suite: `leftAt` round-trips; Mongo-only: a legacy participant loads with `leftAt = null`
- [x] OpenAPI documents the operation and the new error code
- [x] Cucumber: a learner leaves and their next chain submission is refused
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `POST /api/v1/sessions/{sessionId}/leave` (`leaveGameSession`, participant only, no body) returns `{ state }`. `GameSession.leave` sets `leftAt`; leaving again is a no-op that keeps the first time. An instructor token gets 403 `FORBIDDEN_ROLE`. The new function routes by `config.path` only (no netlify.toml redirect).
- The rule lives in one domain method, `GameSession.assertParticipantHasNotLeft`, which throws `ParticipantHasLeftError` (403 `PARTICIPANT_HAS_LEFT`). `addChain`, `submitAssessment` and `submitSurvey` call it, and the adjudicate use case calls it before a peer vote. The assessment and survey use cases also call it before their phase check, so a learner who left gets 403 rather than a 409.
- `participantCount` counts only learners whose `leftAt` is null. The roster shows `leftAt`. Chains, votes and standings are kept, and classmates can still vote on the chains of a learner who left.
- `leftAt` is stored in Mongo (schema default null; a legacy participant without the field loads as null). The in-memory repository copies each participant object, `leftAt` included.
- OpenAPI: a new operation, a `PARTICIPANT_HAS_LEFT` code, and a shared `ParticipantWriteForbiddenError` 403 response on submit-chain, adjudicate, assessments and the survey. Submit-chain, assessments and the survey had no documented 403 before.
- Tests: `tests/functions/leave-session.test.ts` (8), two new contract-suite cases (run against both repositories), and a Cucumber scenario `@leave-session` in the classroom feature.
- Checks: typecheck clean; vitest 845/845 (`--no-file-parallelism`, no flakes); lint 49; boundaries 6; BDD classroom 24/24, solo 8/8, assessment 6/6, survey 5/5, teacher-account 10/10. On the first survey run, `dev:local` hung on `POST /api/v1/sessions` (create-session timed out, then a 500 after about 9 minutes). The run passed after a server restart (see the environment backlog).
