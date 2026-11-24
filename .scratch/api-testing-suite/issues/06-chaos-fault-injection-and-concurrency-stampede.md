# 06: [CHAOS & LOAD TESTS] Outbound fault-injection & 25-learner concurrent classroom stampede (`tests/chaos/outbound-fault-injection.test.ts`)

**Category:** Chaos / Fault-Injection & Concurrency Load Testing (`tests/chaos/`)

**What to build:** Create `tests/chaos/` (with `tests/chaos/README.md`) and build `tests/chaos/outbound-fault-injection.test.ts` to test system resilience under outbound repository failures and high concurrency:
1. **Outbound Repository Chaos / Fault Injection (`FlakyRepository` decorators):**
   - Simulate transient MongoDB connection drops throwing errors that embed real-looking credentials (`MongoNetworkError: failed to connect to mongodb+srv://admin:SuperSecret99@cluster0.example.mongodb.net/diabe_teach`):
     - Verify the HTTP response is a clean `500 INTERNAL_ERROR` with no stack trace, no MongoDB URI, and no credentials in the HTTP body.
     - Verify the structured `error` log line in `InMemoryLogSink` carries the `requestId` and has the credentials stripped to `mongodb+srv://<redacted>@cluster0.example.mongodb.net/diabe_teach`.
   - Simulate transient `ConcurrentUpdateConflictError` bursts on `GameSessionRepositoryPort.update`:
     - 1 and 2 consecutive write conflicts recover transparently on attempt 2 or 3 (`200`/`201`) and emit `"session write conflict; retrying"` at `debug`.
     - 3 consecutive write conflicts fail closed with `409 CONCURRENT_UPDATE_CONFLICT` without corrupting the stored `GameSession` snapshot.
2. **25-Learner Concurrent Classroom Stampede (In-Process Load Test):**
   - Fire 25 concurrent `joinGameSession` requests followed by 25 concurrent `submitConceptChain` requests and 25 concurrent `submitAssessmentAttempt` requests against a single `GameSession`:
     - Verify all 25 learners are recorded in `session.participants` (`participantCount === 25`) with zero lost updates, all 25 chains are stored in Round 1, and `session.version` increments atomically for every committed write.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `tests/chaos/README.md` and `tests/chaos/outbound-fault-injection.test.ts` exist and pass in Vitest
- [x] Verifies credentialed MongoDB errors are sanitized in logs and hidden from HTTP 500 responses
- [x] Verifies 1-conflict and 2-conflict retry recovery vs. 3-conflict exhaustion (`409 CONCURRENT_UPDATE_CONFLICT`)
- [x] Verifies a 25-learner concurrent join, chain-submit, and assessment stampede preserves 100% of writes with zero lost updates

## Resolution

`tests/chaos/outbound-fault-injection.test.ts` (3 tests) drives the real route handlers through `wrapLambdaHandler` with a `FaultInjectingGameSessionRepository` decorator over `InMemoryGameSessionRepository`.

- **Credentialed MongoDB drop:** HTTP body is exactly `{ code: "INTERNAL_ERROR", message: "An unexpected error occurred." }` (no URI, host, error name or stack). Every `error` log line carries the `requestId`. Deviation from the spec text: `MongoCredentialStripper` removes the whole `user:pass@` userinfo with no placeholder, so the logged URI is `mongodb+srv://cluster0.example.mongodb.net/diabe_teach`, not `mongodb+srv://<redacted>@...`. The test checks what the code actually does.
- **Write-conflict bursts:** 1 and 2 conflicts recover (`200`) with three `debug` lines that say `"session write conflict; retrying"` (attempts 2, 2, 3). 3 conflicts return `409 CONCURRENT_UPDATE_CONFLICT`, and the stored snapshot is unchanged except for the simulated competing writer's version bumps.
- **25-learner stampede:** 25 joins at once overrun the server's 3-attempt `GameSessionUpdateRetrier`, so some learners get a clean `409`. Each simulated client sends the request again on `409` (`sendUntilCommitted`). The test proves a 409 commits nothing and every acknowledged write is stored exactly once: 25 participants, 25 Pretest attempts and 25 Round 1 chains, all from distinct learners, with `version` = 77 (25 + 25 + 2 phase transitions + 25). Finding: if a real classroom's clients do not retry on 409, a join burst will turn learners away.
