# Classroom session lifecycle

A signed-in teacher starts a classroom Game Session on a pack and gets a 6-character room code and an instructor Capability Token. Learners join with the room code and get a participant token. Everyone can read the session state, but only the instructor can advance it through the 11 phases, extend a timed phase or end the session early. A learner can leave, after which their writes are refused but reads still work.

## Sub-features

- `session-create` creates a `classroom` session (Account Token required) in phase `pretest`, with `roomCode` and `instructorToken`.
- `session-create-unauthenticated` refuses a classroom create without an Account Token.
- `session-join` lets a learner join by room code and get `participantId` and `participantToken`.
- `session-join-unknown-room` refuses an unknown room code.
- `session-state` returns the phase, the roster and the participant count to both roles.
- `session-advance` moves through `pretest` → `trial-orientation` → `round-1:chain-mapping` (and deals `activeBoard`) → … → `completed`.
- `session-advance-forbidden` refuses an advance with a participant token, and refuses jumping more than one phase.
- `session-extend` adds 1..600 seconds to a timed phase's `phaseEndsAt`.
- `session-leave` marks a learner as left (it is idempotent) and lowers `participantCount`.
- `session-end` ends the session from any active phase. Ending it twice gives `409`.

## How to get to it (user POV)

- `POST /api/v1/sessions` (teacher, Account Token; `mode` is `classroom`, `study-rct` or `solo`).
- `POST /api/v1/sessions/join` (learner, API key only).
- `GET /api/v1/sessions/:sessionId` (instructor or participant token for that session).
- `POST /api/v1/sessions/:sessionId/phase`, `POST /api/v1/sessions/:sessionId/phase/extend` and `POST /api/v1/sessions/:sessionId/end` (instructor token).
- `POST /api/v1/sessions/:sessionId/leave` (participant token).
- Bruno: `docs/api/bruno/04-Game-Sessions/`, plus `06-…/04-leave-session.bru` and `05-end-session.bru`.

## Driving it with vapi

Preconditions:

- Baseline from the [README](./README.md).

