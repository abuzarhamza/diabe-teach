# 05: A team cannot submit the same chain twice

**What to build:** A participant (team) cannot record a Concept Chain they have already submitted in the same round. The repeat is rejected with a new 409 `CHAIN_ALREADY_SUBMITTED` error and nothing is recorded. Different participants may still submit the same chain; each copy is accepted, adjudicated and scored independently (behaviour unchanged). Two chains are "the same" when they visit the same board cells in the same order or in exactly reverse order (A→B→C equals C→B→A); the narrative text is ignored. The check is an invariant in the aggregate's chain-recording logic, alongside the phase, deadline and round checks. Because chain submission retries on version conflicts (ticket 02), two identical submissions from one team racing each other result in exactly one recorded chain.

Decided by the user on 2026-11-17: "accept both chains that come from 2 different teams, but do not take the same chain if it is already submitted." The user explicitly declined first-submitter bonus scoring. This rule is not from the study paper, which is silent on duplicates (see wiki `source-paper-game-rules.md`); under the paper's winner rule (longest chain, ties go to the most chains), it protects the tie-break.

See spec: `.scratch/session-write-integrity/spec.md`.

**Blocked by:** 02 (chain submission retries on conflict). Run after 04, which edits the same chain-recording invariant.

**Status:** resolved

- [x] Handler test: a participant re-submitting an identical chain in the same round gets 409 `CHAIN_ALREADY_SUBMITTED`; only one copy is stored
- [x] Handler test: a participant submitting the reverse of their earlier chain is rejected the same way
- [x] Handler test: two different participants submitting the same chain are both accepted
- [x] Handler test: the same participant may submit the same cells again in a different round (each round has a new board)
- [x] Handler test: two identical submissions from one participant, interleaved via the scripted-conflict repository double, record exactly one chain
- [x] OpenAPI: `CHAIN_ALREADY_SUBMITTED` added to `ApiErrorCode` and documented as a 409 on chain submission
- [x] Existing tests, BDD and lint baselines unchanged

**2026-11-17:** The user confirmed: "reverse CANT be submitted by the same team". The reverse-equals-same rule is now a user decision, not a Claude default.

**2026-11-17:** The user decided: a chain rejected in adjudication still blocks the same team from resubmitting the same path (or its reverse) in that round, even with a better narrative. "reject. Keep it simple". This matches the implementation, which has no status filter.

**2026-11-17 (chief of staff):** Merged onto `4fec3d2` (ticket 04). The only conflict was in `submit-chain.test.ts`, where both blocks were kept. The `addChain` order is now phase, round, deadline, then repeat check. Verified after the merge: typecheck passes; vitest 178/178; lint 132 (baseline); boundaries 6 (baseline); BDD 31/31 scenarios, 308 steps.
