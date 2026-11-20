# 07: Minimum chain length comes from the Curriculum Pack

**What to build:** Chain submission enforces the pack's minimum chain length (from `boardConfig`, read through the session's pinned Pack Version) instead of the fixed 4 cells, falling back to 4 when the pack doesn't set one. A chain that is too short is still 422 `CHAIN_TOPOLOGY_INVALID`; under 2 cells stays a schema 400. Run this after server-owned-board 03, which also changes chain submission.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** server-owned-board 03 (`.scratch/server-owned-board/issues/03-check-chains-against-board.md`)

**Status:** ready-for-agent

- [ ] Handler tests: a pack with minimum 3 accepts 3 cells and refuses 2; a pack with no minimum refuses 3 and accepts 4
- [ ] The prototype catalog's fixed-4-cells deviation is removed
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
