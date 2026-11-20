# 12: Sign-in lock is exact under concurrent attempts

**What to build:** The wrong-password counter and lock update atomically, using a Mongo atomic update (`$inc` with a conditional lock) or the optimistic-concurrency pattern already used for Game Sessions, for both the in-memory and Mongo account repositories. Five concurrent wrong passwords give exactly one 15-minute lock, and no attempt is lost.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Account repository contract suite (in-memory and Mongo): five concurrent failed attempts give a count of 5 and one lock
- [x] Existing sign-in lock handler tests still pass unchanged
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

Chose a Mongo atomic update over optimistic concurrency: one conditional `findOneAndUpdate` needs no version field, no retry loop and no conflict error. The repository port gains `recordFailedSignIn(accountId, now)`. Mongo runs it as a single `findOneAndUpdate` whose filter skips an account locked at `now` and whose update pipeline adds one to the count and, at five, sets the 15-minute lock and restarts the count (the aggregate's rule and constants). The in-memory repository applies the aggregate's `recordFailedSignIn` with no await between read and write. The sign-in use case calls it instead of read-modify-`saveSignInCounters`. The contract suite (both repositories) adds four tests: four concurrent failures give a count of 4; five concurrent failures are each counted (results 1 to 4, then the lock) with exactly one 15-minute lock; a failure while locked counts nothing and doesn't extend the lock; an unknown account records nothing. Handler tests unchanged and passing. Checks: typecheck passes, vitest 904 passed, lint 29, boundaries 6, BDD teacher-account-journey 10/10.
