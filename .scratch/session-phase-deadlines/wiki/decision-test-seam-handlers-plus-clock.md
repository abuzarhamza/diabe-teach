# Decision: test seam is function handlers plus a fake clock

**2026-11-17.** The user chose this option (recommended) during to-spec.

- Primary seam: `tests/functions/*` handler tests built via handler factories with in-memory repositories.
- New seam: `ClockPort` (already named in ADR-0002) with a fake clock, so tests never sleep.
- Secondary seam: the Cucumber classroom journey, using the same fake clock via the test world.
- Related: [timed or instructor-driven phases](decision-timed-or-instructor-driven-phases.md).

## Update 2026-11-17 (supersedes the "secondary seam" bullet for timed scenarios)
- As of `8fe821f`, the Cucumber suite calls a separate `netlify dev` process over HTTP, so the world's `FakeClock` cannot control server time (from the ticket 01 report).
- Decision (chief of staff): no test-only server clock override (that would violate the no-workarounds rule). Timed behaviour is tested only at the handler seam. Ticket 02's Cucumber criterion was dropped. Ticket 03 keeps its untimed Cucumber scenario, which needs no clock.
- Possible future environment fix: an in-process Cucumber harness that calls the handler factories directly. Added to the [backlog](environment-backlog.md).
