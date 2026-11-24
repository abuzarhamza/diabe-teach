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

**Status:** ready-for-agent

- [ ] `tests/chaos/README.md` and `tests/chaos/outbound-fault-injection.test.ts` exist and pass in Vitest
- [ ] Verifies credentialed MongoDB errors are sanitized in logs and hidden from HTTP 500 responses
- [ ] Verifies 1-conflict and 2-conflict retry recovery vs. 3-conflict exhaustion (`409 CONCURRENT_UPDATE_CONFLICT`)
- [ ] Verifies a 25-learner concurrent join, chain-submit, and assessment stampede preserves 100% of writes with zero lost updates
