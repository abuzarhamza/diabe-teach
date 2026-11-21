# Wiki: session-phase-deadlines

Chief-of-staff memory for the session phase deadline effort. It is a historical record: every claim is dated or cites a commit.

Sources: [spec](../spec.md), [tickets](../issues/). Later efforts that reuse this wiki: [server-owned-board](../../server-owned-board/spec.md), [teacher-login](../../teacher-login/spec.md), [list-round-chains](../../list-round-chains/spec.md), [api-hardening](../../api-hardening/spec.md), [api-completion](../../api-completion/spec.md), [structured-logging](../../structured-logging/spec.md), [bdd-non-happy-path-coverage](../../bdd-non-happy-path-coverage/spec.md), [bruno-api-docs](../../bruno-api-docs/spec.md).

## Decisions
- [Timed or instructor-driven phases](decision-timed-or-instructor-driven-phases.md): per-phase timer, null means instructor-driven, enforcement with 5s grace, no auto-advance.
- [SSE stream deferred](decision-sse-stream-deferred.md): clients poll session state; `/stream` is out of scope.
- [Test seam: handlers + fake clock](decision-test-seam-handlers-plus-clock.md): the agreed testing approach.
- [One agent at a time](decision-one-agent-at-a-time.md): no parallel agents or worktrees; checks and BDD features run one after another (2026-11-19).

## Sources
- [Game rules in the Diabe-teach paper](source-paper-game-rules.md): what the study paper does and does not specify.

## User preferences
- [Working preferences](user-preferences.md): workflow skills, commit policy.

## Environment
- [Environment improvement backlog](environment-backlog.md): pit-of-success fixes found along the way.
- [Credential in ADR-0003 working copy](incident-adr-0003-credentials.md): excluded from commits, awaiting the user.
- [API key in the test config](incident-api-key-in-test-config.md): the real API key has been in a public repo since `3e37faf`; rotation recommended (2026-11-19).

## Progress
- [Ticket log](ticket-log.md): status of tickets across efforts (phase deadlines, server-owned board, teacher login, list round chains), with commits.
