# 06: The teacher gets cohort analytics and the board neglect heatmap

**What to build:** `cohortSummary` is filled for both roles:
- `participantCount`;
- pretest and posttest cohort means;
- posttest wrong-guess and "I don't know" means;
- `meanChainDiversityIndex`;
- `boardNeglectHeatmap`: for each grid coordinate, how many learners never used it, across rounds with a stored board.

An instructor token returns `{ role: "instructor", cohortSummary }` with no `participantReport`.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 05 (A learner gets their own analytics report)

**Status:** ready-for-agent

- [ ] Handler tests: each cohort metric and the heatmap match a hand-computed three-learner fixture
- [ ] Handler test: the instructor's response has no `participantReport`
- [ ] Handler test: a session with no assessments gives null means, not errors
- [ ] OpenAPI `CohortAnalyticsReport` matches what is returned
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
