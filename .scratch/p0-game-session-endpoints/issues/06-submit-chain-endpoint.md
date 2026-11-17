# 06: `POST /api/v1/sessions/{sessionId}/rounds/{n}/chains` - Submit chain

**What to build:** A participant can submit a Concept Chain during the chain-mapping sub-phase. The chain includes grid coordinates (path), derived keyword IDs, a narrative explanation, and optional step rationales. The endpoint validates topological rules (adjacency, minimum length, no cell reuse) and records the chain with status="pending-review".

**Blocked by:** 01-game-session-aggregate, 02-create-session-endpoint, 05-transition-phase-endpoint

**Status:** ready-for-agent

- [ ] `ConceptChain` entity in `src/domain/game-session/` with path, keywordIds, narrative, status, verdict, peerVotes
- [ ] `SubmitConceptChainUseCase` in `src/application/use-cases/`
- [ ] Port definition with `SubmitChainRequest` and `SubmittedChain` DTO
- [ ] HTTP handler `netlify/functions/sessions/submit-chain.ts` with Middy middleware
- [ ] Require `participantToken` for this session
- [ ] Validate session is in `round-{n}:chain-mapping` phase
- [ ] Validate chain topology: adjacent cells (chebyshev-8 or orthogonal-4), no cell reuse, minimum length per boardConfig
- [ ] Error: `PHASE_CLOSED_FOR_SUBMISSIONS` (409) when not in chain-mapping phase
- [ ] Error: `CHAIN_TOPOLOGY_INVALID` (422) when path violates adjacency/length rules
- [ ] Tests covering: valid submission, wrong phase, invalid topology, minimum length violation
