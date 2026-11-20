# 02: Listed chains show learner and voter display names

**What to build:** Each chain in the round's chain list carries `participantDisplayName`, the display name of the learner who submitted it, and each of its peer votes carries `voterDisplayName`. The screens can then label chains and votes without a learner roster. A participant who can't be found shows as `"Unknown"`, as standings does. Only the list response changes. Submit and adjudicate keep returning plain `SubmittedChain`. Display names are already public to the class through standings, and no email address or account id appears.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** 01 (Teacher lists a round's Concept Chains)

**Status:** resolved

- [x] Handler test: each listed chain shows the submitting learner's display name
- [x] Handler test: each peer vote shows the voter's display name, and an Instructor Final Ruling comes back with `verdict.isLocked`
- [x] Handler test: a chain whose participant can't be found shows `"Unknown"`
- [x] Handler test: no email address, account id or stack trace appears in the list response
- [x] Submit and adjudicate responses are unchanged (their existing tests still pass untouched)
- [x] OpenAPI adds a `SubmittedChainListItem` schema (the `SubmittedChain` fields plus the two names) and uses it for the list response
- [x] Cucumber: the teacher's list step checks the learner's display name on the chain
- [x] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse

## Resolution (2026-11-19)

`ListRoundChainsUseCase` now maps each listed chain to a `ListedChainDto` with `participantDisplayName` and each peer vote to a `ListedPeerVoteDto` with `voterDisplayName`, looked up with `GameSession.getParticipant` and falling back to `"Unknown"` as standings does. Submit and adjudicate are untouched. OpenAPI adds `SubmittedChainListItem` (`allOf` `SubmittedChain` plus the two names) and the list response uses it. Four new handler tests in `tests/functions/list-round-chains.test.ts`; the classroom BDD list step now also checks the chain's `participantDisplayName`. Checks: typecheck passes, vitest 579 passing, `classroom-session-journey.feature` 15/15 under `dev:local`, lint 92, boundaries 6.
