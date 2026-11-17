# 03: Phases with no timer, run by the instructor

**What to build:** When creating a Game Session, the instructor can set any phase duration in `timerConfig` to `null` to make that phase instructor-driven. For such a phase, `phaseEndsAt` is `null` in every session-state response, no deadline is enforced, and Concept Chain submissions stay open until the instructor transitions the phase. Omitted fields still fall back to defaults, and an explicit `null` must not be overwritten by the default. `null` values round-trip through MongoDB persistence. In OpenAPI, the `SessionTimerConfig` fields become nullable integers, and `PublicSessionState.phaseEndsAt` becomes a nullable date-time that is still required.

See spec: `.scratch/session-phase-deadlines/spec.md`.

**Blocked by:** 02 (enforce Chain-Mapping deadline)

**Status:** ready-for-agent

- [ ] Handler test: creating with `roundMappingSec: null` yields `phaseEndsAt: null` once in chain-mapping (create, join, get-state, transition)
- [ ] Handler test: in an untimed chain-mapping phase, a chain submitted long after the phase started is accepted
- [ ] Handler test: a mixed config (chain-mapping timed, peer-adjudication `null`) behaves per phase
- [ ] Omitted timer fields still use the defaults; explicit `null` survives the merge
- [ ] The MongoDB schema accepts and round-trips `null` timer fields; existing numeric documents remain valid
- [ ] OpenAPI: nullable `SessionTimerConfig` fields and nullable (still required) `phaseEndsAt`
- [ ] Cucumber classroom scenario: an instructor-driven round where submissions are accepted until the instructor transitions
