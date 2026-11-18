# 03: `POST /api/v1/sessions/join` - Join via room code

**What to build:** A student can join an active Game Session by providing the 6-character `roomCode` and an optional `displayName`. The endpoint looks up the session, adds the participant to the roster, signs a `participantToken` (Capability Token with role=participant), and returns the current session state including the board grid if the session is in a round phase.

**Blocked by:** 01-game-session-aggregate, 02-create-session-endpoint

**Status:** ready-for-agent

- [ ] `JoinGameSessionUseCase` in `src/application/use-cases/`
- [ ] Port definition with `JoinSessionRequest` and `JoinSessionResponse` DTOs
- [ ] HTTP handler `netlify/functions/sessions/join-session.ts` with Middy middleware
- [ ] Lookup session by `roomCode` via `GameSessionRepositoryPort.findByRoomCode`
- [ ] Generate unique `participantId` and add to session roster
- [ ] Sign `participantToken` with role=participant, sessionId, participantId
- [ ] Return current session state snapshot
- [ ] Error: `ROOM_CODE_NOT_FOUND` (404) when room code doesn't exist
- [ ] Tests covering: happy path, unknown room code (404), duplicate join handling
