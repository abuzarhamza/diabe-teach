# Spec: BDD non-happy-path coverage for adjudication, cross-kind tokens, account/pack conflicts, and session edge cases

**Status:** ready-for-agent

## Problem Statement

While our in-process handler test suite covers individual route refusals with fake clocks and in-memory doubles, the live HTTP BDD Cucumber suite leaves critical non-happy-path edge cases—and three entire API endpoints—unverified over the real serverless wrapper, routing layer, middleware pipeline, and database:

- **Three implemented API endpoints have zero BDD coverage** (neither happy path nor error paths):
  - `GET /api/v1/accounts/me` (inspecting the signed-in Instructor Account);
  - `POST /api/v1/packs/validate` (dry-run Curriculum Pack validation returning `{ valid, errors, warnings }`);
  - `POST /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains/{chainId}/adjudicate` (peer votes and Instructor Final Rulings on a Concept Chain). Step definitions for peer approval, Instructor Final Ruling, and round standings retrieval were written earlier, along with phase-jump and short-chain steps, but no feature scenario calls them.
- **Twelve documented `ApiErrorCode` values (plus `SURVEY_COMMENTS_TOO_LONG`) are never asserted in BDD:**
  - `ADJUDICATION_LOCKED_BY_INSTRUCTOR` (409) when a peer vote or second ruling arrives after an Instructor Final Ruling—and this HTTP 409 is also missing from the in-process adjudication handler test suite, existing only in domain/use-case unit tests;
  - `CHAIN_NOT_FOUND` (404) when adjudicating a non-existent Concept Chain (which exercises three URL path parameters through `netlify dev`'s 404 `.html` retry quirk);
  - `CHAIN_ALREADY_SUBMITTED` (409) when a learner re-submits the identical Concept Chain path or its reverse in the same Gameplay Round;
  - `INVALID_PHASE_TRANSITION` (409) when an instructor attempts to jump ahead and skip phases;
  - `EMAIL_ALREADY_REGISTERED` (409) when signing up an Instructor Account with an already-registered email (including case and whitespace variants);
  - `ACCOUNT_TEMPORARILY_LOCKED` (423) on the fifth consecutive wrong password and on an immediate retry even with the right password;
  - `PACK_ALREADY_EXISTS` (409) when registering a duplicate Pack Version, and `PACK_IS_SYSTEM_PACK` (403) when attempting to register a new Pack Version of a System Pack;
  - `PACK_VALIDATION_FAILED` (422) when registering a Curriculum Pack whose Keyword Card count cannot fill its board grid;
  - `ASSESSMENT_INCOMPLETE` (422) when submitting an Assessment Attempt with missing answers;
  - `SURVEY_COMMENTS_TOO_LONG` (422) when perception survey comments exceed 1,000 words (which is also omitted from the `ApiErrorCode` enum in the OpenAPI contract);
  - `PAYLOAD_TOO_LARGE` (413) when a request body exceeds 256 KB over the live HTTP wrapper.
- **Cross-kind token refusals are never tested over live HTTP:** ADR-0007 requires that an Account Token and a Capability Token are never interchangeable, yet BDD only tests missing `Authorization` headers, never a Capability Token sent to an `AccountAuth` route or an Account Token sent to a `BearerAuth` Game Session route.
- **Post-leave write refusals (`PARTICIPANT_HAS_LEFT`) are only checked on Concept Chain submission in BDD:** A learner who has left a Game Session is not checked against peer voting, Assessment Attempt submission, or perception survey submission in BDD.

## Solution

Expand the BDD Cucumber feature suite with **13 fast, deterministic, zero-sleep scenarios** across the existing feature files (and close the two small contract/handler gaps exposed by the research report):

1. **Adjudication & standings journey (`classroom-session-journey`):** Exercise peer voting, a learner's forbidden attempt at an Instructor Final Ruling (`403 FORBIDDEN_ROLE`), adjudicating an unknown Concept Chain (`404 CHAIN_NOT_FOUND`), locking a verdict via an Instructor Final Ruling, refusing further votes or rulings on that locked Concept Chain (`409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`), and reading the resulting Gameplay Round standings. Also add a direct handler test for `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR` to the adjudication handler test suite.
2. **Concept Chain topology & duplicate refusals (`classroom-session-journey`):** Exercise `< minChainLength` (`422 CHAIN_TOPOLOGY_INVALID`), same-learner identical-path and reversed-path duplicate submissions (`409 CHAIN_ALREADY_SUBMITTED`), and confirm a classmate can still submit the same path in that Gameplay Round (`201`).
3. **Phase transition & URL parameter refusals (`classroom-session-journey`):** Exercise phase-skipping via `jump` (`409 INVALID_PHASE_TRANSITION`), `jump` without `targetPhase` (`400 INVALID_REQUEST_BODY` naming `targetPhase`), and an out-of-range `:roundNumber` path parameter on Concept Chain listing (`400 INVALID_REQUEST_BODY`).
4. **Comprehensive post-leave write refusals (`classroom-session-journey`):** Verify that a learner who leaves a Game Session is refused with `403 PARTICIPANT_HAS_LEFT` when attempting an Assessment Attempt, a peer vote, or a perception survey submission, and that an instructor is refused with `403 FORBIDDEN_ROLE` when calling `leave`.
5. **Cross-kind token refusals (`classroom-session-journey` & `teacher-account-journey`):** Verify over HTTP that a session Capability Token is refused with `401 UNAUTHORIZED_TOKEN` on `GET /api/v1/accounts/me` and `POST /api/v1/packs`, and that an Account Token is refused with `401 UNAUTHORIZED_TOKEN` on `GET /api/v1/sessions/{sessionId}/rounds/1/chains`.
6. **Instructor Account & Curriculum Pack non-happy paths (`teacher-account-journey`):**
   - Exercise `GET /api/v1/accounts/me` unauthenticated (`401`), authenticated (`200`), and with a Capability Token (`401`).
   - Exercise sign-up schema/domain validation (`400 INVALID_REQUEST_BODY` for bad email or short password) and duplicate email sign-up (`409 EMAIL_ALREADY_REGISTERED` with case/whitespace normalization).
   - Exercise the 5-strike sign-in lock (`401 INVALID_CREDENTIALS` × 4, `423 ACCOUNT_TEMPORARILY_LOCKED` on the 5th wrong password with `details.lockedUntil`, and `423` on an immediate sign-in with the right password).
   - Exercise `POST /api/v1/packs/validate` (`200 { valid: false }` with `INSUFFICIENT_CARDS`) and `POST /api/v1/packs` (`422 PACK_VALIDATION_FAILED`, `409 PACK_ALREADY_EXISTS`, and `403 PACK_IS_SYSTEM_PACK` on a new version of `diabe-teach`).
   - Exercise `404 PACK_NOT_FOUND` when creating a Game Session with an unknown `packId`, and `413 PAYLOAD_TOO_LARGE` when sending a >256 KB body over HTTP.
7. **Assessment Attempt & perception survey validation (`assessment-journey` & `survey-journey`):**
   - Exercise `422 ASSESSMENT_INCOMPLETE` (missing items), `400 INVALID_REQUEST_BODY` (invalid answer option naming `answers.<itemId>`), and `403 FORBIDDEN_ROLE` (instructor token submitting an Assessment Attempt).
   - Exercise `400 INVALID_REQUEST_BODY` (out-of-range Likert rating naming `responses.<itemId>`), `422 SURVEY_COMMENTS_TOO_LONG` (>1,000-word comments), and `403 FORBIDDEN_ROLE` (instructor token submitting a survey), and add `SURVEY_COMMENTS_TOO_LONG` to the OpenAPI `ApiErrorCode` enum.

## User Stories

1. As a learner in Peer-Adjudication, I want my peer vote on a classmate's Concept Chain recorded, so that peer consensus contributes to the round's evaluation.
2. As an instructor, I want a learner who attempts to issue an Instructor Final Ruling (`instructor-approve` or `instructor-reject`) refused with `403 FORBIDDEN_ROLE`, so that learners cannot grade or lock chains themselves.
3. As an instructor, I want adjudicating a non-existent `chainId` to return `404 CHAIN_NOT_FOUND` even under `netlify dev`'s 404 retry behavior, so that missing Concept Chains are reported accurately.
4. As an instructor, I want my Instructor Final Ruling to permanently lock a Concept Chain's verdict (`isLocked: true`), and any subsequent peer vote or instructor ruling on that chain to be refused with `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`, so that finalized rulings cannot be overwritten.
5. As an instructor or learner, I want to retrieve Gameplay Round standings after an Instructor Final Ruling, so that approved Concept Chains are reflected in participant scores and rankings.
6. As a learner in Chain-Mapping, I want a Concept Chain shorter than the Curriculum Pack's `minChainLength` (e.g. 2 cells when 4 are required) refused with `422 CHAIN_TOPOLOGY_INVALID`, so that trivial pairs are not accepted as chains.
7. As a learner in Chain-Mapping, I want re-submitting the same Concept Chain path in the same Gameplay Round refused with `409 CHAIN_ALREADY_SUBMITTED`, so that I cannot farm points from duplicate chains.
8. As a learner in Chain-Mapping, I want submitting the exact reverse of a Concept Chain path I already submitted in the same Gameplay Round refused with `409 CHAIN_ALREADY_SUBMITTED`, so that reversing a chain is treated as the same chain.
9. As a classmate in Chain-Mapping, I want my own submission of a Concept Chain path that another learner already submitted in the same Gameplay Round accepted (`201`), so that independent discovery by different learners is rewarded.
10. As an instructor, I want a phase `jump` that attempts to skip ahead (e.g. from `pretest` to `completed`) refused with `409 INVALID_PHASE_TRANSITION`, so that required Game Session phases are not accidentally bypassed.
11. As an instructor, I want a phase `jump` request missing `targetPhase` refused with `400 INVALID_REQUEST_BODY` naming `targetPhase`, so that malformed transition requests fail clearly.
12. As an instructor or learner, I want listing Concept Chains for an invalid Gameplay Round number (e.g. round `3`) refused with `400 INVALID_REQUEST_BODY`, so that out-of-range round URLs are caught cleanly.
13. As a learner who has left a Game Session, I want any attempt to submit an Assessment Attempt, cast a peer vote, or submit a perception survey refused with `403 PARTICIPANT_HAS_LEFT`, so that departed participants cannot alter session outcomes.
14. As an instructor, I want calling the participant `leave` endpoint with an instructor Capability Token refused with `403 FORBIDDEN_ROLE`, so that the supervising instructor cannot leave their own Game Session as a learner.
15. As a developer enforcing ADR-0007, I want a Game Session Capability Token refused with `401 UNAUTHORIZED_TOKEN` on `AccountAuth` routes (`GET /api/v1/accounts/me` and `POST /api/v1/packs`), so that session tokens never grant Instructor Account or pack-library privileges.
16. As a developer enforcing ADR-0007, I want an Instructor Account's Account Token refused with `401 UNAUTHORIZED_TOKEN` on `BearerAuth` Game Session routes (`GET /api/v1/sessions/{sessionId}/rounds/1/chains`), so that account tokens cannot bypass session-scoped Capability Tokens.
17. As a signed-in teacher, I want `GET /api/v1/accounts/me` to return my `accountId`, normalized `email`, and `createdAt` (`200`), and to refuse unauthenticated requests (`401 UNAUTHORIZED_TOKEN`), so that the UI can verify my active login.
18. As a teacher signing up, I want an invalid email format refused with `400 INVALID_REQUEST_BODY` naming `email`, and a password shorter than 10 characters refused with `400 INVALID_REQUEST_BODY` naming `password`, so that weak or malformed credentials are rejected at sign-up.
19. As a teacher signing up, I want registering an email that is already taken (even with different casing or surrounding whitespace) refused with `409 EMAIL_ALREADY_REGISTERED`, so that duplicate Instructor Accounts cannot be created.
20. As a teacher signing in, I want four wrong passwords to return `401 INVALID_CREDENTIALS`, the fifth consecutive wrong password to lock the account and return `423 ACCOUNT_TEMPORARILY_LOCKED` with `details.lockedUntil`, and an immediate sign-in attempt with the correct password to also return `423 ACCOUNT_TEMPORARILY_LOCKED`, so that brute-force attacks are stopped over HTTP.
21. As a pack author, I want `POST /api/v1/packs/validate` to return `200` with `valid: false` and `INSUFFICIENT_CARDS` when a Curriculum Pack has fewer Keyword Cards than `rows × cols`, and `POST /api/v1/packs` to refuse that pack with `422 PACK_VALIDATION_FAILED`, so that unplayable packs cannot be registered.
22. As a pack author, I want registering the same `packId` and `version` twice refused with `409 PACK_ALREADY_EXISTS`, so that published Pack Versions remain immutable.
23. As a pack author, I want attempting to register a new Pack Version of the `diabe-teach` System Pack refused with `403 PACK_IS_SYSTEM_PACK`, so that built-in System Packs cannot be overwritten by teachers.
24. As a teacher creating a Game Session, I want specifying a non-existent `packId` refused with `404 PACK_NOT_FOUND`, so that sessions cannot start against missing Curriculum Packs.
25. As a developer hardening the serverless API, I want a request body exceeding 256 KB refused over live HTTP with `413 PAYLOAD_TOO_LARGE`, so that oversized payloads are rejected before JSON parsing.
26. As a learner taking a Pretest or Posttest, I want an Assessment Attempt missing required question answers refused with `422 ASSESSMENT_INCOMPLETE`, so that partial submissions are not scored as complete attempts.
27. As a learner taking a Pretest or Posttest, I want an Assessment Attempt with an out-of-range answer choice refused with `400 INVALID_REQUEST_BODY` naming the offending question field, and an instructor token refused with `403 FORBIDDEN_ROLE`, so that only valid learner answers are accepted.
28. As a learner submitting the perception survey, I want a Likert rating outside `1..5` refused with `400 INVALID_REQUEST_BODY` naming the item field, free-text comments over 1,000 words refused with `422 SURVEY_COMMENTS_TOO_LONG`, and an instructor token refused with `403 FORBIDDEN_ROLE`, so that survey data integrity is enforced end-to-end.

## Implementation Decisions

- **No new production routes or domain rules:** All 20 `/api/v1/*` routes and domain error mappings already exist in the codebase. This effort adds BDD feature scenarios, wires up existing unused step definitions, adds thin HTTP client methods and step definitions where needed, adds one missing handler test for `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`, and adds `SURVEY_COMMENTS_TOO_LONG` to the OpenAPI `ApiErrorCode` enum.
- **OpenAPI contract sync:**
  - Add `SURVEY_COMMENTS_TOO_LONG` to the `ApiErrorCode` enum in the OpenAPI contract and document `422` on the perception survey endpoint so the contract matches the domain error middleware.
- **BDD HTTP client additions:**
  - Add `getCurrentAccount(accountToken?)` (`GET /api/v1/accounts/me`) and `validatePack(packData, token?)` (`POST /api/v1/packs/validate`), plus raw/oversized payload and custom-token helper support on the BDD HTTP client so cross-kind tokens and a >256 KB body (`262,145` bytes) can be sent cleanly.
- **Reusing existing unused step definitions:**
  - Wire up the existing unused step definitions for `submits a chain that is too short`, `peer-approves the last submitted chain`, `finalizes adjudication on the last chain with score`, `retrieves standings for round`, `the response should contain standings`, and `jumps to phase` rather than duplicating them, removing or adapting any stale payload assumptions if needed.
- **Zero wall-clock sleeps:**
  - None of the 13 new scenarios may introduce `setTimeout` / real-clock sleeps. Time-dependent boundaries (the 5-second submission grace boundary, 15-minute account lock expiry, and 12-hour token expiry) remain exclusively in the in-process Vitest handler suite with `FakeClock`.

## Testing Decisions

- **What makes a good test:**
  - Assert observable HTTP responses (`status`, standard `{ code, message, details? }` error shape, and subsequent resource state) over real HTTP requests against `npm run dev:local` (and in-process handler seam for the single missing `ADJUDICATION_LOCKED_BY_INSTRUCTOR` handler test).
  - Every new BDD refusal assertion should check the HTTP status code and the specific `ApiErrorCode` (plus `details.field` on `400 INVALID_REQUEST_BODY` schema rejections and `details.lockedUntil` on `423 ACCOUNT_TEMPORARILY_LOCKED`).
- **Seams and modules under test:**
  - **Primary seam — BDD Cucumber HTTP suite:** The four feature files `classroom-session-journey.feature`, `teacher-account-journey.feature`, `assessment-journey.feature`, and `survey-journey.feature` and their step definitions, run sequentially one feature per process against `npm run dev:local`.
  - **Secondary seam — Vitest handler suite:** Add a handler test in the adjudication handler test file verifying that a peer vote and an instructor ruling on an already-locked Concept Chain return `409 ADJUDICATION_LOCKED_BY_INSTRUCTOR`.
- **Prior art:**
  - Existing error-handling scenarios in `classroom-session-journey.feature`, `teacher-account-journey.feature`, `assessment-journey.feature`, and `survey-journey.feature`;
  - Step assertion helpers in `assertions.steps.ts` (`the error code should follow standard format`, `the error details should name field`, `the request should fail with status {int} and error code {string}`);
  - Adjudication handler tests in `tests/functions/adjudicate-chain.test.ts`.
- **Verification gates (run sequentially, one at a time):**
  - `npm run typecheck` passes with 0 errors;
  - `npx vitest run --no-file-parallelism` passes 100%;
  - `npm run test:bdd` passes all 5 features sequentially against `npm run dev:local`, followed by `npm run dev:local:stop`;
  - `npm run lint` (≤ 29) and `npm run lint:boundaries` (≤ 6) do not regress.

## Out of Scope

- Adding BDD scenarios that sleep on real wall-clock timers (15-minute lock expiry, 12-hour token expiry, or additional 5-second grace-period sleeps).
- Testing deterministic optimistic-concurrency write-conflict retries (`409 CONCURRENT_UPDATE_CONFLICT`) or simulated repository crashes (`500 INTERNAL_ERROR`) in BDD; those stay in Vitest handler tests with fake repositories.
- Implementing the deferred `GET /api/v1/sessions/{sessionId}/stream` SSE route.

## Further Notes

- **Primary source:** Research report `.scratch/research/bdd-non-happy-path-coverage.md` (2026-11-21, at `86ba5f3`).
- **Related decisions:**
  - `.scratch/session-phase-deadlines/wiki/decision-test-seam-handlers-plus-clock.md` (why clock-boundary tests live at the handler seam rather than Cucumber);
  - `.scratch/session-phase-deadlines/wiki/decision-one-agent-at-a-time.md` (sequential execution of agents and BDD features);
  - ADR-0007 (strict separation of Account Tokens and Capability Tokens).
