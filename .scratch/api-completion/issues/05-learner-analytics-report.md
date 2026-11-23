# 05: A learner gets their own analytics report

**What to build:** `GET /api/v1/sessions/{sessionId}/analytics` with a participant token returns `{ role: "participant", participantReport, cohortSummary }` as in the contract. This ticket fills `participantReport`:
- pretest and posttest results;
- `knowledgeGainDelta` (posttest % − pretest %);
- `guessingReductionDelta` (pretest wrong-guess % − posttest wrong-guess %);
- `chainDiversityIndex` (distinct Semantic Domains crossed by approved chains ÷ the pack's Semantic Domain count);
- `neglectedKeywordIds` (cards on the learner's dealt boards that none of their chains used).

Missing inputs give null rather than errors. `cohortSummary` may return only `sessionId` and `participantCount` until ticket 06; mark the other fields optional in OpenAPI meanwhile if needed. Pack data comes through `SessionPackLoader` (the pinned version). The calculations live in an analytics service, not the handler.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler tests: each metric matches a hand-computed fixture
- [ ] Handler test: before the posttest, the posttest-based fields are null and the call succeeds
- [ ] Handler tests: no token → 401; another session's token → 403; unknown session → 404
- [ ] OpenAPI corrected where the report shape can't be filled as written (each change listed in the Resolution)
- [ ] Cucumber: in the assessment journey, after the posttest, the learner fetches their report
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
