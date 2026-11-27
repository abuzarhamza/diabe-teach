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

**Status:** resolved

- [x] Handler tests: each cohort metric and the heatmap match a hand-computed three-learner fixture
- [x] Handler test: the instructor's response has no `participantReport`
- [x] Handler test: a session with no assessments gives null means, not errors
- [x] OpenAPI `CohortAnalyticsReport` matches what is returned
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

`GET /api/v1/sessions/{sessionId}/analytics` now returns the full `cohortSummary` for both roles, computed by the new `CohortAnalyticsService` (`src/application/services/cohort-analytics-service.ts`), which reuses `LearnerAnalyticsService` per learner. The use case now loads the pinned Pack Version for instructors too.

Decisions:
- The cohort is the learners still in the session (the same ones `participantCount` counts); a learner who left is excluded from every metric.
- Each assessment mean is over the cohort learners who took that stage; `null` when none has.
- `meanChainDiversityIndex` is the mean of the learners' `chainDiversityIndex` (0 with no learner).
- `boardNeglectHeatmap[row][col]` = cohort learners whose chains (any verdict) never had that coordinate in their `path`, counting only chains of rounds with a stored board. The grid spans the largest stored board; `[]` before any board.

Contract changes (`docs/api/openapi.yaml`):
- `CohortAnalyticsReport`: all eight fields required again (restored); "only sessionId and participantCount" note replaced with the cohort definition; descriptions on every mean; `meanChainDiversityIndex` gains `minimum: 0`, `maximum: 1`; `boardNeglectHeatmap` items are `integer` with `minimum: 0` (was `number`), and its description changed from "usage frequencies" to "learners who never used the cell".
- `getSessionAnalytics` description: both roles get the same `cohortSummary`.
- Prototype catalog: `getSessionAnalytics` is `implemented`, no deviations.

Tests: `tests/functions/session-analytics.test.ts` adds a three-learner (plus one leaver) hand-computed fixture for every cohort metric and the heatmap, the instructor shape without `participantReport`, and null means with no assessments. Checks: typecheck clean; vitest 872 passed (`--no-file-parallelism`, no intermittent failures); lint 29; boundaries 6; BDD `assessment-journey` passed.
