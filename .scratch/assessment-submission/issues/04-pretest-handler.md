# 04: Implement pretest submission handler

**What to build:** The Netlify function handler for `POST /api/v1/sessions/{sessionId}/assessments/{stage}` that handles pretest submissions. Returns an ungraded receipt to preserve answer-key secrecy.

**Blocked by:** 03-use-case

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` (route `POST /api/v1/sessions/{sessionId}/assessments/{stage}`, `netlify/functions/submit-assessment.ts`; tests `tests/functions/submit-assessment.test.ts`, `assessment-journey.feature`).

- [ ] Create `netlify/functions/sessions/submit-assessment.ts` with `createSubmitAssessmentHandler`
- [ ] Create `netlify/functions/submit-assessment.ts` proxy file
- [ ] Wire middy middleware: `authMiddleware`, `domainErrorMiddleware`
- [ ] Extract `sessionId` and `stage` from path parameters
- [ ] Parse request body as `SubmitAssessmentRequest`
- [ ] For pretest: return `PretestSubmissionReceipt` with `recordedCount` only
- [ ] Add redirect rule in `netlify.toml` for the endpoint
- [ ] Register function export with Netlify v2 config
