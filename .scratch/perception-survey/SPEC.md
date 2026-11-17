# P2: Perception Survey Submission

**Status:** ready-for-agent
**Priority:** P2
**Estimated Effort:** 1-2 days

---

## Problem Statement

The Diabe-teach game session flow includes a `feedback-survey` phase after posttest, but there is no endpoint for participants to submit their perception survey responses. The phase exists, the survey items are defined in the Curriculum Pack (9 Likert-scale questions for Diabe-teach), but learners cannot record their feedback. This blocks session completion and prevents collection of valuable pedagogical effectiveness data.

---

## Solution

Implement the `POST /api/v1/sessions/{sessionId}/survey` endpoint that allows participants to submit 5-point Likert scale responses to the Curriculum Pack's perception survey items during the `feedback-survey` phase. The system accepts partial responses (not all items required), validates response values (1-5 only), enforces phase restrictions, prevents duplicate submissions, and optionally accepts free-text comments (capped at 1000 words).

---

## User Stories

1. As a **participant**, I want to submit my perception survey responses during the feedback-survey phase, so that my experience feedback is recorded.

2. As a **participant**, I want to include optional free-text comments with my survey, so that I can provide qualitative feedback beyond Likert ratings.

3. As a **participant**, I want to receive confirmation that my survey was recorded, so that I know my feedback was successfully submitted.

4. As a **participant**, I want to be prevented from submitting the survey twice, so that data integrity is maintained.

5. As a **participant**, I want to be able to submit partial responses (not all items), so that I can skip items I don't want to answer.

6. As a **participant**, I want to receive a clear error if I try to submit outside the feedback-survey phase, so that I understand when surveys are accepted.

7. As a **participant**, I want to receive a clear error if my comment is too long (>1000 words), so that I can shorten it.

8. As an **instructor**, I want to be prevented from submitting surveys (participants only), so that the data represents learner perspectives only.

9. As a **system**, I want to reject responses with invalid Likert values (outside 1-5 range), so that data quality is ensured.

10. As a **system**, I want to silently ignore response keys for survey item IDs that don't exist in the pack, so that the endpoint is lenient with client-side bugs.

11. As a **developer**, I want the survey response stored inside the GameSession aggregate, so that it follows the same persistence pattern as Assessment Attempts.

---

## Implementation Decisions

### Domain Layer

- **New Entity**: `SurveyResponse` value object stored inside `GameSession` aggregate
  - Fields: `participantId`, `responses` (Map<string, 1|2|3|4|5>), `comments` (optional string), `submittedAt`

- **New Domain Errors**:
  - `SurveyAlreadySubmittedError` (code: `SURVEY_ALREADY_SUBMITTED`, HTTP 409)
  - `SurveyCommentsTooLongError` (code: `SURVEY_COMMENTS_TOO_LONG`, HTTP 422)
  - `InvalidSurveyResponseError` (code: `INVALID_SURVEY_RESPONSE`, HTTP 422)

- **GameSession Extension**:
  - Add `surveyResponse: SurveyResponse | null` field
  - Add `submitSurvey(participantId, responses, comments?)` method
  - Add `getSurveyResponse(participantId)` method
  - Rehydration support via `_surveyResponse` prop

### Application Layer

- **New Port**: `submit-perception-survey.port.ts`
  ```typescript
  interface SubmitPerceptionSurveyCommand {
    sessionId: string;
    verifiedCapability: VerifiedCapability;
    responses: Record<string, number>;
    comments?: string;
  }

  interface SurveySubmissionReceipt {
    participantId: string;
    recordedItemCount: number;
    submittedAt: string; // ISO date-time
  }
  ```

