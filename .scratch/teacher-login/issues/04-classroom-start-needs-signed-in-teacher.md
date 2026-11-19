# 04: Starting a classroom game needs a signed-in teacher

**What to build:** Creating a **classroom** Game Session requires a valid Account Token. The session records the creating account as `ownerAccountId`. The response is unchanged: it still returns the per-session instructor Capability Token, and every in-game route (state, phase transition, rulings, standings) keeps using that token exactly as today, so a token expiring or a teacher signing out never breaks a running class. **Solo** sessions need no Account Token and store no owner. `creatorDisplayName` stays a per-game choice. `ownerAccountId` is persisted in MongoDB, and sessions stored before this change load with no owner.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** 01 (Teachers sign up and sign in with an email and password)

**Status:** ready-for-agent

- [ ] Handler test: a classroom create-session request with no token, an invalid token, an expired token, or an instructor Capability Token instead of an Account Token returns 401 and stores no session
- [ ] Handler test: a classroom create-session request with a valid Account Token returns 201 as before, and the stored session has that account as `ownerAccountId`
- [ ] Handler test: a solo create-session request with no token still works and auto-joins the learner
- [ ] Handler test: in-game routes still accept the session's instructor Capability Token after the Account Token has expired
- [ ] Game Session repository contract suite: `ownerAccountId` round-trips; Mongo-only case: a legacy session with no owner loads
- [ ] Existing BDD and handler tests that create classroom sessions are updated to sign in first
- [ ] Cucumber scenarios: a teacher signs up, starts a classroom game, and a learner joins with the room code; starting a classroom game without signing in is refused
- [ ] OpenAPI documents the Account Token requirement and the 401 on classroom create-session
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
