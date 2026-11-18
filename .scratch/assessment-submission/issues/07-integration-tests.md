# 07: Add integration tests for assessment flow

**What to build:** Cucumber BDD scenarios that test the full assessment journey through the HTTP API. These validate the end-to-end flow from session creation through pretest, game rounds, and posttest.

**Blocked by:** 06-unit-tests

**Status:** ready-for-agent

- [ ] Create `tests/integration/features/assessment-journey.feature`
- [ ] Create `tests/integration/step-definitions/assessment.steps.ts`
- [ ] Add HTTP client method `submitAssessment(sessionId, stage, token, answers)`
- [ ] Scenario: Participant submits pretest and receives ungraded receipt
- [ ] Scenario: Participant submits posttest and receives graded result with report
- [ ] Scenario: Participant cannot submit pretest twice
- [ ] Scenario: Participant cannot submit posttest without completing pretest first
- [ ] Scenario: Assessment submission rejected outside correct phase
- [ ] Add assertions for metacognitive report fields
