# 12: Sign-in lock is exact under concurrent attempts

**What to build:** The wrong-password counter and lock update atomically, using a Mongo atomic update (`$inc` with a conditional lock) or the optimistic-concurrency pattern already used for Game Sessions, for both the in-memory and Mongo account repositories. Five concurrent wrong passwords give exactly one 15-minute lock, and no attempt is lost.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Account repository contract suite (in-memory and Mongo): five concurrent failed attempts give a count of 5 and one lock
- [ ] Existing sign-in lock handler tests still pass unchanged
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
