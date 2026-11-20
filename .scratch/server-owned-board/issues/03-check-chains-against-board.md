# 03: Concept Chains are checked against the round's board

**What to build:** When a participant submits a Concept Chain to a round that has a stored board, the server:
- rejects any path cell outside the grid (`0 ≤ row < rows`, `0 ≤ col < cols`) with 422 `CHAIN_TOPOLOGY_INVALID`, recording nothing;
- works out the chain's Keyword Card ids from the board at each path cell, so the recorded chain always names the cards actually at the tapped positions.

This happens in the Game Session's chain-recording invariant, after the existing phase, round and deadline checks. The same-participant repeat check is unchanged. Any `keywordIds` sent by a client are ignored, not rejected, so older clients keep working. The chain response's `keywordIds` are always server-derived. A session stored before ticket 02 (no board for the round) keeps today's behaviour.

See spec: `.scratch/server-owned-board/spec.md`.

**Blocked by:** 02 (The server deals each Gameplay Round's board and returns it as `activeBoard`)

**Status:** resolved

- [x] Handler test: a path with a cell outside the board gets 422 `CHAIN_TOPOLOGY_INVALID`, and the session's chains are unchanged
- [x] Handler test: a valid path sent with wrong `keywordIds` is recorded, and returned, with the board's cards at those positions
- [x] Handler test: a valid path sent without `keywordIds` is accepted with board-derived ids
- [x] Handler test: in a legacy session with no board for the round, submission behaves as before
- [x] Existing deadline, round, conflict-retry and repeat-chain handler tests still pass
- [x] Cucumber classroom scenario (extending ticket 02's): the participant's submitted chain lists the board's cards at the tapped positions
- [x] OpenAPI documents 422 `CHAIN_TOPOLOGY_INVALID` for off-board cells, and that `keywordIds` in the response are server-derived
- [x] Existing tests, BDD and lint baselines are no worse

## Resolution (2026-11-20)

- `GameSession.addChain` now returns the chain as recorded. After the phase, round and deadline checks, it checks each path cell against the round's board (`ChainTopologyInvalidError`, 422 `CHAIN_TOPOLOGY_INVALID`, nothing recorded) and replaces the chain's keyword ids with the board's card ids at those cells (`ConceptChain.withKeywordIds`). A round without a board (legacy session) keeps the client's ids and has no bounds check. The repeat-chain check is unchanged. `SubmitConceptChainUseCase` returns the chain from `addChain`.
- Contract decision: `keywordIds` stays in `SubmitChainRequest` but is marked `deprecated` and documented as ignored for rounds with a dealt board (kept for legacy sessions). Keeping it in the schema means older clients sending it still pass body validation; the type check (array of strings) still applies. `SubmittedChain.keywordIds` is documented as server-derived, and the 422 response lists the off-board case. Request schemas regenerated.
- Tests: six handler tests in `tests/functions/session-board.test.ts` (off-board row and column, wrong ids, no ids, stored ids, legacy session). The classroom BDD board scenario now submits a chain (with wrong `kw-*` ids) and checks it lists the noted board's cards, then submits an off-board chain and gets 422.
- Checks: typecheck clean; lint 49; boundaries 6; vitest 790 passing; BDD classroom-session-journey (19/19) and solo-session-journey (8/8).
