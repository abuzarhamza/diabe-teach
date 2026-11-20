# 03: Learners see classmates' chains from peer-adjudication on

**What to build:** A learner's view of the round's chain list depends on the game's phase.

- **While that round is in chain-mapping, or before it:** a learner sees only their own chains, so nobody can copy a classmate's chain.
- **From that round's peer-adjudication on:** a learner sees every chain in the round, so they can review and vote. This includes the round summary, later rounds, posttest, survey and a completed game.

The teacher keeps seeing everything in every phase. The rule belongs to the Game Session in the domain (for example, "may this participant see classmates' chains in round N?"), not to the handler.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** 01 (Teacher lists a round's Concept Chains)

**Status:** ready-for-agent

- [ ] Handler test: during Round 1 chain-mapping, a participant sees only their own chains, while the instructor sees all of them
- [ ] Handler test: during Round 1 peer-adjudication and round-summary, a participant sees every Round 1 chain
- [ ] Handler test: while Round 2 is in chain-mapping, a participant listing Round 1 sees every Round 1 chain, and listing Round 2 sees only their own
- [ ] Handler test: after the game is completed, a participant sees every chain of both rounds
- [ ] Domain unit test covering the visibility rule for each phase and round
- [ ] Cucumber: in the classroom journey, during chain-mapping a second learner sees only their own chains, and after the teacher moves to peer-adjudication they see the first learner's chain
- [ ] OpenAPI describes the visibility rule on `listRoundChains`
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
