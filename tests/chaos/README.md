# 8. Chaos / Fault-Injection & Concurrency Stampede Tests (`tests/chaos/`)

Contains **Chaos & Concurrency Load Tests** at the outbound port seam:
- `outbound-fault-injection.test.ts` — Simulates transient MongoDB connection drops with credentialed URIs (verifying clean 500 responses and stripped log URIs), 1- and 2-conflict optimistic-concurrency retry recoveries vs. 3-conflict exhaustion (`409 CONCURRENT_UPDATE_CONFLICT`), and a 25-learner concurrent join/assessment/chain-submit classroom stampede. In the stampede each simulated learner client re-sends on `409 CONCURRENT_UPDATE_CONFLICT` (25 simultaneous writes overrun the server's 3-attempt retrier); the test proves a 409 commits nothing and every acknowledged write is stored exactly once (`version` = committed writes).

Run:
```bash
npx vitest run --no-file-parallelism tests/chaos
```