- **New Use Case**: `SubmitPerceptionSurveyUseCase`
  - Validate participant role (reject instructors with `FORBIDDEN_ROLE`)
  - Validate phase is `feedback-survey` (reject with `PHASE_CLOSED_FOR_SUBMISSIONS`)
  - Validate no duplicate submission (reject with `SURVEY_ALREADY_SUBMITTED`)
  - Validate all response values are 1-5 (reject with `INVALID_SURVEY_RESPONSE`)
  - Validate comments ≤ 1000 words using `word-count` npm package (reject with `SURVEY_COMMENTS_TOO_LONG`)
  - Filter out invalid item IDs (keep only items in pack's `perceptionSurvey.items`)
  - Store response in GameSession aggregate
  - Return receipt with recorded item count

### Infrastructure Layer

- **New Netlify Function**: `netlify/functions/sessions/submit-survey.ts`
  - Handler using middy middleware pipeline (auth, domain-error)
  - Root delegator at `netlify/functions/submit-survey.ts`

- **MongoDB Schema Extension**: Add `surveyResponse` subdocument to `gameSessionSchema`
  ```typescript
  surveyResponse: {
    participantId: string;
    responses: Record<string, number>;
    comments?: string;
    submittedAt: Date;
  } | null
  ```

- **netlify.toml Redirect**:
  ```toml
  [[redirects]]
    from = "/api/v1/sessions/:sessionId/survey"
    to = "/.netlify/functions/submit-survey"
    status = 200
    force = true
  ```

### Dependencies

- **New npm dependency**: `word-count` - Battle-tested word counting with CJK support (per ADR-0005 npm-first policy)

---

## Testing Decisions

### What Makes a Good Test

Tests should verify **external observable behavior** through the handler's HTTP interface, not internal implementation details. Use in-memory repositories and fake adapters to isolate the handler under test.

### Unit Tests (Handler Seam)

Create `tests/functions/submit-survey.test.ts` following the pattern from `submit-assessment.test.ts`:

| Test Case | Expected Outcome |
|-----------|------------------|
| Submit valid survey during feedback-survey phase | 201 with receipt |
| Submit partial responses (some items only) | 201 with correct `recordedItemCount` |
| Submit with optional comments | 201, comments stored |
| Submit with comments exactly 1000 words | 201 (boundary) |
| Submit with comments 1001 words | 422 `SURVEY_COMMENTS_TOO_LONG` |
| Submit outside feedback-survey phase | 409 `PHASE_CLOSED_FOR_SUBMISSIONS` |
| Submit survey twice | 409 `SURVEY_ALREADY_SUBMITTED` |
| Submit with invalid Likert value (0 or 6) | 422 `INVALID_SURVEY_RESPONSE` |
| Submit with unknown item IDs | 201, unknown IDs silently ignored |
| Submit without token | 401 `UNAUTHORIZED_TOKEN` |
| Submit with instructor token | 403 `FORBIDDEN_ROLE` |

### Integration Tests (BDD Seam)

Create `tests/integration/features/survey-journey.feature`:

```gherkin
Feature: Perception Survey Submission Journey
  As a participant in a Diabe-teach game session
  I want to submit perception survey responses
  So that my experience feedback is recorded

  Scenario: Participant submits perception survey
  Scenario: Participant cannot submit survey twice
  Scenario: Survey submission rejected outside feedback-survey phase
```

### Prior Art

- `tests/functions/submit-assessment.test.ts` - Handler unit test pattern
- `tests/integration/features/assessment-journey.feature` - BDD scenario pattern
- `tests/integration/step-definitions/assessment.steps.ts` - Step definition pattern

---

## Out of Scope

- **Survey analytics aggregation**: Aggregating survey responses across cohorts is deferred to P3 Session Analytics
- **Survey item editing**: Curriculum Pack survey items are immutable; editing requires a new pack version
- **Anonymous surveys**: All submissions are linked to participantId for research correlation
- **Multi-language survey support**: Survey prompts come from the Curriculum Pack; i18n is a pack authoring concern
- **Survey response editing**: Once submitted, responses cannot be modified

---

## Further Notes

- The `word-count` npm package handles CJK characters correctly, future-proofing for internationalized comments
- Survey responses are stored per-session (like Assessment Attempts), not per-participant globally
- The endpoint follows the same middy middleware pipeline as other session endpoints (auth, CORS, security headers, domain-error mapping)
- Phase flow: `posttest` → `feedback-survey` → `completed` (survey is second-to-last phase)
