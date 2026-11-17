# 02: The server rejects Concept Chains after the Chain-Mapping deadline

**What to build:** During a timed Chain-Mapping phase, a Concept Chain submitted after `phaseEndsAt` plus a fixed 5-second grace period is rejected with `PHASE_CLOSED_FOR_SUBMISSIONS`. Submissions before the deadline, or within the grace window, are accepted. When the deadline passes the phase does not advance on its own: it stays `chain-mapping` but closed until the instructor transitions to Peer-Adjudication. The instructor can transition out of chain-mapping either before or after the deadline. The OpenAPI chain-submission operation documents the post-deadline rejection.

See spec: `.scratch/session-phase-deadlines/spec.md`.

**Blocked by:** 01 (session-owned phase deadline and clock)

**Status:** ready-for-agent

- [ ] Handler test: a chain submitted before `phaseEndsAt` is accepted
- [ ] Handler test: a chain submitted within 5s after `phaseEndsAt` is accepted
- [ ] Handler test: a chain submitted more than 5s after `phaseEndsAt` returns `PHASE_CLOSED_FOR_SUBMISSIONS`
- [ ] Handler test: the instructor can transition to peer-adjudication both before and after the deadline
- [ ] The current phase remains `chain-mapping` after expiry until the instructor transitions
- [ ] The grace period is a single domain constant
- [ ] OpenAPI documents the `PHASE_CLOSED_FOR_SUBMISSIONS` response on chain submission
- [ ] Cucumber classroom scenario: a timed round where a late chain is rejected (fake clock)
