# Decision: timed or instructor-driven phases

**2026-11-17**, agreed with the user in conversation, recorded in [spec](../spec.md).

- Classroom flow (as the user described it): instructor creates the session, teams join, the instructor starts Round 1, teams submit as many Concept Chains as they like within the time, and then time stops.
- At HEAD `b368e85` the timer was display-only: `phaseEndsAt` was returned but never enforced, and join/get/transition ignored the session's own `timerConfig`.
- User's direction: a game can have a time limit set up at creation, or be driven by the teacher using `POST /phase`.
- Design: each `SessionTimerConfig` field may be `null` (instructor-driven). Timed chain-mapping rejects chains after `phaseEndsAt` + 5s grace (`PHASE_CLOSED_FOR_SUBMISSIONS`). The instructor can end a phase early. There is no auto-advance after expiry.
- Related: [SSE deferred](decision-sse-stream-deferred.md), [test seam](decision-test-seam-handlers-plus-clock.md).

## Update 2026-11-17 (as of `63e6099`)
- Timer durations must be 1..86400 seconds or `null`. The 24-hour maximum was chosen by the ticket 03 agent to stop invalid-date 500s, and **awaits user confirmation**.
