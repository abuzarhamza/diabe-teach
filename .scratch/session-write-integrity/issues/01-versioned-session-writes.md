# 01: Session saves check the version and report conflicts instead of overwriting

**What to build:** Every Game Session carries a version number. Saving a session succeeds only if the stored version still equals the version that was loaded; the save then stores version + 1. A stale save throws `ConcurrentUpdateConflictError` and overwrites nothing. That error maps to HTTP 409 with a new `CONCURRENT_UPDATE_CONFLICT` API error code. Sessions stored before this change (no version field) load as version 0. Both the in-memory and MongoDB repositories implement identical semantics. Use cases don't retry yet, so after this ticket a race gives a 409 instead of a silent lost update.

See spec: `.scratch/session-write-integrity/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `GameSession` exposes a version (new sessions: 0; loaded sessions: the stored value, or 0 if absent)
- [ ] The repository update is conditional on the expected version and increments it atomically (Mongo: filter on id + version, treating a missing field as 0, in the same operation)
- [ ] Updating a session that doesn't exist is reported as a conflict, not a silent no-op
- [ ] `ConcurrentUpdateConflictError` → 409 `CONCURRENT_UPDATE_CONFLICT`; the OpenAPI `ApiErrorCode` enum is updated
- [ ] One parameterised repository contract suite runs against both the in-memory and the Mongo (mongodb-memory-server) repositories, covering: a fresh save increments the version; a stale save is rejected and leaves data unchanged; a legacy unversioned document loads and saves; a missing document is a conflict
- [ ] Existing tests, BDD and lint baselines unchanged
