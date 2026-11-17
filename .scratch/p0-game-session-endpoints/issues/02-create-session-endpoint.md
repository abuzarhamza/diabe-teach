# 02: `POST /api/v1/sessions` - Create Game Session

**What to build:** An instructor can create a new Game Session by specifying a Curriculum Pack ID, session mode (solo/classroom/study-rct), and adjudication mode (ai/peer-instructor/hybrid). The endpoint returns a unique `sessionId`, generated `roomCode` for students to join, an `instructorToken` (Capability Token with role=instructor), and the initial session state. For solo mode, a `participantToken` is also auto-generated.

**Blocked by:** 01-game-session-aggregate

**Status:** completed

- [ ] `CreateGameSessionUseCase` in `src/application/use-cases/`
- [ ] Port definition with `CreateSessionRequest` and `CreateSessionResponse` DTOs
- [ ] HTTP handler `netlify/functions/sessions/create-session.ts` with Middy middleware
- [ ] Generate unique 6-character alphanumeric room code
- [ ] Sign `instructorToken` using `CapabilityTokenPort`
- [ ] For solo mode: auto-join creator as participant and sign `participantToken`
- [ ] Validate `packId` exists via `CurriculumPackRepositoryPort`
- [ ] Return initial session state with phase="pretest" (or first configured phase)
- [ ] Tests covering: happy path, unknown packId (404), solo mode auto-join
