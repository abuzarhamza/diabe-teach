# 02: Listed chains show learner and voter display names

**What to build:** Each chain in the round's chain list carries `participantDisplayName`, the display name of the learner who submitted it, and each of its peer votes carries `voterDisplayName`. The screens can then label chains and votes without a learner roster. A participant who can't be found shows as `"Unknown"`, as standings does. Only the list response changes. Submit and adjudicate keep returning plain `SubmittedChain`. Display names are already public to the class through standings, and no email address or account id appears.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** 01 (Teacher lists a round's Concept Chains)

**Status:** ready-for-agent

- [ ] Handler test: each listed chain shows the submitting learner's display name
- [ ] Handler test: each peer vote shows the voter's display name, and an Instructor Final Ruling comes back with `verdict.isLocked`
- [ ] Handler test: a chain whose participant can't be found shows `"Unknown"`
- [ ] Handler test: no email address, account id or stack trace appears in the list response
- [ ] Submit and adjudicate responses are unchanged (their existing tests still pass untouched)
- [ ] OpenAPI adds a `SubmittedChainListItem` schema (the `SubmittedChain` fields plus the two names) and uses it for the list response
- [ ] Cucumber: the teacher's list step checks the learner's display name on the chain
- [ ] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse
