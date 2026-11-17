# 02: Add AssessmentAttempt to GameSession

**What to build:** Extend the `GameSession` aggregate to store assessment attempts. A participant can submit one pretest and one posttest. The domain model enforces this constraint and stores the raw answers for later grading.

**Blocked by:** 01-domain-errors

**Status:** ready-for-agent

- [ ] Create `AssessmentAttempt` interface with `participantId`, `stage`, `answers`, `submittedAt`
- [ ] Define `McqAnswerChoice` type as `0 | 1 | 2 | 3 | "I_DONT_KNOW"`
- [ ] Add `#assessments: Map<"pretest" | "posttest", AssessmentAttempt>` to GameSession
- [ ] Add `submitAssessment(participantId, stage, answers)` method to GameSession
- [ ] Throw `AssessmentAlreadySubmittedError` if participant already submitted for stage
- [ ] Add `getAssessment(participantId, stage)` method for retrieval
- [ ] Add `_assessments` prop to `GameSessionProps` for rehydration from persistence
- [ ] Update MongoDB schema to persist assessments
