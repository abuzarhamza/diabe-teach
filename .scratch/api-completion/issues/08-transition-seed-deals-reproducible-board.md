# 08: A transition seed deals a reproducible board

**What to build:** When a phase transition into a round's chain-mapping carries `seed`, the board dealer uses it (`seedrandom`), so the same pack, Pack Version and seed always give the same board. The seed is stored with the round's board. With no seed, behaviour is unchanged.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler tests: two sessions on the same pack and version with the same seed get identical boards; different seeds give different boards
- [x] Game Session repository contract suite: the board seed round-trips
- [x] The prototype catalog's "seed is ignored" deviation is removed
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- No production code change was needed: the server-owned board work (`5964cdb`) already deals each round with `seedrandom` from the transition `seed` (then the creation seed for Round 1, then a generated seed), reads the session's pinned Pack Version, and stores the seed with each round's board (Mongo `boards[].seed`, required; in-memory copies it). Boards were introduced with a seed, so no stored board lacks one.
- Handler test in `tests/functions/session-board.test.ts`: two sessions on the same pack and Pack Version with no creation seed get identical Round 1 and Round 2 boards for the same transition seed, different boards for a different seed, and no generated seed.
- Contract suite (`tests/adapters/game-session-repository.contract.test.ts`, in-memory and Mongo): a board dealt from a transition seed round-trips its seed on a session with no creation seed.
- `claudPoc/concept-chain/api-catalog.js`: the "seed is ignored" / "no board is dealt" deviations on createGameSession and transitionSessionPhase are removed; notes now describe the seed precedence and reproducibility, and the Board preview / `A.seed` notes say the server deals from the seed but with its own shuffle and the pack's board size, so its board won't match the browser preview. `claudPoc/ConceptChain (API overlay).html` still says "seed ignored" (left for ticket 15).
- Checks: typecheck passes; vitest 877 passed (`--no-file-parallelism`, no intermittent failures); lint 29; boundaries 6; BDD classroom-session-journey 24/24 and solo-session-journey 8/8.
