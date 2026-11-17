# 06: Add unit tests for survey submission

**What to build:** Handler-level unit tests covering all success and error paths. Tests use in-memory repositories and fake token adapter to isolate the handler under test.

**Blocked by:** 05-http-handler

**Status:** ready-for-agent

- [ ] Create `tests/functions/submit-survey.test.ts`
- [ ] Test: submit valid survey during feedback-survey phase → 201 with receipt
- [ ] Test: submit partial responses (some items only) → 201 with correct `recordedItemCount`
- [ ] Test: submit with optional comments → 201, comments stored
- [ ] Test: submit with comments exactly 1000 words → 201 (boundary)
- [ ] Test: submit with comments 1001 words → 422 `SURVEY_COMMENTS_TOO_LONG`
- [ ] Test: submit outside feedback-survey phase → 409 `PHASE_CLOSED_FOR_SUBMISSIONS`
- [ ] Test: submit survey twice → 409 `SURVEY_ALREADY_SUBMITTED`
- [ ] Test: submit with invalid Likert value (0 or 6) → 422 `INVALID_SURVEY_RESPONSE`
- [ ] Test: submit with unknown item IDs → 201, unknown IDs silently ignored
- [ ] Test: submit without token → 401 `UNAUTHORIZED_TOKEN`
- [ ] Test: submit with instructor token → 403 `FORBIDDEN_ROLE`
