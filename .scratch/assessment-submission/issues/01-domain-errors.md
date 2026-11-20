# 01: Add domain errors for assessment

**What to build:** Two new domain error classes that the assessment submission flow will throw when a participant tries to submit twice or submits incomplete answers. These integrate with the existing `domainErrorMiddleware` to return proper HTTP status codes.

**Blocked by:** None (can start immediately)

**Status:** resolved

Resolved 2026-11-20: done in `3e37faf` (route `POST /api/v1/sessions/{sessionId}/assessments/{stage}`, `netlify/functions/submit-assessment.ts`; tests `tests/functions/submit-assessment.test.ts`, `assessment-journey.feature`).

- [ ] Add `AssessmentAlreadySubmittedError` extending `DomainError` with code `ASSESSMENT_ALREADY_SUBMITTED`
- [ ] Add `AssessmentIncompleteError` extending `DomainError` with code `ASSESSMENT_INCOMPLETE`
- [ ] Update `domainErrorMiddleware` to map these to 409 and 422 respectively
- [ ] Follow existing error pattern in `src/domain/errors/domain-errors.ts`
