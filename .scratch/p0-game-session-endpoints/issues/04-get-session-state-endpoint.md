# 04: `GET /api/v1/sessions/{sessionId}` - Get session state

**What to build:** Any participant or instructor with a valid session token can fetch the current Game Session state snapshot, including: session metadata (mode, adjudication mode), current phase, phase timer info (startedAt, endsAt), participant count, active round number, and the active board grid (if in a round phase). The board grid shows Keyword Card placements for the current round.

**Blocked by:** 01-game-session-aggregate, 02-create-session-endpoint

**Status:** resolved

Resolved 2026-11-20: route `GET /api/v1/sessions/{sessionId}` (`netlify/functions/get-session.ts`), added in `b368e85`, with handler tests under `tests/functions/`.

- [ ] `GetGameSessionStateUseCase` in `src/application/use-cases/`
- [ ] Port definition with `GetSessionStateQuery` and `PublicSessionState` DTO
- [ ] HTTP handler `netlify/functions/sessions/get-session.ts` with Middy middleware
- [ ] Require valid Bearer token (instructor or participant for this session)
- [ ] Project `PublicSessionState` with board grid view when in round phase
- [ ] Error: `SESSION_NOT_FOUND` (404) when sessionId doesn't exist
- [ ] Error: `FORBIDDEN_ROLE` (403) when token's sessionId doesn't match
- [ ] Tests covering: instructor view, participant view, session not found, wrong session token
