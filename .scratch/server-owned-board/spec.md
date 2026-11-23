# Spec: Server-owned board (deal the board, return it, check chains against it)

**Status:** ready-for-agent

## Problem Statement

In the paper's classroom game every team plays on the same printed 7×7 sheet of Keyword Cards, and the instructor checks every Concept Chain against that sheet. The platform has no such sheet:

- **The server never deals a board.** A Gameplay Round should start "with a freshly shuffled board grid" (GLOSSARY), but entering Chain-Mapping only changes the phase. `PublicSessionState.activeBoard` is in the OpenAPI contract but is never returned, and the `seed` accepted by create-session and by phase transition is ignored. Any client has to shuffle a board itself. On real devices nothing guarantees that the instructor and every participant see the same grid. The prototype screens (`claudPoc/concept-chain/`) only work because one browser-side mock deals the board for all tabs.
- **The server trusts the words a client claims for a chain.** A chain submission carries a `path` (grid positions) and, outside the contract, a `keywordIds` list. The server checks the shape of the path (at least the minimum number of cells, each touching the previous one, no cell used twice). It then stores `keywordIds` exactly as sent. A buggy or modified client, or two devices that dealt different boards, can record a chain whose words are not next to each other or not on the board at all. Classmates then review it, and it can score.
- **The server does not check that a path stays on the board.** The adjacency check only compares neighbouring steps, so a path such as (50,-3) → (51,-2) → (52,-1) → (53,0) is accepted. The server cannot know the board is 7×7, because it has no board.

The result is that a Classroom Game cannot be played fairly across real devices. Chain review, Instructor Final Rulings and Round Standings all depend on a single shared board that does not exist.

## Solution

The Game Session owns the board, as the instructor owns the printed sheet:

