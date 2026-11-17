# 01: Phase deadline comes from the session's own timer config, with an injectable clock

**What to build:** Every response that carries Game Session state (create, join, get state, transition phase) returns the same `phaseEndsAt`, computed from the session's own `timerConfig`. Today only create respects a custom `timerConfig`; join, get state and transition use the global defaults, so participants see a different deadline from the one the instructor configured. The Game Session aggregate becomes the single owner of the deadline calculation, and the per-use-case duplicate duration lookups are removed. Introduce a `ClockPort` (named in ADR-0002) with a system-clock adapter and a controllable fake. Handler factories accept an optional clock, defaulting to the system clock through the composition root. The Cucumber test world can inject the fake clock. Behaviour for default-timer sessions is unchanged.

See spec: `.scratch/session-phase-deadlines/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A session created with a custom `roundMappingSec` returns a `phaseEndsAt` consistent with that value from create, join, get-state and transition (handler tests)
- [ ] The deadline calculation lives on the Game Session aggregate; no use case computes phase durations itself
- [ ] `ClockPort` exists with a system adapter and a fake; handler factories accept an optional clock
- [ ] Phase start times use the injected clock, so tests can assert exact `phaseStartedAt` and `phaseEndsAt` values without sleeping
- [ ] The Cucumber world supports a fake clock; the existing classroom and solo journeys still pass
- [ ] Typecheck and the full test suite are green