- **Teacher signs up.** Run `vapi req session-lifecycle sign-up POST /api/v1/accounts/sign-up --json '{"email":"session.teacher@example.edu","password":"correct horse battery"}' --expect 201 --save accountToken=accountToken`.
- **Create without signing in.** Run `vapi req session-lifecycle create-no-token POST /api/v1/sessions --json '{"packId":"diabe-teach","mode":"classroom","adjudicationMode":"peer-instructor"}' --expect 401 --expect-code UNAUTHORIZED_TOKEN`.
- **Create a classroom session.** Run `vapi req session-lifecycle create POST /api/v1/sessions --auth accountToken --bru-body docs/api/bruno/04-Game-Sessions/01-create-session.bru --expect 201 --save sessionId=sessionId --save roomCode=roomCode --save instructorToken=instructorToken`. Run `vapi set packId=diabe-teach` first, because the Bruno body uses `{{packId}}`. The response holds a `roomCode` matching `^[A-Z0-9]{6}$`, and `state.currentPhase` is `pretest`.
- **Learner joins.** Run `vapi req session-lifecycle join POST /api/v1/sessions/join --json '{"roomCode":"{{roomCode}}","displayName":"Alice"}' --expect 200 --expect-field sessionId={{sessionId}} --save participantId=participantId --save participantToken=participantToken`.
- **Unknown room code.** Run `vapi req session-lifecycle join-unknown POST /api/v1/sessions/join --json '{"roomCode":"ZZZZZZ","displayName":"Bob"}' --expect 404 --expect-code ROOM_CODE_NOT_FOUND`.
- **Instructor sees the roster.** Run `vapi req session-lifecycle state-instructor GET /api/v1/sessions/{{sessionId}} --auth instructorToken --expect 200 --expect-field state.currentPhase=pretest --expect-field state.participantCount=1 --expect-field state.participants.0.displayName=Alice`.
- **Learner cannot advance.** Run `vapi req session-lifecycle advance-as-participant POST /api/v1/sessions/{{sessionId}}/phase --auth participantToken --json '{"action":"advance"}' --expect 403 --expect-code FORBIDDEN_ROLE`.
- **Skipping a phase is refused.** Run `vapi req session-lifecycle jump-two POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"jump","targetPhase":"round-1:chain-mapping"}' --expect 409 --expect-code INVALID_PHASE_TRANSITION`.
- **Advance twice.** Run `vapi req session-lifecycle advance-1 POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"advance"}' --expect 200 --expect-field previousPhase=pretest --expect-field state.currentPhase=trial-orientation`, then `vapi req session-lifecycle advance-2 POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"advance","seed":"verify-seed"}' --expect 200 --expect-field state.currentPhase=round-1:chain-mapping`.
- **Learner sees the dealt board.** Run `vapi req session-lifecycle state-participant GET /api/v1/sessions/{{sessionId}} --auth participantToken --expect 200 --expect-field state.currentPhase=round-1:chain-mapping --expect-field state.activeRoundNumber=1`. The evidence shows `activeBoard` filled with Keyword Cards.
- **Extend the phase.** Run `vapi req session-lifecycle extend POST /api/v1/sessions/{{sessionId}}/phase/extend --auth instructorToken --json '{"seconds":60}' --expect 200`. `state.phaseEndsAt` is 60 s later than in `state-participant`. An out-of-range value (`{"seconds":601}`) returns `--expect 400 --expect-code INVALID_REQUEST_BODY`.
- **Learner leaves.** Run `vapi req session-lifecycle leave POST /api/v1/sessions/{{sessionId}}/leave --auth participantToken --expect 200`. Run it again with label `leave-again` to get another `200`, because leaving is idempotent. Then `vapi req session-lifecycle state-after-leave GET /api/v1/sessions/{{sessionId}} --auth participantToken --expect 200 --expect-field state.participantCount=0` shows a reader who has left can still read, and the roster entry has `leftAt`.
- **Teacher ends the session.** Run `vapi req session-lifecycle end POST /api/v1/sessions/{{sessionId}}/end --auth instructorToken --expect 200 --expect-field state.currentPhase=completed`, then `vapi req session-lifecycle end-again POST /api/v1/sessions/{{sessionId}}/end --auth instructorToken --expect 409 --expect-code SESSION_ALREADY_COMPLETED`.
- **Token for another session.** Create a second (solo) session with `vapi req session-lifecycle other-session POST /api/v1/sessions --json '{"packId":"diabe-teach","mode":"solo","adjudicationMode":"peer-instructor"}' --expect 201 --save otherInstructorToken=instructorToken`, then `vapi req session-lifecycle state-wrong-session GET /api/v1/sessions/{{sessionId}} --auth otherInstructorToken --expect 403 --expect-code FORBIDDEN_ROLE`.

## Gotchas

- The phase field is `currentPhase`, not `phase`. Bruno's tests and some of its docs say `phase`; trust the response. `GET /sessions/:id` returns `{ state: { sessionId, roomCode, packId, packVersion, mode, adjudicationMode, currentPhase, activeRoundNumber, phaseStartedAt, phaseEndsAt, participantCount, participants, activeBoard } }` (observed at `37e2b89`). Phase writes return `{ previousPhase, state }`, so every assertion goes under `state.`.
- With the Bruno `timerConfig`, every phase is timed. A `null` duration makes that phase instructor-driven, and `extend` then returns `409 PHASE_HAS_NO_TIMER`. A session created without `timerConfig` uses defaults; check `phaseEndsAt` before you assume either.
- `jump` only accepts the immediate next phase. Anything else, including going backwards, is `409 INVALID_PHASE_TRANSITION`.
- When many learners join at once they may get `409 CONCURRENT_UPDATE_CONFLICT`. The retrier now uses jittered backoff (as of `a12e34d`). A single join must never return it.
- Leave takes no body, and neither does end.
