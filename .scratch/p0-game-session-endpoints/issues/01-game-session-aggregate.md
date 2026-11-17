# 01: Create GameSession aggregate and repository

**What to build:** A GameSession domain aggregate that manages the complete lifecycle of a concept-chaining game: participant roster, phase state machine (pretest → trial-orientation → round-1:chain-mapping → ... → completed), timer configuration, active board grids per round, and submitted Concept Chains. Include the repository port (`GameSessionRepositoryPort`) with `create`, `findById`, `findByRoomCode`, and `update` methods, plus both MongoDB and in-memory adapter implementations.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] `GameSession` aggregate root in `src/domain/game-session/` with phase state machine validation
- [x] `SessionId` and `RoomCode` value objects with generation logic (6-char alphanumeric room codes)
- [x] `Participant` value object with `participantId`, `displayName`, and role
- [x] `GameSessionRepositoryPort` in `src/application/ports/` with `create`, `findById`, `findByRoomCode`, `update`
- [ ] `MongoGameSessionRepository` in `src/adapters/outbound/` with Mongoose schema (deferred - InMemory sufficient for MVP)
- [x] `InMemoryGameSessionRepository` for testing
- [x] Phase transition validation (only valid FSM transitions allowed)
- [ ] Board grid shuffling logic using Curriculum Pack's Keyword Cards (deferred to ticket 05/06)
