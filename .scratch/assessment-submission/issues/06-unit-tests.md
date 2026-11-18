# 06: Add unit tests for assessment submission

**What to build:** Comprehensive unit tests at the handler level covering all success and error paths. Follow the existing test patterns used by submit-chain and adjudicate-chain handlers.

**Blocked by:** 05-posttest-handler

**Status:** ready-for-agent

- [ ] Create `tests/functions/submit-assessment.test.ts`
- [ ] Test: pretest submission during pretest phase → 201 with receipt
- [ ] Test: posttest submission during posttest phase → 201 with graded result
- [ ] Test: duplicate pretest submission → 409 ASSESSMENT_ALREADY_SUBMITTED
- [ ] Test: duplicate posttest submission → 409 ASSESSMENT_ALREADY_SUBMITTED
- [ ] Test: incomplete answers → 422 ASSESSMENT_INCOMPLETE
- [ ] Test: submission during wrong phase → 409 PHASE_CLOSED_FOR_SUBMISSIONS
- [ ] Test: missing auth token → 401 UNAUTHORIZED_TOKEN
- [ ] Test: all I_DONT_KNOW answers → valid submission with 100% uncertainty calibration
- [ ] Test: metacognitive report accuracy (knowledge gain, guessing reduction)
- [ ] Use InMemoryGameSessionRepository and FakeCapabilityTokenAdapter
