# 06: Key events log at info, diagnostics at debug

**What to build:** The use cases and adapters write purposeful log lines through the injected `LoggerPort`, using the request's child logger so every line carries the `requestId`. Fields are ids and outcomes only, never emails, tokens, passwords, bodies or whole objects (ticket 04's rule).

**`info`: one line per business event that changes state.**

| Area | Event | Fields |
|---|---|---|
| Accounts | signed up | `accountId` |
| Accounts | signed in | `accountId` |
| Accounts | wrong password | `accountId`, `failedCount` |
| Accounts | locked | `accountId`, `lockedUntil` |
| Packs | registered | `packId`, `version`, `accountId` |
| Packs | archived or unarchived | `packId`, `accountId` |
| Sessions | created | `sessionId`, `mode`, `packId`, `packVersion` |
| Sessions | learner joined | `sessionId`, `participantId` |
| Sessions | learner left | `sessionId`, `participantId` |
| Sessions | phase changed | `sessionId`, `from`, `to` |
| Sessions | phase extended | `sessionId`, `phase`, `newEndsAt` |
| Sessions | session ended | `sessionId`, `fromPhase` |
| Chains | submitted | `sessionId`, `roundNumber`, `chainId`, `length` |
| Chains | peer vote | `chainId`, `decision` |
| Chains | instructor ruling | `chainId`, `approved` |
| Assessments | submitted | `sessionId`, `participantId`, `stage` |
| Survey | submitted | `sessionId`, `participantId` |

**`debug`: diagnostics that explain a decision, off by default when deployed.**
- **Board deal:** `sessionId`, `roundNumber`, `seed`, `rows`/`cols`.
- **Write-conflict retries** in `GameSessionUpdateRetrier`: `sessionId`, `attempt`.
- **Pack read through the pinned version:** `packId`, `packVersion`, whether it fell back to the latest.
- **Pack validation result:** `packId`, error and warning counts.
- **Body validation failures:** `field`, `reason`.
- **Chain visibility rule applied:** `sessionId`, `roundNumber`, `viewer` role, count returned.
- **Mongo connection** opened, reused and closed: no URI.

**`warn`: one line when a request is refused for something unexpected but recoverable.** Examples: a token signed for another kind, or a sign-in attempt on a locked account.

The logger reaches use cases through their dependencies (as `LoggerPort`), defaulting to `SilentLogger`, so existing tests are unchanged.

See spec: `.scratch/structured-logging/spec.md`. Added on 2026-11-20 at the user's request ("add debug log, info based").

**Blocked by:** 02 (Every request logs one summary line with its request id), 04 (Secrets never reach the logs)

**Status:** done

- [x] Handler tests (sink logger) for a representative set: sign-up, sign-in lock, pack register, session create, join, phase change, chain submit and ruling each write their `info` line with the listed fields and the `requestId`
- [x] Test: board deal and write-conflict retry write `debug` lines, which disappear at `LOG_LEVEL=info`
- [x] Test: none of these lines contains an email, token, password or body (reuse ticket 04's secret check over the captured output of a full journey)
- [x] Domain code stays free of the logger. Logging lives in use cases and adapters only, and boundaries stay green.
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution

- **Request logger helper:** `requestLoggerOf(event)` (`src/adapters/inbound/http/request-logger.ts`) returns the per-invocation child logger from `wrapLambdaHandler` (carrying `requestId`, `route`, `method`), defaulting to `SilentLogger` when invoked outside the wrapper.
- **Use-case & service logging:** Use cases and application services (`GameSessionUpdateRetrier`, `PackValidator`, `SessionPackLoader`) accept `logger: LoggerPort = new SilentLogger()` on their method signatures, keeping existing unit/handler tests unchanged and keeping `src/domain/` completely free of logger imports.
- **`info` business events:** Implemented across accounts (sign-up, sign-in, wrong password, lock), packs (registered, archived, unarchived), sessions (created, learner joined, learner left, phase changed, phase extended, session ended), chains (submitted, peer vote, instructor ruling), assessments (submitted), and perception survey (submitted) with ids and outcome fields only.
- **`debug` diagnostics & `warn` refusals:** Board deal (`sessionId`, `roundNumber`, `seed`, `rows`, `cols`), write-conflict retry (`sessionId`, `attempt`), pinned pack load (`packId`, `packVersion`, `fellBackToLatest`), pack validation (`packId`, `errorCount`), body validation failure (`field`, `reason`), chain visibility rule (`sessionId`, `roundNumber`, `viewer`, `count`), and Mongo connection lifecycle (connect, reuse, close, worker release — no URI) log at `debug`. Cross-kind token refusal (`bearer token refused` with `scheme` and `claimedKind`) and sign-in attempts on a locked account (`sign-in refused: account locked`) log at `warn`.
- **Tests:** `tests/functions/key-event-logs.test.ts` (9 tests) verifies the full journey's `info` and `debug` lines with `requestId`, wrong-password/lock progression and locked `warn`, cross-kind token `warn`, request schema `debug`, full-journey secret absence (and positive control), and write-conflict retry `debug` line disappearing under `LOG_LEVEL=info`.
- **Verification:** `npm run typecheck` clean; `npx vitest run --no-file-parallelism` 53 files / 961 tests passed; `npm run test:bdd` 5 features / 53 scenarios / 574 steps passed; `npm run lint` 29 errors (baseline ≤ 29); `npm run lint:boundaries` 6 violations (baseline ≤ 6).
