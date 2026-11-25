# 08: Chain Mapping — build and submit a Concept Chain on the server-dealt board

**Status:** ready-for-agent
**Blocked by:** 05

**What to build:** `domain/chain-path.ts` (Chebyshev-8 adjacency, no duplicate cells, click-last-to-pop, `minChainLength` check, selectable-cells set); `sessionsApi.submitChain`; `views/ChainMappingView.tsx` rendering `state.activeBoard`, highlighting selectable cells, Undo/Clear, `narrativeExplanation` + optional `stepRationales`, list of my submitted chains. Look from `participant.html` board. Instructor sees the board read-only (`teacher.html`).

## Acceptance criteria
- [ ] `tests/web/domain/chain-path.test.ts` covers adjacency at edges/corners, duplicates, backtrack, min length.
- [ ] Non-adjacent cells are disabled; Submit disabled below `minChainLength`.
- [ ] Submitting during the 5 s grace window succeeds; after it, the server error is shown.
