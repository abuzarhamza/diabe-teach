# Spec: Session write integrity (no lost updates, round-checked chain submission)

**Status:** ready-for-agent

## Problem Statement

During a Classroom Game many requests change the same Game Session at almost the same moment: teams submit Concept Chains, participants join, and the instructor transitions the phase. Each request loads the whole session, changes it in memory, and writes the whole session back. Nothing checks whether someone else wrote in between, so the last write silently wins:

- A chain submission that loaded the session just before the instructor ended Chain-Mapping can write the old phase back. The session then reverts to `chain-mapping` and the deadline cutoff is bypassed.
- Two teams submitting at the same moment can overwrite each other, so one team's Concept Chain disappears without an error.
- The same applies to joins, adjudications, Assessment Attempts and perception survey responses.

Separately, a Concept Chain can be submitted to a round that is not running, for example to Round 2 while Round 1 is in Chain-Mapping. The chain is recorded against the wrong round.

## Solution

- **Optimistic concurrency on every Game Session write.** Each stored session carries a version number. A write only succeeds if the stored version is still the one that was loaded; otherwise it is rejected as a concurrent-update conflict, and nothing is overwritten.
- **Automatic retry in the application layer.** When a write conflicts, the use case reloads the session and re-applies the command against the fresh state, up to a small fixed number of attempts. Because the command is re-validated against fresh state, a chain that raced a phase transition is correctly rejected with `PHASE_CLOSED_FOR_SUBMISSIONS`, and two simultaneous chains are both kept. Only if every attempt conflicts does the client get a 409 `CONCURRENT_UPDATE_CONFLICT`, which it may safely retry.
- **Round check on chain submission.** A Concept Chain is accepted only if the round number in the request matches the session's active round. Otherwise it is rejected with `PHASE_CLOSED_FOR_SUBMISSIONS`, since that round is not open for submissions.

