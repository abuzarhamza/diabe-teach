# Spec: Session Phase Deadlines (timed or instructor-driven phases)

**Status:** ready-for-agent

## Problem Statement

In a Classroom Game the instructor creates a Game Session, teams join with the room code, and the instructor starts Round 1. During the Chain-Mapping phase teams submit as many Concept Chains as they can before time runs out.

Today the timer only exists on screen:

- The Game Session already accepts a `timerConfig` at creation and returns a `phaseEndsAt`, but the server never enforces it. A team whose countdown reads 0:00 can keep submitting Concept Chains until the instructor manually advances the phase. Teams that keep going get more time than teams that stopped, which is unfair in a scored game (and invalidates comparisons in a Study RCT).
- A custom `timerConfig` is only respected in the create-session response. Joining, reading session state, and transitioning phases all compute `phaseEndsAt` from the global defaults, so participants see a different deadline from the one the instructor configured.
- There is no way to run a phase without a timer. Some instructors want to drive pacing themselves ("we'll move on when everyone is done"), but every phase always gets a deadline from the defaults.

## Solution

Each phase of a Game Session is either **timed** or **instructor-driven**, decided when the session is created:

- **Timed phase**: the phase duration comes from the session's `timerConfig` (falling back to defaults). `phaseEndsAt` is derived from the session's own configuration everywhere it is returned. During a Chain-Mapping phase, the server rejects Concept Chain submissions after `phaseEndsAt` plus a short grace period, with `PHASE_CLOSED_FOR_SUBMISSIONS`. The instructor can still end the phase early with a phase transition.
- **Instructor-driven phase**: the instructor sets that phase's duration to `null`. `phaseEndsAt` is `null`, clients show no countdown, and submissions stay open until the instructor transitions the phase.

After a timed Chain-Mapping phase expires, the phase does not advance automatically. It stays `chain-mapping` but closed for submissions until the instructor transitions to Peer-Adjudication. No server-side scheduler or real-time push is needed; clients poll session state and run their countdown locally from `phaseEndsAt`.

## User Stories

1. As an instructor, I want to set how long the Chain-Mapping phase lasts when I create a Game Session, so that the round matches my class period.
2. As an instructor, I want sensible default durations when I don't configure a timer, so that I can start a session quickly.
3. As an instructor, I want to mark a phase as having no timer, so that I can move the class on when I judge they are ready.
4. As an instructor, I want to choose timed or untimed separately per phase, so that I can, for example, time Chain-Mapping but run Peer-Adjudication at my own pace.
5. As an instructor, I want the server to stop accepting Concept Chains when the Chain-Mapping time is up, so that no team gets extra time.
6. As an instructor, I want to end a timed Chain-Mapping phase early, so that we can move on when every team has finished.
7. As an instructor, I want the session to wait for me after time runs out rather than jumping ahead, so that I control when Peer-Adjudication starts.
8. As an instructor, I want the deadline I configured to be the one every participant sees, so that the class has a single, consistent countdown.
9. As a participant, I want to see when the current phase ends, so that I can pace my chain discovery.
10. As a participant joining mid-phase, I want to receive the correct remaining time, so that my countdown matches everyone else's.
11. As a participant, I want a chain I submitted at the last second to be accepted despite network delay, so that I am not penalised for a slow connection.
12. As a participant, I want a clear "phase closed" error if I submit after the deadline, so that I understand why my chain was not recorded.
13. As a participant in an untimed phase, I want no countdown shown, so that I am not confused by a meaningless timer.
14. As a participant in an untimed phase, I want my submissions accepted until the instructor moves on, so that the instructor's pacing is respected.
15. As a solo-practice learner, I want the default timers to apply to my session, so that solo practice mirrors classroom pacing.
16. As a study researcher running a Study RCT, I want the cutoff enforced server-side, so that time-on-task is identical across teams and arms.
17. As a client developer, I want `phaseEndsAt` in every session-state response (create, join, get, transition), so that I can render the countdown from any of them.
18. As a client developer, I want `phaseEndsAt` to be explicitly `null` for untimed phases, so that I can tell "no timer" from "missing data".
19. As a client developer, I want the OpenAPI contract to document nullable phase durations and a nullable `phaseEndsAt`, so that generated clients and validators accept them.
20. As a maintainer, I want the phase deadline computed in one place on the Game Session aggregate, so that the four use cases cannot drift apart again.
21. As a maintainer, I want time to be injectable, so that deadline behaviour can be tested without sleeping.

## Implementation Decisions

