# 05: Game Setup → create Classroom Game → instructor control bar and phase timer

**Status:** ready-for-agent
**Blocked by:** 02, 03

**What to build:**
- `sessionsApi.createSession`, `transitionPhase`, `extendPhase`, `endSession`, `leaveSession`.
- `/setup` (`GameSetupPage`): pick pack (preselect `?packId`), mode, adjudication mode, per-phase timers or instructor-driven (`null`), min chain length; create → save instructor seat → `/sessions/:id`.
- Instructor control bar in `SessionShellPage` (Advance, +1 min, End) and learner Leave, gated by `session-phase.ts`.
- `domain/phase-timer.ts` (remainingSec, `MM:SS`, `isInstructorDriven`, `isInGracePeriod` 5 s), `api/clock-store.ts` (1 s ticker), `shared/PhaseTimerBadge.tsx` via `useSyncExternalStore`.

## Acceptance criteria
- [ ] `tests/web/domain/phase-timer.test.ts` covers null deadline, expiry, grace window, formatting.
- [ ] Advancing in the teacher browser moves the learner browser to the next view within ~2 s.
- [ ] Leave returns the learner to `/login` and the roster marks them departed.
