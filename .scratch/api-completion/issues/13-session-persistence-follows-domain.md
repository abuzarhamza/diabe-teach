# 13: Session persistence follows the domain

**What to build:** The Mongo game-session schema builds its phase enum from the domain's `PHASE_ORDER`. The in-memory Game Session repository copies sessions through the domain's snapshot and restore (the same path Mongo uses) rather than a hand-written field list, so a new field can never be dropped silently.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 04 (Learner leaves the session), so that `leftAt` is already in the snapshot

**Status:** ready-for-agent

- [ ] Test: the schema's phase enum equals `PHASE_ORDER`
- [ ] Repository contract suite: every field of a fully populated session survives a save and load in both repositories
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
