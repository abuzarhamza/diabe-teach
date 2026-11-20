# 05: `POST /api/v1/sessions/{sessionId}/phase` - Transition phase

**What to build:** An instructor can advance the Game Session through its phase state machine. When transitioning into `round-1:chain-mapping` or `round-2:chain-mapping`, a fresh board is shuffled from the Curriculum Pack's Keyword Cards. The endpoint validates the transition is legal per the FSM and returns the updated session state with new phase timer.

**Blocked by:** 01-game-session-aggregate, 02-create-session-endpoint

**Status:** resolved

Resolved 2026-11-20: route `POST /api/v1/sessions/{sessionId}/phase` (`netlify/functions/transition-phase.ts`), added in `b368e85`, with handler tests under `tests/functions/`.

- [ ] `TransitionSessionPhaseUseCase` in `src/application/use-cases/`
- [ ] Port definition with `TransitionPhaseRequest` (action: advance|jump, targetPhase?, seed?)
- [ ] HTTP handler `netlify/functions/sessions/transition-phase.ts` with Middy middleware
- [ ] Require `instructorToken` (role=instructor) for this session
- [ ] Validate phase transition per FSM: pretest → trial-orientation → round-1:chain-mapping → round-1:peer-adjudication → round-1:round-summary → round-2:chain-mapping → ... → completed
- [ ] On round entry: shuffle new board grid using optional seed for reproducibility
- [ ] Error: `INVALID_PHASE_TRANSITION` (409) for illegal FSM transitions
- [ ] Error: `FORBIDDEN_ROLE` (403) when caller is not instructor
- [ ] Tests covering: valid advance, jump to phase, invalid transition, non-instructor blocked
