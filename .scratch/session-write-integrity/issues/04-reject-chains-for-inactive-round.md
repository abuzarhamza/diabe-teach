# 04: Chains sent to a round that isn't running are rejected

**What to build:** A Concept Chain is accepted only when the round number in the request matches the session's active round. Submitting to Round 2 during Round 1's Chain-Mapping (or the reverse) returns `PHASE_CLOSED_FOR_SUBMISSIONS`. The check sits in the aggregate's chain-recording invariant, alongside the existing phase and deadline checks.

See spec: `.scratch/session-write-integrity/spec.md`.

**Blocked by:** None (can start immediately). Sequenced after 02 by the chief of staff only to avoid edit conflicts in the chain-recording code.

**Status:** ready-for-agent

- [ ] Handler test: submitting to the inactive round returns `PHASE_CLOSED_FOR_SUBMISSIONS` and records nothing
- [ ] Handler test: submitting to the active round still succeeds
- [ ] Cucumber classroom scenario: a chain sent to the wrong round is rejected
- [ ] Existing tests, BDD and lint baselines unchanged
