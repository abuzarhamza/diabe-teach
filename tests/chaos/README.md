# 8. Chaos / Fault-Injection & Concurrency Stampede Tests (`tests/chaos/`)

Contains **Chaos & Concurrency Load Tests** at the outbound port seam:
- `outbound-fault-injection.test.ts` — Simulates transient MongoDB connection drops with credentialed URIs (verifying clean 500 responses and stripped log URIs), 1- and 2-conflict optimistic-concurrency retry recoveries (each retry after a jittered backoff) vs. exhaustion at `GameSessionUpdateRetrier.MAX_ATTEMPTS` (10) conflicts (`409 CONCURRENT_UPDATE_CONFLICT`, snapshot unchanged), and a 25-learner concurrent join/assessment/chain-submit classroom stampede. Each learner sends once: the server's jittered exponential backoff (base 20 ms, cap 500 ms, full jitter, real timers with seeded jitter) absorbs the contention, so the test asserts zero 409s, that retries really happened, and that every write is stored exactly once (`version` = committed writes).

Run:
```bash
npx vitest run --no-file-parallelism tests/chaos
```
