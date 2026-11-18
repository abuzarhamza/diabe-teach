# 07: Add BDD integration tests for survey

**What to build:** Cucumber BDD scenarios testing the full survey submission journey through the HTTP API. These validate the end-to-end flow from session creation through survey submission.

**Blocked by:** 06-unit-tests

**Status:** ready-for-agent

- [ ] Create `tests/integration/features/survey-journey.feature`
- [ ] Create `tests/integration/step-definitions/survey.steps.ts`
- [ ] Add HTTP client method `submitSurvey(sessionId, token, responses, comments?)`
- [ ] Scenario: Participant submits perception survey and receives receipt
- [ ] Scenario: Participant cannot submit survey twice
- [ ] Scenario: Survey submission rejected outside feedback-survey phase
- [ ] Add step: "the instructor advances to the feedback-survey phase"
- [ ] Add assertions for receipt fields (participantId, recordedItemCount, submittedAt)
