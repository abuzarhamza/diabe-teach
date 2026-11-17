# Ticket log

- **2026-11-17:** Ticket 01 started in a background agent, then stopped before it made any edits (to commit the existing work first). Restarted on HEAD `c13e4fa`.
- **2026-11-17:** Ticket 01 resolved in `8fe821f`. Verified by the chief of staff: typecheck passes and vitest gives 132/132. The agent reported BDD 29/29 (with `dev:local` running), lint unchanged at the 132-error baseline, and boundaries unchanged at 6. Added `ClockPort`/`SystemClock`/`FakeClock` and a `PublicSessionStateProjector`; `transitionTo(phase, now)`.
- **2026-11-17:** Ticket 02's Cucumber criterion dropped. See [test seam](decision-test-seam-handlers-plus-clock.md).
- **2026-11-17:** Ticket 02 resolved in `b0e1b48`. Verified by the chief of staff: typecheck passes and vitest gives 138/138. The agent reported BDD 29/29 and lint/boundaries unchanged at baseline. `addChain(chain, now)` returns a 409 after `phaseEndsAt` + `SUBMISSION_GRACE_PERIOD_SEC` (5). The time is read before the repository lookup.
- **2026-11-17:** Ticket 03 gained a "durations must be ≥ 1" criterion (see the ticket's Comments).
- **2026-11-17:** Ticket 03 resolved in `63e6099`. Verified by the chief of staff: typecheck passes and vitest gives 156/156. The agent reported BDD 30/30 and lint/boundaries unchanged at baseline. Added nullable per-phase timers, `phaseEndsAt: null`, the 1..86400s bounds, a 400 on unknown or non-object `timerConfig`, `GameSession.rehydrate` (no validation for legacy documents), and a real Mongo repository test on mongodb-memory-server.
- **2026-11-17:** All three tickets resolved. The effort is complete pending user decisions (see the backlog).
