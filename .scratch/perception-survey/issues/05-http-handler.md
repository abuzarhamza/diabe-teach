# 05: Add submit-survey HTTP handler

**What to build:** The Netlify function that exposes `POST /api/v1/sessions/{sessionId}/survey`. When a participant POSTs their survey responses, the handler validates auth, invokes the use case, and returns 201 with a receipt or an appropriate error.

**Blocked by:** 04-use-case

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` and `f52ba83` (route `POST /api/v1/sessions/{sessionId}/survey`, `netlify/functions/submit-survey.ts`; tests `tests/functions/submit-survey.test.ts`, `survey-journey.feature`).

- [ ] Create `netlify/functions/sessions/submit-survey.ts` with `createSubmitSurveyHandler()` factory
- [ ] Use middy middleware pipeline: `authMiddleware`, `domainErrorMiddleware`
- [ ] Extract `sessionId` from path parameters
- [ ] Parse request body for `responses` and optional `comments`
- [ ] Invoke `SubmitPerceptionSurveyUseCase.execute()`
- [ ] Return 201 with `SurveySubmissionReceipt` JSON body
- [ ] Create root delegator `netlify/functions/submit-survey.ts` with v2 config
- [ ] Add redirect to `netlify.toml`: `/api/v1/sessions/:sessionId/survey` → `submit-survey`
