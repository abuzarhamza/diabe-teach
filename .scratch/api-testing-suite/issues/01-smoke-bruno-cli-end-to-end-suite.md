# 01: [SMOKE / BRUNO CLI] Runnable Bruno CLI end-to-end smoke suite (`npm run test:bruno`) passing all 21 `.bru` requests

**Category:** Smoke & End-to-End API Testing (`docs/api/bruno/` + `scripts/run-bruno-smoke.ts`)

**What to build:** Fix the 4 response-shape assertions and phase-transition sequencing in `docs/api/bruno/` (identified in `.scratch/research/eligible-api-testing-catalog.md` §2.1) so running `npm run test:bruno` (`bru run -r --env "Local Dev"`) against a running local server (`npm run dev:local` or `npm run dev:prototype`) executes all 21 `.bru` files top-to-bottom and passes 21/21 requests and 100% of assertions:
1. **Fix response assertions in `.bru` `tests` blocks to match actual API response shapes:**
   - `03-Curriculum-Packs/02-get-pack-by-id.bru`: assert `res.body.pack.id` and `res.body.pack.cards`.
   - `04-Game-Sessions/03-get-session-state.bru`: assert `res.body.sessionId` and `res.body.participants`.
   - `05-Chains-and-Adjudication/01-submit-chain.bru`: assert `res.body.chain.chainLength`.
   - `06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru`: assert `res.body.stage` and `res.body.recordedCount`.
2. **Ensure top-to-bottom phase & repeatability readiness across `02`–`06`:**
   - Make `02-Instructor-Accounts/01-sign-up-instructor.bru` and `03-Curriculum-Packs/04-register-pack.bru` repeatable across multiple runs against the same server (or use `script:pre-request` / dynamic variables / accept `201 | 409` when already seeded, while `02-sign-in-instructor.bru` always captures a fresh `accountToken`).
   - Ensure the Game Session created in `04-Game-Sessions/01-create-session.bru` is in the required phase before each phase-gated request (`pretest` for `01-submit-assessment.bru`, `round-1:chain-mapping` for `01-submit-chain.bru`, and `feedback-survey` for `03-submit-survey.bru`—via `script:pre-request` `bru.sendRequest` or natural request ordering).
3. **Add `npm run test:bruno` (`scripts/run-bruno-smoke.ts`) & regenerate `docs/api/api-docs.html`:**
   - `scripts/run-bruno-smoke.ts` loads the configured `apiKey` (from `tests/integration/support/test-config-loader.ts` or `.env.dev.yaml`), runs `bru run -r --env "Local Dev" --env-var apiKey=...` in `docs/api/bruno/`, and exits non-zero if any request or test fails.
   - Re-run `npm run generate:api-docs` so `docs/api/api-docs.html` reflects the updated `.bru` files.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `npm run test:bruno` executes all 21 `.bru` files against `npm run dev:local` (or `dev:prototype`) and passes 21/21 requests and all `tests` assertions
- [x] Running `npm run test:bruno` a second time in a row against the same running server also passes 21/21 (idempotent/repeatable)
- [x] `npm run generate:api-docs` updates `docs/api/api-docs.html` and `tests/bruno-collection-drift.test.ts` passes

## Resolution

- Fixed response-shape assertions in `03-Curriculum-Packs/02-get-pack-by-id.bru` (`res.body.pack.id`, `res.body.pack.cards`), `04-Game-Sessions/03-get-session-state.bru` (`res.body.sessionId`, `res.body.participants`), `05-Chains-and-Adjudication/01-submit-chain.bru` (`res.body.chain.chainLength`), and `06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru` (`res.body.stage`, `res.body.recordedCount`).
- Added idempotent repeat-run handling on `02-Instructor-Accounts/01-sign-up-instructor.bru` (`201 | 409 EMAIL_ALREADY_REGISTERED`) and `03-Curriculum-Packs/04-register-pack.bru` (`201 | 409 PACK_ALREADY_EXISTS`), plus `script:pre-request` phase-readiness helpers (`bru.sendRequest`) on `01-submit-chain.bru`, `01-submit-assessment.bru`, and `03-submit-survey.bru`.
- Added `scripts/run-bruno-smoke.ts` and `"test:bruno"` in `package.json`, and regenerated `docs/api/api-docs.html`.
