# 13: Session persistence follows the domain

**What to build:** The Mongo game-session schema builds its phase enum from the domain's `PHASE_ORDER`. The in-memory Game Session repository copies sessions through the domain's snapshot and restore (the same path Mongo uses) rather than a hand-written field list, so a new field can never be dropped silently.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 04 (Learner leaves the session), so that `leftAt` is already in the snapshot

**Status:** resolved

- [x] Test: the schema's phase enum equals `PHASE_ORDER`
- [x] Repository contract suite: every field of a fully populated session survives a save and load in both repositories
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- The domain owns the round-trip: `GameSession.toSnapshot()` / `GameSession.fromSnapshot()` over a new `GameSessionSnapshot` type (every field required), with `ConceptChain.toSnapshot()` / `fromSnapshot()` for chains.
- The in-memory repository's `#copy` is now `GameSession.fromSnapshot({ ...session.toSnapshot(), version })`; the hand-written field list is gone.
- The Mongo repository saves from `toSnapshot()` (plain fields are spread through, only Map/list fields are converted) and loads by building a snapshot (legacy defaults filled) for `fromSnapshot()`.
- `game-session.schema.ts` builds the `currentPhase` enum from `[...PHASE_ORDER]`; a test checks the schema's enum equals `PHASE_ORDER`.
- Contract suite: "keeps every field of a fully populated session across a save and load" uses a typed `GameSessionSnapshot` fixture, asserts it has no null/empty value anywhere, then compares `toSnapshot()` after create+load and after update+load in both repositories. Checked by removing `extendedPhaseEndsAt` from the schema: the test fails for Mongo.
- Checks: typecheck passes; vitest (`--no-file-parallelism`) 907 passing (was 904); lint 29; boundaries 6; BDD classroom-session-journey 24/24 and solo-session-journey 8/8 against `dev:local`.
