# Wiki: session-phase-deadlines

Chief-of-staff memory for the session phase deadline effort. It is a historical record: every claim is dated or cites a commit.

Sources: [spec](../spec.md), [tickets](../issues/).

## Decisions
- [Timed or instructor-driven phases](decision-timed-or-instructor-driven-phases.md): per-phase timer, null means instructor-driven, enforcement with 5s grace, no auto-advance.
- [SSE stream deferred](decision-sse-stream-deferred.md): clients poll session state; `/stream` is out of scope.
- [Test seam: handlers + fake clock](decision-test-seam-handlers-plus-clock.md): the agreed testing approach.

## User preferences
- [Working preferences](user-preferences.md): workflow skills, commit policy.

## Environment
- [Environment improvement backlog](environment-backlog.md): pit-of-success fixes found along the way.
- [Credential in ADR-0003 working copy](incident-adr-0003-credentials.md): excluded from commits, awaiting the user.

## Progress
- [Ticket log](ticket-log.md): status of tickets 01 to 03, with commits.
