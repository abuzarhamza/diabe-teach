# 04: Assessment Attempt and perception survey validation/role refusals in BDD and `SURVEY_COMMENTS_TOO_LONG` contract sync

**What to build:** Add non-happy-path validation and role-refusal scenarios to the assessment and perception survey BDD features, sync `SURVEY_COMMENTS_TOO_LONG` in the OpenAPI contract, and run the complete 5-feature sequential BDD verification suite:
1. **OpenAPI contract sync:**
   - Add `SURVEY_COMMENTS_TOO_LONG` to the `ApiErrorCode` enum in the OpenAPI contract and document `422` on the perception survey submission operation so the contract matches `domainErrorMiddleware`.
2. **Assessment Attempt refusals (`assessment-journey`):**
   - Submitting an Assessment Attempt that omits required question answers is refused with `422 ASSESSMENT_INCOMPLETE`.
   - Submitting an Assessment Attempt with an out-of-range answer choice (e.g. `7` for `dm-mcq-01`) is refused with `400 INVALID_REQUEST_BODY` naming `answers.dm-mcq-01`.
   - An instructor attempting to submit a Pretest Assessment Attempt using their instructor Capability Token is refused with `403 FORBIDDEN_ROLE`.
3. **Perception survey refusals (`survey-journey`):**
   - Submitting a perception survey with a Likert rating outside `1..5` (e.g. `6` for `survey-q1`) is refused with `400 INVALID_REQUEST_BODY` naming `responses.survey-q1`.
   - Submitting a perception survey whose free-text `comments` exceed 1,000 words is refused with `422 SURVEY_COMMENTS_TOO_LONG`.
   - An instructor attempting to submit a perception survey using their instructor Capability Token is refused with `403 FORBIDDEN_ROLE`.

See spec: `.scratch/bdd-non-happy-path-coverage/spec.md`.

**Blocked by:** None (runs last so its final check verifies all 5 BDD features together)

**Status:** ready-for-agent

- [ ] `SURVEY_COMMENTS_TOO_LONG` is listed in OpenAPI's `ApiErrorCode` enum and `422` is documented on perception survey submission (and generated request schemas stay fresh if affected)
- [ ] BDD assessment scenarios: incomplete answers return `422 ASSESSMENT_INCOMPLETE`, an invalid answer choice returns `400 INVALID_REQUEST_BODY` naming `answers.dm-mcq-01`, and an instructor token returns `403 FORBIDDEN_ROLE`
- [ ] BDD survey scenario: an out-of-range Likert rating returns `400 INVALID_REQUEST_BODY` naming `responses.survey-q1`, >1,000-word comments return `422 SURVEY_COMMENTS_TOO_LONG`, and an instructor token returns `403 FORBIDDEN_ROLE`
- [ ] Full sequential verification: `npm run typecheck`, `npx vitest run --no-file-parallelism`, all 5 BDD features via `npm run test:bdd` (followed by `npm run dev:local:stop`), `npm run lint` (≤ 29), and `npm run lint:boundaries` (≤ 6) all pass
