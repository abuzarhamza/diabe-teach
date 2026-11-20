# 08: A transition seed deals a reproducible board

**What to build:** When a phase transition into a round's chain-mapping carries `seed`, the board dealer uses it (`seedrandom`), so the same pack, Pack Version and seed always give the same board. The seed is stored with the round's board. With no seed, behaviour is unchanged.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler tests: two sessions on the same pack and version with the same seed get identical boards; different seeds give different boards
- [ ] Game Session repository contract suite: the board seed round-trips
- [ ] The prototype catalog's "seed is ignored" deviation is removed
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
