# 03: Learner screens coverage (steps B, C, E, F, H) and persistence across pages

**What to build:** The join form, lobby and learner game screen get the toggle and tags: join form (B `joinGameSession`, card notes keeping `participantId` + `participantToken`); lobby classmates, timeline and phase pill (C, classmates pointing to the `participant.joined` stream event); learner board, timer, phase pill, classmates' chains and My chains (C); chain builder + "Submit chain" (E `submitConceptChain`); Approve/Challenge (F `adjudicateConceptChain` peer votes); round results (H). The overlay's on/off state is kept in tab-scoped storage so it survives join → lobby → game redirects.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each element listed above has the right letter, actor badge and read/write outline
- [ ] Submit card lists 409 `PHASE_CLOSED_FOR_SUBMISSIONS` and 422 `CHAIN_TOPOLOGY_INVALID`
- [ ] Peer vote card notes learners can't vote on their own chain (403) or a locked chain (409)
- [ ] "Not you? Join again" is untagged
- [ ] Turning the overlay on in the join form keeps it on in the lobby and the game screen after automatic redirects
- [ ] Drift test covers every non-missing operation used on these screens and passes