- **No repeat chains per team.** (Added 2026-11-17 at the user's request.) A participant cannot submit a Concept Chain they already submitted in the same round (same cells, same or reverse order); the repeat gets 409 `CHAIN_ALREADY_SUBMITTED`. Different teams may still submit the same chain and are scored independently.

## User Stories

1. As an instructor, I want ending Chain-Mapping to be final, so that a late submission cannot reopen the round.
2. As an instructor, I want every team's Concept Chains kept even when teams submit at the same moment, so that no team loses points to a race.
3. As an instructor, I want participants joining at the same moment to all appear in the roster, so that no one is silently dropped.
4. As a participant, I want a clear "phase closed" answer if my chain arrives just after the instructor ended the round, so that I know it was not recorded.
5. As a participant, I want my chain accepted when it merely collided with another team's submission, so that I am not penalised for timing I can't control.
6. As a participant, I want a chain sent to the wrong round to be rejected, so that my submissions always count towards the round being played.
7. As a client developer, I want a distinct `CONCURRENT_UPDATE_CONFLICT` error code that is safe to retry, so that I can tell contention apart from validation failures.
8. As a client developer, I want conflicts to be rare and absorbed by the server, so that my client rarely needs retry logic.
9. As a study researcher, I want recorded Concept Chains, Assessment Attempts and survey responses never to be overwritten, so that study data is complete.
10. As a maintainer, I want the version check enforced in one place (the repository) for every write, so that new use cases are protected by default.
11. As a maintainer, I want the in-memory and MongoDB repositories to behave identically under concurrent writes, so that fast tests reflect production behaviour.
12. As a maintainer, I want existing sessions stored without a version number to keep working, so that the change needs no data migration.
13. As an operator, I want conflict retries bounded, so that a hot session cannot cause unbounded work.
14. As a participant, I want a duplicate of my own chain rejected, so that scores reflect distinct discoveries; and as a team, I want to still be credited for a chain another team also found.

## Implementation Decisions

- **Version on the aggregate.** `GameSession` exposes a version number, loaded from storage and starting at 0 for new sessions. Sessions stored before this change have no version and are read as version 0.
- **Repository contract.** The game-session repository's update operation becomes a conditional write: it succeeds only when the stored version equals the version the session was loaded with, and it then stores version + 1. On mismatch (or a missing document) it throws a new `ConcurrentUpdateConflictError` domain error. Create stays unconditional and stores version 0. This is the optimistic concurrency control described in ADR-0002.
- **MongoDB adapter.** The update filters on both the session id and the expected version (treating a missing version field as 0), and sets version + 1 atomically in the same operation. Zero matched documents means a conflict.
- **In-memory adapter.** Implements the same semantics, so both adapters pass one shared contract test suite.
- **Retry policy.** A single reusable application-layer helper runs "load → apply command → save" and retries on `ConcurrentUpdateConflictError` up to 3 attempts in total, with no sleep or backoff (writes are short). Every session-mutating use case goes through it: join, transition phase, submit Concept Chain, adjudicate Concept Chain, submit Assessment Attempt, submit perception survey. Domain errors other than conflicts are never retried. The clock is read once per request, before the first attempt (consistent with the ticket 02 behaviour of reading time before the repository lookup).
- **New API error code.** Add `CONCURRENT_UPDATE_CONFLICT` to the OpenAPI `ApiErrorCode` enum, mapped to HTTP 409, and document it on every session-mutating operation.
- **Round check.** Submitting a Concept Chain whose round number differs from the session's active round throws `PhaseClosedForSubmissionsError`. The check lives in the aggregate's chain-recording invariant, next to the phase and deadline checks.

## Testing Decisions

- **Good tests exercise external behaviour only:** the repository contract through its port, and HTTP status/code/body through function handlers. They never assert on internal fields or private helpers.
- **Seam 1 — repository contract suite (agreed with the user):** one parameterised suite run against both the in-memory repository and the MongoDB repository (mongodb-memory-server, as in the existing Mongo repository test). Cases:
  - Saving a session loaded at the current version succeeds and increments the version.
  - Saving a stale copy after another save throws `ConcurrentUpdateConflictError` and leaves stored data unchanged.
  - A legacy document without a version can be loaded and saved once.
  - Updating a session that doesn't exist is a conflict, not a silent no-op.
- **Seam 2 — function handler tests (agreed with the user):**
  - A chain submission whose write conflicts with an interleaved phase transition is retried and ends as `PHASE_CLOSED_FOR_SUBMISSIONS`, and the session stays in the transitioned phase.
  - Two conflicting chain submissions both end up recorded.
  - A persistent conflict (a test double that always conflicts) returns 409 `CONCURRENT_UPDATE_CONFLICT` after 3 attempts.
  - A chain sent to a round that is not active is rejected with `PHASE_CLOSED_FOR_SUBMISSIONS`.
- Interleaving is made deterministic with a repository test double that wraps the in-memory repository and performs a scripted competing write before the first save. Tests use no real concurrency and no sleeps.
- **Prior art:** `tests/adapters/mongo-game-session-repository.test.ts` (mongodb-memory-server), `tests/functions/session-phase-deadline.test.ts` (handler tests with `FakeClock`).

## Out of Scope

- Validating request bodies against the OpenAPI schema.
- Checking that the path round number matches the chain's round on adjudication and standings endpoints.
- Concurrency control for Curriculum Packs.
- Moving to per-field atomic operations (for example `$push` for chains) instead of whole-document conditional writes.
- Real-time conflict notifications to clients.

## Further Notes

- Builds on the session-phase-deadlines effort (`8fe821f`, `b0e1b48`, `63e6099`). The race was found by the ticket 02 code review; see `.scratch/session-phase-deadlines/wiki/environment-backlog.md`.
- With whole-document writes, a retry re-applies the whole command, so commands must be safe to re-run against fresh state. They are, because none of them commits side effects before saving. Any future use case that calls external services (for example AI adjudication) before saving must keep that call outside the retried section, or make it idempotent.