- **Deadline ownership moves into the `GameSession` aggregate.** The aggregate already stores its merged `timerConfig` and `phaseStartedAt`. It gains a derived `phaseEndsAt` (a `Date`, or `null` when the current phase is untimed or has no duration, e.g. `completed`). The per-phase duration lookup currently duplicated as a private helper in the create, join, get-state and transition use cases is removed; those use cases project `session.phaseEndsAt`.
- **Nullable durations.** Each field of `SessionTimerConfig` becomes `number | null`. `null` means "instructor-driven" for that phase. An omitted field still falls back to `DEFAULT_TIMER_CONFIG`. Explicit `null` must survive the merge with defaults (it must not be replaced by the default).
- **Deadline enforcement on Concept Chain submission.** Adding a Concept Chain checks, in addition to the existing "must be in a chain-mapping phase" invariant, that `now <= phaseEndsAt + grace` when `phaseEndsAt` is not null. A violation throws the existing `PhaseClosedForSubmissionsError`, which the HTTP layer already maps to `PHASE_CLOSED_FOR_SUBMISSIONS`.
- **Grace period.** A fixed domain constant of 5 seconds. It is not configurable per session.
- **No auto-advance.** An expired timed phase does not transition automatically. Phase transitions remain instructor-only via the existing transition endpoint, which remains callable before or after the deadline.
- **Clock seam.** Introduce a `ClockPort` outbound port (already named in ADR-0002) with a single "now" operation, a system-clock adapter for production, and a controllable fake for tests. The use cases that start phases or accept submissions take the clock as a dependency and pass "now" into the aggregate. The aggregate does not read the wall clock itself for deadline decisions. Handler factories accept an optional clock in their dependencies, defaulting to the system clock via the composition root.
- **API contract changes (OpenAPI):**
  - `SessionTimerConfig` fields become `type: [integer, "null"]`, keeping their current defaults.
  - `PublicSessionState.phaseEndsAt` becomes `type: [string, "null"]`, `format: date-time`, and stays required.
  - The chain-submission operation documents the `PHASE_CLOSED_FOR_SUBMISSIONS` response for submissions after the deadline.
- **Persistence.** The MongoDB game-session schema must allow `null` for each timer field and round-trip it faithfully. Existing documents with numeric values remain valid.
- **Scope of enforcement.** Only Concept Chain submission is deadline-enforced in this spec. Other timed phases (Pretest, Posttest, Feedback Survey, Peer-Adjudication) expose `phaseEndsAt` but are not yet enforced.

## Testing Decisions

- **Good tests exercise external behaviour only:** HTTP status, error code and response body through the function handlers, never private aggregate fields or helper methods.
- **Primary seam: Netlify function handler tests** (the existing per-endpoint handler tests that build a handler via its factory with the in-memory game-session repository and fake capability token adapter), extended with a fake `ClockPort`. Cover:
  - A chain submitted before the deadline is accepted.
  - A chain submitted within the grace window is accepted.
  - A chain submitted after deadline plus grace is rejected with `PHASE_CLOSED_FOR_SUBMISSIONS`.
  - With `roundMappingSec: null`, `phaseEndsAt` is `null`, and a chain submitted long after the phase started is accepted.
  - A custom `roundMappingSec` is reflected in `phaseEndsAt` from create, join, get-state and transition alike (regression for the ignored-config bug).
  - The instructor can transition out of chain-mapping both before and after the deadline.
- **Secondary seam: Cucumber classroom journey** (the existing classroom-session feature backed by mongodb-memory-server) gains one timed-round scenario and one instructor-driven-round scenario using the same fake clock via the test world. This also proves that `null` timer values round-trip through MongoDB.
- **Prior art:** the existing submit-chain and transition-phase handler tests; the classroom-session-journey feature and its step definitions.
- Tests do not sleep or depend on wall-clock time.

## Out of Scope

- Real-time push (`GET /sessions/{sessionId}/stream` SSE). Clients poll session state; SSE remains deferred.
- Automatic, server-driven phase advancement when a deadline passes.
- Pausing, extending or resetting a running phase timer mid-phase.
- Deadline enforcement for assessment, survey and peer-adjudication submissions.
- Making the grace period configurable.
- Per-Curriculum-Pack default timer configuration.

## Further Notes

- The ignored-config bug (join, get-state and transition using global defaults) is user-visible today and is fixed as a side effect of moving deadline ownership into the aggregate.
- If phase pause or extension is added later, `phaseEndsAt` should become stored state rather than derived. Keeping it derived on the aggregate makes that change local.
