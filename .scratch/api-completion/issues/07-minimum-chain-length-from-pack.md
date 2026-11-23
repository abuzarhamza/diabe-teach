# 07: Minimum chain length comes from the Curriculum Pack

**What to build:** Chain submission enforces the pack's minimum chain length (from `boardConfig`, read through the session's pinned Pack Version) instead of the fixed 4 cells, falling back to 4 when the pack doesn't set one. A chain that is too short is still 422 `CHAIN_TOPOLOGY_INVALID`; under 2 cells stays a schema 400. Run this after server-owned-board 03, which also changes chain submission.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** server-owned-board 03 (`.scratch/server-owned-board/issues/03-check-chains-against-board.md`)

**Status:** resolved

- [x] Handler tests: a pack with minimum 3 accepts 3 cells and refuses 2; a pack with no minimum refuses 3 and accepts 4
- [x] The prototype catalog's fixed-4-cells deviation is removed
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `SubmitConceptChainUseCase` loads the session once, reads its Curriculum Pack through `SessionPackLoader` (pinned Pack Version, or latest for legacy sessions) and enforces `CurriculumPack.minChainLength`: the pack's `boardConfig.minChainLength`, or `CurriculumPack.DEFAULT_MIN_CHAIN_LENGTH` (4) when the pack doesn't set one. Too short is still 422 `CHAIN_TOPOLOGY_INVALID`; under 2 cells stays a schema 400.
- The submit-chain handler now requires `packRepo` (production: `AppRuntime`'s pack repository); the `minChainLength` override is gone. `GameSessionUpdateRetrier.run` takes an optional already-loaded session for its first attempt, so a submission still loads the session once.
- Handler tests in `tests/functions/submit-chain.test.ts` (minimum 3 from the pinned version, while a later version says 5; no minimum falls back to 4).
- `claudPoc/concept-chain/api-catalog.js`: the fixed-4-cells deviation is removed, a note documents the pack minimum, and the "Shortest chain allowed" gap note is updated.
- Checks: typecheck passes; vitest 874 passed (`--no-file-parallelism`, no intermittent failures); lint 29; boundaries 6; BDD classroom-session-journey 24/24 and solo-session-journey 8/8.
