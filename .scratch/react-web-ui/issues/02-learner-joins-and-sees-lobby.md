# 02: Learner joins by room code and lands in the polling Session Shell (Lobby)

**Status:** done
**Blocked by:** 01 (done, satisfied)

**What to build:**
- `web/src/api/session-seat-store.ts` (new file, next to `account-token-store.ts`): per-session Capability Token seat (`sessionId, role, token, participantId, displayName, roomCode`), kept strictly separate from the Account Token (ADR-0007).
- `web/src/api/sessions-api.ts`: `joinSession`, `getSessionState`.
- `domain/session-phase.ts`: all 11 `PhaseIdentifier` values (the state's `currentPhase`) → `{ title, step, view, canAdvance, canExtend, canEnd, canLeave }` per role.
- Learner Quick Join form on `/login` (`roomCode` + `displayName`) → `/sessions/:sessionId`.
- `features/game-session/session-hooks.ts`: `useSessionState(sessionId)` (the 2-second poll, `refetchInterval: 2000`) and `useJoinSession()`. Only this hooks file imports TanStack Query (react-login-screen 06).
- `game-session/SessionShellPage.tsx`: calls `useSessionState`, renders the view chosen by `session-phase.ts` from `state.currentPhase`, keyed by `state.currentPhase` (round views also use `state.activeRoundNumber`). Unimplemented views render a "coming soon" placeholder.
- `views/LobbyView.tsx`: room code, live roster from `state.participants` (active when `leftAt` is `null`, departed otherwise), settings (look from `claudPoc/concept-chain/lobby.html`).

## Acceptance criteria
- [x] `web/tests/domain/session-phase.test.ts` covers all 11 phases × both roles.
- [x] `web/tests/features/game-session/join-session.test.tsx` (rendered `/login` and `/sessions/:sessionId` over `web/tests/support/fake-fetch.ts`): joining stores the seat and lands in the Lobby; the state poll sends that seat's token; a second session's seat does not overwrite the first; the Account Token is untouched.
- [x] Unknown room code shows the server error code in `ErrorBanner` (same test file).
- [x] A second browser joining appears in the first browser's roster within ~2 s.
