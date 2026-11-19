# 02: The server deals each Gameplay Round's board and returns it as `activeBoard`

**What to build:** When the instructor moves a Game Session into `round-1:chain-mapping` or `round-2:chain-mapping`, the server deals that round's board. It shuffles the session's Curriculum Pack Keyword Cards with a seeded pseudo-random generator (a well-known npm package, per ADR-0005) into the pack's `rows × cols` grid, and stores it on the session per round. Each cell holds a copy of its card, so later pack changes never alter the game.

Seed precedence for the round being entered:
1. the transition request's `seed`;
2. for round 1 only, the `seed` given at session creation (now stored on the session);
3. otherwise a server-generated random seed, chosen once per request outside the retried command so a conflict retry deals the same board.

The same pack, size and seed always give the same board.

Every session-state response (create, join, get-state, transition) carries `activeBoard` in the documented `BoardGridView` shape (`seed`, `rows`, `cols`, `cells[row][col] = { row, col, card }`). It is the active round's board through Chain-Mapping, Peer-Adjudication and Round-Summary, and `null` outside a Gameplay Round. Boards and the creation seed persist in MongoDB. Sessions stored before this change load with no boards (`activeBoard: null`).

See spec: `.scratch/server-owned-board/spec.md`.

**Blocked by:** None (can start immediately; can run in parallel with 01)

**Status:** resolved

- [x] Handler test: create with a `seed`, transition to round 1 chain-mapping → `activeBoard` is `rows × cols`, carries that seed, every card is from the pack and appears at most once
- [x] Handler test: two sessions with the same pack and seed get identical round 1 boards; different seeds give different boards
- [x] Handler test: `activeBoard` is `null` before round 1 and in posttest, and identical across one round's chain-mapping, peer-adjudication and round-summary
- [x] Handler test: round 2 with no seed gets a new board with its own seed; a transition `seed` reproduces a known board
- [x] Handler test: get-state and join return the same `activeBoard` as the transition response
- [x] Handler test: a transition whose write conflicts once is retried and deals the same board (seed stable across retries)
- [x] Repository contract suite (in-memory + Mongo): per-round boards and the creation seed round-trip intact; Mongo-only case: a legacy document with no boards loads with `activeBoard: null`
- [x] Cucumber classroom scenario: after the instructor starts round 1, the instructor and a participant see the same board
- [x] OpenAPI: `activeBoard` is required and nullable (`BoardGridView | null`); the create and transition `seed` fields document what they control
- [x] Existing tests, BDD and lint baselines are no worse
