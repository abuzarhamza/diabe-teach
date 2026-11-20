# 03: Learners see classmates' chains from peer-adjudication on

**What to build:** A learner's view of the round's chain list depends on the game's phase.

- **While that round is in chain-mapping, or before it:** a learner sees only their own chains, so nobody can copy a classmate's chain.
- **From that round's peer-adjudication on:** a learner sees every chain in the round, so they can review and vote. This includes the round summary, later rounds, posttest, survey and a completed game.

The teacher keeps seeing everything in every phase. The rule belongs to the Game Session in the domain (for example, "may this participant see classmates' chains in round N?"), not to the handler.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** 01 (Teacher lists a round's Concept Chains)

**Status:** resolved

- [x] Handler test: during Round 1 chain-mapping, a participant sees only their own chains, while the instructor sees all of them
- [x] Handler test: during Round 1 peer-adjudication and round-summary, a participant sees every Round 1 chain
- [x] Handler test: while Round 2 is in chain-mapping, a participant listing Round 1 sees every Round 1 chain, and listing Round 2 sees only their own
- [x] Handler test: after the game is completed, a participant sees every chain of both rounds
- [x] Domain unit test covering the visibility rule for each phase and round
- [x] Cucumber: in the classroom journey, during chain-mapping a second learner sees only their own chains, and after the teacher moves to peer-adjudication they see the first learner's chain
- [x] OpenAPI describes the visibility rule on `listRoundChains`
- [x] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse

## Resolution (2026-11-19)

- Domain: `GameSession.mayParticipantSeeClassmatesChains(roundNumber)` is true from that round's peer-adjudication on, using a new `PHASE_ORDER` list in `game-session.types.ts`. `getChainsForRoundVisibleTo` uses it: the instructor sees every chain in every phase, a participant sees every chain once the rule allows it and only their own before. The use case and handler are unchanged.
- Tests: a domain table test over all 11 phases for both rounds (plus a check that the table covers every phase), and handler tests for Round 1 chain-mapping, peer-adjudication and round-summary, Round 2 chain-mapping (Round 1 all, Round 2 own), and a completed game.
- BDD: the classroom `@chain-listing` scenario now advances to peer-adjudication and checks that Bob sees Alice's chain.
- OpenAPI: `listRoundChains` describes the phase-dependent visibility rule.
- Checks: typecheck passes; vitest 596 passing; BDD `classroom-session-journey` 15/15; lint 92; boundaries 6.