- **Dealt on round entry.** When a session enters a Gameplay Round's Chain-Mapping phase, the server shuffles the Curriculum Pack's Keyword Cards into a `rows × cols` grid (from the pack's `boardConfig`) and stores it on the session as that round's board. Round 1 uses the seed given at session creation, if any. A seed sent with the transition overrides it for the round being entered. Otherwise the server generates a seed. Round 2 gets its own fresh shuffle. The same pack, size and seed always give the same board.
- **Returned everywhere.** `activeBoard` (the board of the active round, with its seed) is in every session-state response: create, join, get-state and transition. Outside a Gameplay Round it is `null`. The board stays the same through that round's Chain-Mapping, Peer-Adjudication and Round-Summary phases.
- **Chains checked against it.** On submission the server rejects any cell outside the round's grid with `CHAIN_TOPOLOGY_INVALID`. It then works out the chain's Keyword Card ids from the path using the stored board. Any `keywordIds` sent by the client are ignored. The recorded chain therefore always names exactly the cards at the tapped positions.

## User Stories

1. As an instructor, I want the server to deal the board when I start a round, so that I don't need to hand out or generate anything.
2. As an instructor, I want every participant to see exactly the board I see, so that I can judge chains against one shared grid.
3. As an instructor, I want Round 2 to use a freshly shuffled board, so that teams can't reuse chains from Round 1.
4. As an instructor, I want the board dealt from the session's Curriculum Pack, so that the game matches the topic I chose.
5. As an instructor, I want to pass a seed at session creation and get the same Round 1 board, so that a board I previewed or used before can be reproduced.
6. As an instructor, I want to optionally pass a seed when I start a round, so that I can replay a known board, for example in a Study RCT.
7. As an instructor running a session without a seed, I want the server to pick a random one, so that each class gets a different board.
8. As an instructor, I want the board to stay fixed through Chain-Mapping, Peer-Adjudication and Round-Summary, so that I can trace any chain on the board it was built on.
9. As an instructor, I want each recorded chain to name the real cards at its positions, so that my Instructor Final Ruling is about the chain the learner actually built.
10. As a participant, I want to receive the board in the session state, so that I can tap Keyword Cards to build chains.
11. As a participant joining mid-round, I want the join response to include the current board, so that I can start playing at once.
12. As a participant reloading my page, I want the same board back, so that my in-progress chain still makes sense.
13. As a participant, I want a clear `CHAIN_TOPOLOGY_INVALID` error if my path leaves the board, so that I know the chain was not recorded.
14. As a participant reviewing classmates, I want each chain's words to be the cards on our shared board, so that my peer vote is fair.
15. As a participant, I want the board removed when the round ends (posttest, survey, completed), so that I'm not shown a stale grid.
16. As a solo-practice learner, I want my rounds dealt by the server too, so that solo practice works like the classroom game.
17. As a study researcher, I want each round's seed and board stored with the session, so that I can reconstruct exactly what every learner saw.
18. As a study researcher, I want recorded chain keywords to be derived by the server, so that the study data can't be corrupted by a client.
19. As a client developer, I want `activeBoard` to follow the documented `BoardGridView` shape (seed, rows, cols, cells with a Keyword Card each), so that I can render it without a separate pack lookup.
20. As a client developer, I want `activeBoard` to be explicitly `null` outside a round, so that I can tell "no board" from "missing data".
21. As a client developer, I want the chain-submission request to need only the path, the narrative and the step rationales, so that I can't send keywords that disagree with the board.
22. As a client developer, I want old clients that still send `keywordIds` to keep working, so that the change is not breaking.
23. As a maintainer, I want dealing to be deterministic for a given pack, size and seed, so that it can be tested and a future board preview can show the real board.
24. As a maintainer, I want the board stored on the Game Session aggregate, so that the chain-recording invariant can check paths against it in one place.
25. As a maintainer, I want boards to round-trip identically through the in-memory and MongoDB repositories, so that tests reflect production.
26. As a maintainer, I want sessions stored before this change to keep loading and running, so that no data migration is needed.
27. As a pack author, I want a pack with fewer Keyword Cards than its board needs to be refused, so that a session can never fail to deal a board mid-class.

## Implementation Decisions

- **Board on the aggregate.** `GameSession` holds one dealt board per Gameplay Round (round 1, round 2). A board records its seed, `rows`, `cols`, and for each cell a snapshot of the Keyword Card placed there (id, labels and the other public card fields). The snapshot means a later change or archive of the pack never alters a running or finished session. The aggregate exposes the active round's board (`null` outside a Gameplay Round) and a lookup of a round's board for persistence.
- **Dealing.** A pure domain service deals a board from a pack's cards, its `boardConfig.rows/cols` and a seed. It shuffles the cards with a seeded pseudo-random generator, takes the first `rows × cols` cards, and fills the grid row by row. If a pack has more cards than cells, the seed decides which cards appear. Following the npm-first dependency policy (ADR-0005), it uses a well-known seeded PRNG package rather than a hand-written generator. The shuffle must be stable: the same inputs give the same board in every environment.
- **When dealing happens.** The phase transition into `round-N:chain-mapping` deals that round's board, inside the existing transition use case and within `GameSessionUpdateRetrier`. The transition loads the session's Curriculum Pack (the pack repository is a new dependency of that use case). Seed precedence for the round being entered: the transition request's `seed`, then (round 1 only) the `seed` given at creation, then a server-generated random seed. The generated seed is chosen once per request, outside the retried command, so a retry deals the same board. The creation seed is stored on the session.
- **Pack capacity.** A Curriculum Pack must have at least `rows × cols` Keyword Cards. The pack validator adds this rule, so registration and validation report it. Session creation also refuses a pack that can't fill its board. The `diabe-teach` pack has 49 cards for 7×7 and passes.
- **Chain recording invariant.** In the aggregate's chain-recording invariant, after the existing phase, round and deadline checks: every path cell must lie inside the round's board (`0 ≤ row < rows`, `0 ≤ col < cols`), or `ChainTopologyInvalidError` is thrown (HTTP 422 `CHAIN_TOPOLOGY_INVALID`). The chain's Keyword Card ids are then taken from the board at each path cell. The same-participant repeat check is unchanged.
- **Client `keywordIds`.** The submission request contract stays as documented (`path`, `narrativeExplanation`, `stepRationales`; no `keywordIds`). A `keywordIds` field sent by an older client is ignored, not rejected. The chain response keeps returning `keywordIds`, now always server-derived.
- **Legacy sessions.** A session stored before this change has no boards. Its `activeBoard` is `null`, and chains submitted to a round without a stored board keep today's behaviour (no bounds check, client `keywordIds` kept). Sessions created after the change always have a board for each round they enter.
- **API contract (OpenAPI).**
  - `PublicSessionState.activeBoard` becomes required, typed `BoardGridView | null`.
  - Document on the create-session and transition `seed` fields what the seed controls (round 1 board / the round being entered).
  - Document 422 `CHAIN_TOPOLOGY_INVALID` for off-board cells on chain submission.
  - Pack validation documents the card-capacity issue.
- **Projection.** The public session-state projector adds `activeBoard` in the documented `BoardGridView` shape: cells is a `rows × cols` array of `{ row, col, card }`.
- **MongoDB persistence.** The game-session document gains a per-round boards field (seed, rows, cols, card snapshots per cell) plus the creation seed. It is optional on load, so legacy documents load with no boards. The existing optimistic version check covers it unchanged.

## Testing Decisions

- **Good tests exercise external behaviour only:** HTTP status, code and body through the function handlers, and the repository contract through its port. They never assert on private aggregate fields or on the PRNG's internals.
- **Seam 1 — function handler tests (agreed with the user):**
  - Create with a `seed`, transition to `round-1:chain-mapping`: the response `activeBoard` is `rows × cols`, carries that seed, and contains each card at most once, all from the pack.
  - The same pack and seed in two separate sessions give identical round 1 boards; different seeds give different boards.
  - `activeBoard` is `null` before round 1 and after the rounds (posttest), and unchanged across chain-mapping, peer-adjudication and round-summary of one round.
  - Round 2 gets a board different from round 1 (with no seeds given) and records its own seed; a transition `seed` reproduces a known board.
  - Get-state and join return the same `activeBoard` as the transition response.
  - A chain whose path leaves the board gets 422 `CHAIN_TOPOLOGY_INVALID`, and nothing is recorded.
  - A chain sent with wrong `keywordIds` is recorded with the cards actually at its path positions.
  - A pack with fewer cards than `rows × cols` is reported by validation and refused by registration and session creation.
- **Seam 2 — repository contract suite (agreed with the user):** both repositories round-trip a session's per-round boards and creation seed. A Mongo-only case loads a legacy document without boards, with `activeBoard` `null`.
- **Seam 3 — Cucumber (agreed with the user):** the classroom journey gains a scenario in which the instructor starts round 1, the instructor and a participant see the same board, and a participant's submitted chain lists the board's cards at the tapped positions.
- **Prior art:** `tests/functions/transition-phase.test.ts`, `tests/functions/submit-chain.test.ts`, `tests/functions/session-phase-deadline.test.ts` (handler tests with `FakeClock`), `tests/adapters/game-session-repository.contract.test.ts`, `tests/integration/features/classroom-session-journey.feature`.

## Out of Scope

- Listing a round's Concept Chains (`GET /sessions/{id}/rounds/{n}/chains`) and the participant roster in session state. They are the next specs of the "playable shared board" effort.
- A board preview endpoint for Game setup. Deterministic dealing makes one possible later.
- Instructor-chosen board size or minimum chain length at session creation. The board size comes from the pack's `boardConfig`. The minimum chain length stays as it is today, and whether to read it from the pack is undecided.
- Honouring the pack's `adjacencyRule` (`orthogonal-4`). Adjacency stays 8-directional, as today.
- A board for the Trial Round (`trial-orientation`). Calibration Examples keep their own boards.
- Peer-vote integrity, the consensus rule, phase extension, and teacher-created packs before a session exists.
- Migrating stored documents. Read-time compatibility is used instead.

## Further Notes

- The problem was found by checking the prototype screens in `claudPoc/concept-chain/` against the API on 2026-11-18. That review's P0 list was: (1) list round chains, (2) roster in state, (3) server-dealt board, (4) peer-vote rules. This spec is item 3.
- The paper (`papers/diabe-teach.pdf`) uses one printed 7×7 sheet per round for all teams, with the instructor's ruling final. This spec reproduces that single source of truth.
- The OpenAPI `SubmitChainRequest` already has no `keywordIds`. Only the handler accepts it, so ignoring it brings the code in line with the contract.
- The prototype mock's dealing (`dealBoard` in `shared.js`: FNV hash of the seed, a mulberry32-style PRNG, Fisher–Yates shuffle) is a reference only. The server is not required to match it bit for bit. A preview that must match the server should come from a server endpoint.
