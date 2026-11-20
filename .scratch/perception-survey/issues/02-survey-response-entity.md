# 02: Add SurveyResponse entity to GameSession

**What to build:** A `SurveyResponse` value object stored inside the `GameSession` aggregate. Participants can submit survey responses via `session.submitSurvey()`, which enforces the duplicate submission rule at the domain level.

**Blocked by:** 01-domain-errors

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` and `f52ba83` (route `POST /api/v1/sessions/{sessionId}/survey`, `netlify/functions/submit-survey.ts`; tests `tests/functions/submit-survey.test.ts`, `survey-journey.feature`).

- [ ] Add `SurveyResponse` interface to `game-session.types.ts` with fields: `participantId`, `responses` (Map<string, 1|2|3|4|5>), `comments` (optional string), `submittedAt`
- [ ] Add `#surveyResponse: SurveyResponse | null` private field to `GameSession`
- [ ] Add `surveyResponse` getter to `GameSession`
- [ ] Add `submitSurvey(participantId, responses, comments?)` method that throws `SurveyAlreadySubmittedError` if already submitted
- [ ] Add `getSurveyResponse(participantId)` method
- [ ] Support rehydration via `_surveyResponse` prop in `GameSessionProps`
