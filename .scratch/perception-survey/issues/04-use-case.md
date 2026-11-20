# 04: Create SubmitPerceptionSurveyUseCase

**What to build:** The application-layer use case that orchestrates survey submission. It validates the participant role, checks the phase is `feedback-survey`, validates response values and comment length, filters invalid item IDs, stores the response, and returns a receipt.

**Blocked by:** 02-survey-response-entity, 03-mongodb-persistence

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` and `f52ba83` (route `POST /api/v1/sessions/{sessionId}/survey`, `netlify/functions/submit-survey.ts`; tests `tests/functions/submit-survey.test.ts`, `survey-journey.feature`).

- [ ] Install `word-count` npm package for comment length validation
- [ ] Create `submit-perception-survey.port.ts` with `SubmitPerceptionSurveyCommand` and `SurveySubmissionReceipt` types
- [ ] Create `SubmitPerceptionSurveyUseCase` class implementing the port
- [ ] Validate participant role (throw `ForbiddenRoleError` for instructors)
- [ ] Validate phase is `feedback-survey` (throw `PhaseClosedForSubmissionsError` otherwise)
- [ ] Validate all response values are 1-5 (throw `InvalidSurveyResponseError` for invalid values)
- [ ] Validate comments ≤ 1000 words using `word-count` (throw `SurveyCommentsTooLongError` if exceeded)
- [ ] Filter out response keys for item IDs not in pack's `perceptionSurvey.items`
- [ ] Call `session.submitSurvey()` and persist via repository
- [ ] Return `SurveySubmissionReceipt` with `participantId`, `recordedItemCount`, `submittedAt`
