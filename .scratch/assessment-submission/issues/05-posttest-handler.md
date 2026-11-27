# 05: Implement posttest submission with grading

**What to build:** Extend the assessment handler to compute grades and metacognitive report for posttest submissions. This includes comparing answers against the curriculum pack's answer key and computing all metrics defined in the OpenAPI spec.

**Blocked by:** 04-pretest-handler

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` (route `POST /api/v1/sessions/{sessionId}/assessments/{stage}`, `netlify/functions/submit-assessment.ts`; tests `tests/functions/submit-assessment.test.ts`, `assessment-journey.feature`).

- [ ] Add grading logic: compare answers to `pack.assessmentInstrument.questions[].correctIndex`
- [ ] Compute `AssessmentStageSummary` for both pretest and posttest
- [ ] Compute `knowledgeGainDelta` (posttest correct % - pretest correct %)
- [ ] Compute `guessingReductionDelta` (pretest wrong guess % - posttest wrong guess %)
- [ ] Compute `uncertaintyCalibrationRatio` (I_DONT_KNOW / (I_DONT_KNOW + wrong))
- [ ] Compute `chainDiversityIndex` from participant's chains spanning semantic domains
- [ ] Compute `neglectedKeywordIds` from cards never used in chains
- [ ] Build `answerKeyReview` array with question stems, options, correct answer, explanation
- [ ] Return full `PosttestSubmissionResult` with `LearnerMetacognitiveReport`
