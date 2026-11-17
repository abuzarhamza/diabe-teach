# 02: Chain submissions retry after a conflict

**What to build:** A reusable application-layer helper that runs "load session → apply command → save" and, on `ConcurrentUpdateConflictError`, reloads and re-applies the command, up to 3 attempts in total with no backoff. Only conflicts are retried; other domain errors are not. Concept Chain submission is the first use case to adopt it. The clock is read once per request, before the first attempt. Outcome: a chain that races the instructor's phase transition is re-validated against fresh state and rejected with `PHASE_CLOSED_FOR_SUBMISSIONS`, and the session stays in the new phase. Two simultaneous chain submissions are both recorded. A conflict that persists through all 3 attempts returns 409 `CONCURRENT_UPDATE_CONFLICT`.

See spec: `.scratch/session-write-integrity/spec.md`.

**Blocked by:** 01 (versioned session writes)

**Status:** resolved

- [x] Handler test: a chain submission interleaved with a phase transition ends as `PHASE_CLOSED_FOR_SUBMISSIONS`, and the session remains in the transitioned phase
- [x] Handler test: two conflicting chain submissions both end up recorded
- [x] Handler test: a repository double that always conflicts → 409 `CONCURRENT_UPDATE_CONFLICT` after exactly 3 save attempts
- [x] Handler test: a non-conflict domain error is not retried (one save attempt at most)
- [x] Interleaving is scripted deterministically via a repository test double (no real concurrency, no sleeps)
- [x] The retry helper is a single module that other use cases can adopt
