# 13: Solo Practice quick start

**Status:** ready-for-agent
**Blocked by:** 05

**What to build:** "Solo Practice" on `/login` and `/setup` → `createSession({ mode: "solo", packId, adjudicationMode })` without sign-in → save the returned seat (`participantId`, `participantToken`, and `instructorToken`) → `/sessions/:id`, learner advances own phases.

**Open question:** `createSession` needs a `packId`. How a signed-out learner picks it on `/login` is not decided. See spec, "Open questions (need the user)", (c).

## Acceptance criteria
- [ ] `web/tests/features/game-session/solo-practice.test.tsx` (rendered over the fake fetch): Solo Practice sends no Account Token and lands on `/sessions/:id`.
- [ ] Full solo run from pretest to completed works against `dev:local`.
