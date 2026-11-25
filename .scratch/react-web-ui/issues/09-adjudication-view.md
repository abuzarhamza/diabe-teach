# 09: Peer Adjudication and Instructor Final Ruling

**Status:** ready-for-agent
**Blocked by:** 08

**What to build:** `sessionsApi.listRoundChains` (polled 2 s), `adjudicateChain`; `views/AdjudicationView.tsx` — learners cast `peer-approve`/`peer-reject` on others' chains; instructor issues `instructor-approve`/`instructor-reject` with `qualityScore` 1..10 + feedback, which locks the chain.

## Acceptance criteria
- [ ] Learners cannot vote on their own chain (UI hides it; server error still surfaced).
- [ ] Locked chains show the ruling and disable further votes.
