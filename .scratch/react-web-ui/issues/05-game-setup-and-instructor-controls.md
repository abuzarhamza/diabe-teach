# 05: Game Setup → create Classroom Game → instructor control bar and phase timer

**Status:** ready-for-agent
**Blocked by:** 02, 03

**What to build:**
- `sessionsApi.createSession`, `transitionPhase`, `extendPhase`, `endSession`, `leaveSession`.
- `/setup` (`GameSetupPage`, replacing today's placeholder behind `TeacherRoute`): pick pack (preselect `?packId`), mode (`classroom` or `solo`), adjudication mode, per-phase timers or instructor-driven (`null`); create → save instructor seat in `session-seat-store.ts` → `/sessions/:id`. The pack's `boardConfig.minChainLength` is shown, not set here (`CreateSessionRequest` has no such field).
- Open question: `SessionMode` also has `study-rct`. Offer it or leave it out? See spec, "Open questions (need the user)", (b).
- Hooks for these calls live in `features/game-session/session-hooks.ts`.
- Instructor control bar in `SessionShellPage` (Advance, +1 min, End) and learner Leave, gated by `session-phase.ts`.
- `domain/phase-timer.ts` (remainingSec, `MM:SS`, `isInstructorDriven`, `isInGracePeriod` 5 s), `api/clock-store.ts` (1 s ticker), `shared/PhaseTimerBadge.tsx` via `useSyncExternalStore`.

## Acceptance criteria
- [ ] `web/tests/domain/phase-timer.test.ts` covers null deadline, expiry, grace window, formatting.
- [ ] `web/tests/features/game-session/game-setup.test.tsx` and `instructor-controls.test.tsx` (rendered over the fake fetch): create sends the chosen settings with the Account Token and lands on `/sessions/:id`; Advance, +1 min, End and Leave send the instructor's or learner's Capability Token and are shown only when `session-phase.ts` allows them.
- [ ] Advancing in the teacher browser moves the learner browser to the next view within ~2 s.
- [ ] Leave returns the learner to `/login` and the roster marks them departed.
