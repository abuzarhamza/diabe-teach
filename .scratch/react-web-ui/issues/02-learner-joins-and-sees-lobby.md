# 02: Learner joins by room code and lands in the polling Session Shell (Lobby)

**Status:** ready-for-agent
**Blocked by:** 01

**What to build:**
- `token-store.ts`: per-session Capability Token seat (`sessionId, role, token, participantId, displayName, roomCode`), kept strictly separate from the Account Token (ADR-0007).
- `sessions-api.ts`: `joinSession`, `getSessionState`.
- `domain/session-phase.ts`: all 11 `SessionPhase` values → `{ title, step, view, canAdvance, canExtend, canEnd, canLeave }` per role.
- Learner Quick Join form on `/login` (`roomCode` + `displayName`) → `/sessions/:sessionId`.
- `game-session/SessionShellPage.tsx`: `useQuery(refetchInterval: 2000)`, renders view chosen by `session-phase.ts`, keyed by `state.phase`. Unimplemented views render a "coming soon" placeholder.
- `views/LobbyView.tsx`: room code, live roster (active vs departed), settings (look from `claudPoc/concept-chain/lobby.html`).

## Acceptance criteria
- [ ] `tests/web/domain/session-phase.test.ts` covers all 11 phases × both roles.
- [ ] Token-store test: two sessions' seats do not overwrite each other; Account Token untouched.
- [ ] Unknown room code shows the server error code in `ErrorBanner`.
- [ ] A second browser joining appears in the first browser's roster within ~2 s.
