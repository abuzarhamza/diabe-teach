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

**Status:** resolved

- [x] Handler tests: each metric matches a hand-computed fixture
- [x] Handler test: before the posttest, the posttest-based fields are null and the call succeeds
- [x] Handler tests: no token → 401; another session's token → 403; unknown session → 404
- [x] OpenAPI corrected where the report shape can't be filled as written (each change listed in the Resolution)
- [x] Cucumber: in the assessment journey, after the posttest, the learner fetches their report
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `GET /api/v1/sessions/{sessionId}/analytics` (`getSessionAnalytics`). A participant token gets `{ role: "participant", participantReport, cohortSummary }`; an instructor token gets `{ role: "instructor", cohortSummary }` (no `participantReport`). `cohortSummary` is `{ sessionId, participantCount }` until ticket 06. New function `netlify/functions/get-session-analytics.ts` routes by `config.path` + `GET` only (no netlify.toml redirect).
- The calculations live in `LearnerAnalyticsService` (`src/application/services/learner-analytics-service.ts`), called by `GetSessionAnalyticsUseCase`; the pack comes from `SessionPackLoader` (pinned Pack Version). Chain diversity counts only approved chains (`status` approved or an approving verdict); neglected keyword ids are the cards on the stored round boards (each once, round/row/column order) that none of the learner's chains used, whatever their verdict. A stage not taken is `null`, and so are the deltas that need it; no board gives `[]`.
- The posttest submission's `report` now comes from the same service, so it matches the analytics route. Client-visible change: its `chainDiversityIndex` counts approved chains only (was every chain), and `neglectedKeywordIds` lists unused cards on the dealt boards (was every pack card not used). The DTO types moved to `src/application/dtos/session-analytics.dto.ts` (re-exported from the submit-assessment port).
- OpenAPI changes:
  1. `getSessionAnalytics`: a description, and a documented 403 `FORBIDDEN_ROLE` (token of another session).
  2. `CohortAnalyticsReport`: `required` is now only `sessionId` and `participantCount`; the cohort means, `meanChainDiversityIndex` and `boardNeglectHeatmap` are optional until ticket 06.
  3. `LearnerMetacognitiveReport`: `pretest`, `posttest`, `knowledgeGainDelta` and `guessingReductionDelta` are now required (always present, `null` when missing); field descriptions state each formula.
  Regenerated request schemas: no change (the route has no body).
- Prototype catalog: `getSessionAnalytics` is `partial` (deviation: cohort summary only has `sessionId`/`participantCount`), with 403 `FORBIDDEN_ROLE` listed.
- Tests: `tests/functions/session-analytics.test.ts` (13, hand-computed fixture incl. pinned-version check); two submit-assessment tests updated for the new neglected-keyword rule; Cucumber: the `@posttest @report` assessment scenario now fetches the learner's report.
- Checks: typecheck clean; vitest 864/864 (`--no-file-parallelism`, no flakes); lint 29 (the pre-commit `eslint --fix` reformatted `submit-assessment.test.ts`, clearing its 20 style errors); boundaries 6; BDD assessment-journey 6/6.

