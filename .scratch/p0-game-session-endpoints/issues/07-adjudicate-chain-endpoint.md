# 07: `POST /api/v1/sessions/{sessionId}/rounds/{n}/chains/{chainId}/adjudicate` - Adjudicate chain

**What to build:** Cast a peer vote (approve/challenge), trigger AI evaluation, or record an Instructor Final Ruling on a submitted Concept Chain. Peer votes accumulate; AI evaluation sets a verdict with quality score and transition evaluations; Instructor Final Ruling locks the verdict permanently. Returns the updated chain with latest votes and adjudication verdict.

**Blocked by:** 01-game-session-aggregate, 02-create-session-endpoint, 06-submit-chain-endpoint

**Status:** ready-for-agent

- [ ] `AdjudicateConceptChainUseCase` in `src/application/use-cases/`
- [ ] Port definition with discriminated union `AdjudicateChainRequest` (peer-approve | peer-challenge | ai-evaluate | instructor-approve | instructor-reject)
- [ ] HTTP handler `netlify/functions/sessions/adjudicate-chain.ts` with Middy middleware
- [ ] Peer vote: record `PeerVoteRecord` with voterParticipantId, decision, optional comment
- [ ] AI evaluate: (stub for now) set verdict with quality score and transition evaluations
- [ ] Instructor ruling: set verdict with `isLocked: true`, feedback, optional quality score
- [ ] Error: `CHAIN_NOT_FOUND` (404) when chainId doesn't exist
- [ ] Error: `ADJUDICATION_LOCKED_BY_INSTRUCTOR` (409) when trying to modify locked verdict
- [ ] Error: `FORBIDDEN_ROLE` (403) when non-instructor attempts instructor actions
- [ ] Tests covering: peer vote, instructor approve, instructor reject, locked chain rejection
