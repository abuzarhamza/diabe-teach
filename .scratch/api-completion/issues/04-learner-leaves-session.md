# 04: Learner leaves the session

**What to build:** `POST /api/v1/sessions/{sessionId}/leave`, participant only, sets that participant's `leftAt`. Leaving again is a no-op 200. A participant who has left gets 403 `PARTICIPANT_HAS_LEFT` on submit-chain, peer votes, assessments and the survey. Read routes still work, and their chains, votes and standings are kept. `participantCount` drops by one, and the roster shows `leftAt`. `leftAt` is stored in Mongo; legacy participants load with null.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 01 (Session state lists the learners)

**Status:** ready-for-agent

- [ ] Handler tests: after leaving, every write route returns 403 `PARTICIPANT_HAS_LEFT`; reads still work; leaving twice → 200; an instructor token → 403
- [ ] Handler test: chains and standings of a learner who left are kept
- [ ] Game Session repository contract suite: `leftAt` round-trips; Mongo-only: a legacy participant loads with `leftAt = null`
- [ ] OpenAPI documents the operation and the new error code
- [ ] Cucumber: a learner leaves and their next chain submission is refused
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
