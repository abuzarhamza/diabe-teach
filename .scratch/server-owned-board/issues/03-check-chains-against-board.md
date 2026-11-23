# 03: Concept Chains are checked against the round's board

**What to build:** When a participant submits a Concept Chain to a round that has a stored board, the server:
- rejects any path cell outside the grid (`0 ≤ row < rows`, `0 ≤ col < cols`) with 422 `CHAIN_TOPOLOGY_INVALID`, recording nothing;
- works out the chain's Keyword Card ids from the board at each path cell, so the recorded chain always names the cards actually at the tapped positions.

This happens in the Game Session's chain-recording invariant, after the existing phase, round and deadline checks. The same-participant repeat check is unchanged. Any `keywordIds` sent by a client are ignored, not rejected, so older clients keep working. The chain response's `keywordIds` are always server-derived. A session stored before ticket 02 (no board for the round) keeps today's behaviour.

See spec: `.scratch/server-owned-board/spec.md`.

**Blocked by:** 02 (The server deals each Gameplay Round's board and returns it as `activeBoard`)

**Status:** ready-for-agent

- [ ] Handler test: a path with a cell outside the board gets 422 `CHAIN_TOPOLOGY_INVALID`, and the session's chains are unchanged
- [ ] Handler test: a valid path sent with wrong `keywordIds` is recorded, and returned, with the board's cards at those positions
- [ ] Handler test: a valid path sent without `keywordIds` is accepted with board-derived ids
- [ ] Handler test: in a legacy session with no board for the round, submission behaves as before
- [ ] Existing deadline, round, conflict-retry and repeat-chain handler tests still pass
- [ ] Cucumber classroom scenario (extending ticket 02's): the participant's submitted chain lists the board's cards at the tapped positions
- [ ] OpenAPI documents 422 `CHAIN_TOPOLOGY_INVALID` for off-board cells, and that `keywordIds` in the response are server-derived
- [ ] Existing tests, BDD and lint baselines are no worse
