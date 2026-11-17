# 01: Add survey domain errors

**What to build:** Three new domain error classes that map to appropriate HTTP status codes. When a participant submits a survey twice, submits a comment that's too long, or provides invalid Likert values, the system returns clear error codes that clients can handle.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Create `SurveyAlreadySubmittedError` class with code `SURVEY_ALREADY_SUBMITTED` (maps to 409)
- [ ] Create `SurveyCommentsTooLongError` class with code `SURVEY_COMMENTS_TOO_LONG` (maps to 422), include actual/max word counts in metadata
- [ ] Create `InvalidSurveyResponseError` class with code `INVALID_SURVEY_RESPONSE` (maps to 422), include the invalid value in metadata
- [ ] Update `domainErrorMiddleware` to map new error codes to HTTP statuses
- [ ] Export new errors from `domain-errors.ts`
