# 04: Starting a classroom game needs a signed-in teacher

**What to build:** Creating a **classroom** Game Session requires a valid Account Token. The session records the creating account as `ownerAccountId`. The response is unchanged: it still returns the per-session instructor Capability Token, and every in-game route (state, phase transition, rulings, standings) keeps using that token exactly as today, so a token expiring or a teacher signing out never breaks a running class. **Solo** sessions need no Account Token and store no owner. `creatorDisplayName` stays a per-game choice. `ownerAccountId` is persisted in MongoDB, and sessions stored before this change load with no owner.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** 01 (Teachers sign up and sign in with an email and password)

**Status:** resolved

- [x] Handler test: a classroom create-session request with no token, an invalid token, an expired token, or an instructor Capability Token instead of an Account Token returns 401 and stores no session
- [x] Handler test: a classroom create-session request with a valid Account Token returns 201 as before, and the stored session has that account as `ownerAccountId`
- [x] Handler test: a solo create-session request with no token still works and auto-joins the learner
- [x] Handler test: in-game routes still accept the session's instructor Capability Token after the Account Token has expired
- [x] Game Session repository contract suite: `ownerAccountId` round-trips; Mongo-only case: a legacy session with no owner loads
- [x] Existing BDD and handler tests that create classroom sessions are updated to sign in first
- [x] Cucumber scenarios: a teacher signs up, starts a classroom game, and a learner joins with the room code; starting a classroom game without signing in is refused
- [x] OpenAPI documents the Account Token requirement and the 401 on classroom create-session
- [x] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse

## Resolution (2026-11-19)

`POST /api/v1/sessions` now uses the `AccountAuth` scheme. `CreateGameSessionUseCase` refuses any non-solo start without an account (401 `UNAUTHORIZED_TOKEN`, checked before the pack lookup, so no session is stored) and records it as `ownerAccountId` (domain, in-memory and Mongo; legacy documents load as `null`). Solo starts ignore any account and store no owner. An `ownerAccountId` in the request body is overridden. The response is unchanged. `study-rct` is treated like classroom (it needs an Account Token too). Handler tests get a signed-in teacher from `tests/functions/support/signed-in-teacher.ts` (`createSignedInCreateSessionHandler`). BDD's classroom step signs up a fresh teacher when the scenario hasn't signed in yet. The two new scenarios are in `teacher-account-journey.feature`. Checks: typecheck clean, vitest 450/450, BDD 5/5 features, lint 100 (baseline 118), boundaries 6.
