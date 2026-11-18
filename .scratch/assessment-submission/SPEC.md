# Assessment Submission Spec

**Status:** ready-for-agent

## Problem Statement

Participants in a Diabe-teach game session cannot submit their pretest or posttest assessment answers. The game flow includes `pretest` and `posttest` phases, but there is no API endpoint to record assessment attempts. This blocks the core educational measurement functionality that tracks knowledge gain and metacognitive calibration.

## Solution

Implement the `POST /api/v1/sessions/{sessionId}/assessments/{stage}` endpoint that allows participants to submit their multiple-choice answers for pretest or posttest assessments. The endpoint:

- Records participant answers (including explicit "I don't know" selections)
- Returns an ungraded receipt for pretest (to preserve answer-key secrecy)
- Returns a graded result with metacognitive report for posttest
- Prevents duplicate submissions per stage

## User Stories

1. As a participant, I want to submit my pretest answers before the game begins, so that my baseline knowledge is recorded for later comparison.

2. As a participant, I want to receive confirmation that my pretest was recorded, so that I know my submission was successful.

3. As a participant, I want to submit my posttest answers after completing the game rounds, so that my knowledge gain can be measured.

4. As a participant, I want to see my posttest results including correct answers, so that I can learn from my mistakes.

5. As a participant, I want to see my metacognitive report showing knowledge gain delta, so that I understand how much I learned.

6. As a participant, I want to see my uncertainty calibration ratio, so that I understand how well I recognize my knowledge gaps.

7. As a participant, I want to see which keywords I neglected in my chains, so that I can identify blind spots in my reasoning.

8. As a participant, I want to explicitly select "I don't know" for uncertain answers, so that my metacognitive awareness is tracked.

9. As a participant, I want to be prevented from submitting a second assessment for the same stage, so that my original response is preserved.

10. As an instructor, I want participants' pretest answers hidden until posttest completion, so that the assessment remains valid.

11. As an instructor, I want to see cohort-level assessment analytics, so that I can identify common misconceptions.

12. As a system, I want to validate that all required questions are answered, so that incomplete assessments are rejected.

## Implementation Decisions

### Domain Model Extension

- **Assessment storage**: Assessment attempts are stored inside the `GameSession` aggregate as a `Map<"pretest" | "posttest", AssessmentAttempt>`. This keeps the aggregate boundary clean and simplifies duplicate checking.

- **AssessmentAttempt value object**: Contains `participantId`, `stage`, `answers` (Map of questionId to choice), and `submittedAt`. Choices are `0 | 1 | 2 | 3 | "I_DONT_KNOW"`.

- **Answer grading**: Raw answers are stored without grades. Grading is computed at response time by comparing against the curriculum pack's `assessmentInstrument.questions[].correctIndex`.

### Metacognitive Report Computation

- **Computed eagerly at posttest submission**: The `LearnerMetacognitiveReport` is computed when returning `PosttestSubmissionResult`, as required by the OpenAPI contract.

- **Metrics computed**:
  - `correctPercentage`, `wrongGuessPercentage`, `iDontKnowPercentage` per stage
  - `knowledgeGainDelta` = posttest correct % - pretest correct %
  - `guessingReductionDelta` = pretest wrong guess % - posttest wrong guess %
  - `uncertaintyCalibrationRatio` = I_DONT_KNOW count / (I_DONT_KNOW + wrong guess), or 1.0 if both 0
  - `chainDiversityIndex` = computed from participant's chains spanning semantic domains
  - `neglectedKeywordIds` = cards never used in any chain by this participant

### New Domain Errors

- `AssessmentAlreadySubmittedError` (409): Participant has already submitted for this stage
- `AssessmentIncompleteError` (422): Not all required questions answered

### API Contract (from OpenAPI)

- **Request**: `{ answers: Record<questionId, 0 | 1 | 2 | 3 | "I_DONT_KNOW"> }`
- **Pretest Response**: `{ stage: "pretest", participantId, recordedCount, submittedAt }`
- **Posttest Response**: `{ stage: "posttest", participantId, submittedAt, report: LearnerMetacognitiveReport, answerKeyReview: QuestionReviewItem[] }`

### Phase Validation

- Assessment submission is only allowed during the corresponding phase (`pretest` or `posttest`)
- Attempting to submit during wrong phase returns `PHASE_CLOSED_FOR_SUBMISSIONS` (409)

## Testing Decisions

### What Makes a Good Test

- Tests external behavior, not implementation details
- Uses the established seam: unit tests at handler level with InMemory repositories
- Covers happy path, error cases, and edge cases (e.g., all I_DONT_KNOW answers)

### Modules to Test

1. **Handler level** (`tests/functions/submit-assessment.test.ts`):
   - Happy path: pretest submission → 201 with receipt
   - Happy path: posttest submission → 201 with graded result
   - Error: duplicate submission → 409
   - Error: incomplete answers → 422
   - Error: wrong phase → 409
   - Error: missing auth → 401

2. **Use case level** (optional, handler tests may suffice):
   - Metacognitive report computation accuracy
   - Chain diversity index calculation

### Prior Art

- `tests/functions/submit-chain.test.ts` — similar pattern for chain submission
- `tests/functions/adjudicate-chain.test.ts` — similar pattern with state transitions
- Both use InMemoryGameSessionRepository and FakeCapabilityTokenAdapter

## Out of Scope

- **Cohort analytics endpoint** (`GET /analytics`) — separate P3 implementation
- **Survey submission** (`POST /survey`) — separate P2 implementation
- **Real-time SSE notifications** for assessment completion
- **Partial submission / save draft** — assessments must be complete
- **Retake functionality** — one attempt per stage by design

## Further Notes

- The curriculum pack's `assessmentInstrument.questions` provides the answer key
- Each question has `correctIndex` (0-3), `explanation`, and `relatedKeywordIds`
- The `relatedKeywordIds` field enables computing which concepts a participant struggles with
- Pretest secrecy is enforced by returning only `recordedCount` (no grades) until posttest
