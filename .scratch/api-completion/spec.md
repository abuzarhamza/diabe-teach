# Spec: Finish the API for the in-game screens, and clear the API backlog

**Status:** ready-for-agent

## Problem Statement

The teacher-login, list-round-chains and api-hardening efforts finished on 2026-11-19 (last commit `b042157`). The API can now sign in teachers, manage the shared pack library, run a Game Session, list a round's Concept Chains, and return truthful errors. Several gaps still stop the prototype's in-game screens from moving off their browser-only fake, and stop the API from being trusted as the contract:

- **Missing routes the screens need:**
  - The teacher's roster and the learner's classmate list have no data, because session state returns only `participantCount`.
  - The teacher can't add a minute to a running phase, can't end a session early, and a learner can't leave.
  - Session analytics (`getSessionAnalytics`) is in the contract but has no handler, so the end-of-game report can't be shown.
- **Gameplay rules that don't match the Curriculum Pack or the contract:**
  - A chain's keyword ids still come from the client rather than the stored board (server-owned-board 03 is open).
  - The minimum chain length is fixed at 4 cells instead of coming from the pack.
  - `seed` on a phase transition is ignored, so a Study RCT can't reproduce a board.
- **Contract drift:**
  - `validateCurriculumPack` returns `{ valid, errors, warnings }` while the contract says `{ valid, issues }`.
  - Session state and standings require a token that the contract doesn't declare.
  - The stream route is documented as if it existed.
  - `jump` on a transition can only target the next phase.
- **Platform backlog:**
  - Session and account routes still have forced `netlify.toml` redirects. These caused the chains-path routing bug, and the wrapper made them unnecessary in `fac7912`.
  - There's no request size limit.
  - The sign-in failure counter can race.
  - The Mongo session schema keeps its own copy of the phase list.
  - The in-memory session repository's copy must be extended by hand for every new field.
  - Unused middy packages remain, `accountRepo` is optional in the types and forced with `!`, and no Node version is pinned.
- **Small leftovers:**
  - The prototype's fake screens store `stepRationales` as objects.
  - One BDD step expects an obsolete chain status.
  - The API overlay page describes the old register error body.
  - The prototype catalog still says the board isn't returned.
  - About 40 old tickets under `.scratch/` still say ready-for-agent for finished work.

## Solution

- **Session state lists the learners.** Each entry has id, display name, join time and whether they left. Screens get the roster from the state they already poll, with no extra route.
- **Three instructor and learner actions:**
  - the teacher **extends** the current timed phase by a number of seconds;
  - the teacher **ends** the session early (it goes to `completed`);
  - a learner **leaves** (they stay in the records, but can no longer act).
- **Analytics are served** as the contract describes:
  - a learner gets their own metacognitive report plus the cohort summary;
  - the teacher gets the cohort summary.
- **Gameplay follows the Curriculum Pack:**
  - keyword ids come from the stored board (server-owned-board 03);
  - the minimum chain length comes from the pack's `boardConfig`;
  - a transition's `seed` deals a reproducible board.
- **The contract matches the code** for every point listed above. Where the code is right, `openapi.yaml` changes. The generated request schemas are regenerated.
- **The platform backlog is cleared.** Every remaining item is fixed, so a new route gets the right behaviour by default.
- **The leftovers are tidied,** and the tracker shows only open work.

Live updates stay on polling. The stream route remains deferred (see the wiki decision "SSE stream deferred").

## User Stories

1. As a teacher, I want the session state to list every learner who joined, with their display name, so that my roster shows who is in the class.
2. As a teacher, I want to see when each learner joined, so that I can tell latecomers apart.
3. As a teacher, I want to see which learners left, so that I don't wait for them.
4. As a learner, I want to see my classmates' names, so that the lobby feels like a shared room.
5. As a teacher, I want `participantCount` to count only learners who haven't left, so that the number on screen matches the room.
6. As a teacher, I want to add time to the running phase, so that the class can finish a good discussion.
7. As a teacher, I want extending a phase to push back its deadline for chain submissions too, so that learners can still submit in the added time.
8. As a teacher, I want extending an untimed (instructor-driven) phase to be refused clearly, so that I understand it has no timer.
9. As a teacher, I want an extension to be limited to a sensible amount (1 to 600 seconds per call), so that a typo can't add hours.
10. As a teacher, I want to extend a phase whose timer just ran out, so that I can reopen it without moving to the next phase.
11. As a teacher, I want to end the session early from any phase, so that I can stop when class time is up.
12. As a teacher, I want ending an already completed session to be refused with a clear 409, so that a double click is harmless.
13. As a learner, I want my screen to see that the session has ended, so that it can show the final results.
14. As a learner, I want to leave a session, so that I can exit cleanly on a shared device.
15. As a learner who has left, I want my chains and votes kept, so that the round's results stay fair.
16. As a teacher, I want a learner who left to be unable to submit chains or vote, so that a stale tab can't act for them.
17. As a learner, I want leaving twice to be harmless, so that a double click doesn't error.
18. As a teacher, I want only learners to be able to leave, and only I to be able to extend or end, so that roles stay clear.
19. As a learner, I want my end-of-game report to show my pretest and posttest scores, my knowledge gain and my reduction in wrong guesses, so that I see what I learned.
20. As a learner, I want my report to show how broadly my approved chains crossed Semantic Domains (chain diversity), so that I see whether I connected ideas.
21. As a learner, I want my report to list the Keyword Cards I never used, so that I know what to revise.
22. As a teacher, I want a cohort summary: participant count, pretest and posttest means, posttest wrong-guess and "I don't know" means, and mean chain diversity, so that I can judge the session.
23. As a teacher, I want a board neglect heatmap, so that I can see which cards and positions the class overlooked.
24. As a learner, I want analytics to work before the posttest, showing what's available and leaving missing parts empty, so that the screen doesn't break mid-game.
25. As a learner, I want my chain's keywords taken from the board the server dealt, so that what I tapped is what is recorded.
26. As a learner, I want a chain path that leaves the grid to be refused, so that a bad tap can't record a broken chain.
27. As a curriculum author, I want the minimum chain length to come from my pack's `boardConfig`, so that easier packs can allow shorter chains.
28. As a researcher running a Study RCT, I want a transition `seed` to deal the same board every time, so that study arms are comparable.
29. As a client developer, I want `validateCurriculumPack`'s documented response to match what it returns, so that I can render the report.
30. As a client developer, I want session state and standings to declare the Capability Token they require, so that the generated client sends it.
31. As a client developer, I want the stream route marked as not implemented, so that nobody builds against it.
32. As a client developer, I want `jump` documented as moving only to the next phase, and ending early to use the end route, so that I don't send impossible jumps.
33. As a developer, I want no forced `netlify.toml` redirects on any API route, so that every function routes by its own `config.path` and `method`.
34. As an operator, I want request bodies larger than a fixed limit refused with 413, so that a huge payload can't tie up a function.
35. As a teacher, I want five fast wrong passwords to lock my account exactly once, even when they arrive at the same time, so that the lock can't be dodged by racing.
36. As a developer, I want the Mongo session schema's phase list to come from the domain's `PHASE_ORDER`, so that adding a phase is a one-place change.
37. As a developer, I want the in-memory session repository to copy sessions through the same snapshot the domain uses, so that new fields never get dropped silently.
38. As a developer, I want `accountRepo` required where it's used, so that the code never forces it with `!`.
39. As a developer, I want only the middy packages we use installed, so that the dependency list tells the truth.
40. As a developer, I want the Node version pinned for local, CI and Netlify, so that everyone runs the same runtime.
41. As a developer, I want the prototype's fake screens, BDD steps, overlay page and catalog to match the API, so that nothing teaches the old shapes.
42. As an agent picking work, I want finished tickets marked resolved, so that I never redo finished work.

## Implementation Decisions

**Roster**
- `PublicSessionState` gains `participants`, an array of `{ participantId, displayName, joinedAt, leftAt | null }`.
- Instructors and participants both receive it. Display names are already public to the class through standings. No email or account id is included.
- `participantCount` counts participants with `leftAt === null`.
- No new route.

**Extend phase**
- `POST /api/v1/sessions/{sessionId}/phase/extend` with body `{ seconds }` (an integer, 1 to 600). Instructor Capability Token only.
- The new deadline is `max(phaseEndsAt, now) + seconds`. This reopens chain submissions if the grace period had passed.
- Refusals:
  - an instructor-driven phase (no `phaseEndsAt`) → 409 `PHASE_HAS_NO_TIMER`;
  - a `completed` session → 409 `SESSION_ALREADY_COMPLETED`.
- Response: the updated public state.
- The rule is a Game Session method; the route is a new function.

**End session**
- `POST /api/v1/sessions/{sessionId}/end`. Instructor only.
- Moves from any phase to `completed`, with no deadline. This is the one exception to "next phase only", and it lives in the domain as a separate method, not as a `jump`.
- Ending an already completed session → 409 `SESSION_ALREADY_COMPLETED`.

**Leave session**
- `POST /api/v1/sessions/{sessionId}/leave`. Participant only.
- Sets that participant's `leftAt`. Calling it again is a no-op 200.
- A participant who has left gets 403 `PARTICIPANT_HAS_LEFT` on submit-chain, peer votes, assessments and the survey.
- Read routes still work for them.
- Their chains, votes and standings are kept.
- `leftAt` is stored in Mongo; legacy participants load with `null`.

**Analytics**
- `GET /api/v1/sessions/{sessionId}/analytics`, as in the contract (`SessionAnalyticsResponse`).
- An instructor gets `{ role: "instructor", cohortSummary }`. A participant also gets `participantReport` for themselves.
- The calculations live in an application or domain analytics service, computed from the stored session:
  - **Knowledge gain** = posttest % − pretest %.
  - **Guessing reduction** = pretest wrong-guess % − posttest wrong-guess %.
  - **Chain diversity index** = distinct Semantic Domains crossed by the learner's approved chains ÷ the pack's Semantic Domain count.
  - **Neglected keyword ids** = cards on the learner's dealt boards that none of their submitted chains used.
  - **Board neglect heatmap** = for each grid coordinate, how many learners never used it, across rounds with a stored board.
- Missing inputs, such as no posttest yet, give `null` fields rather than errors.
- Pack data is read through the session's pinned Pack Version (`SessionPackLoader`).
- If the contract's report shapes can't be filled as written, the contract is corrected, and each change is listed in the ticket.

**Gameplay**
- Server-owned-board 03 is carried as-is (`.scratch/server-owned-board/issues/03-check-chains-against-board.md`).
- The minimum chain length is the pack's `boardConfig` minimum (rename it if the field has another name). It falls back to 4 cells when the pack doesn't set one. Too-short chains remain 422 `CHAIN_TOPOLOGY_INVALID`, while under 2 cells stays a schema 400.
- **Transition `seed`:** when present on a transition into a round's chain-mapping, the board dealer uses it (`seedrandom` is already a dependency), so the same pack, version and seed always give the same board. The seed is stored with the round's board. Without a seed, behaviour is unchanged.

**Contract alignment** (`openapi.yaml`, then `npm run generate:request-schemas`)
- `validateCurriculumPack` documents the real `{ valid, errors, warnings }` with `{ path, code, message }` items. The 400 for a pack with a missing or wrongly typed field, from `b042157`, stays. It's documented, and the user can still override it.
- `getGameSessionState` and `getRoundStandings` declare `BearerAuth` and their 401/403.
- `streamGameSessionEvents` is marked as not implemented (`x-implemented: false`, plus a description pointing to polling). It isn't removed, so the design is kept.
- `jump` is documented as next-phase only; ending early uses the end route.

**Platform**
- **Redirects:** remove every remaining `[[redirects]]` for `/api/v1/sessions*` and `/api/v1/accounts*`. Every function routes by `config.path` + `method`. Run every BDD feature to prove it.
- **Size limit:** a check in `createApiHandler`, before the JSON parse, refuses any body over 256 KB with 413 `PAYLOAD_TOO_LARGE` in the standard error body. Auth still runs first.
- **Sign-in counter:** use an atomic update on the account record (Mongo `$inc` with a conditional lock), or the optimistic-concurrency pattern already used for Game Sessions. Five concurrent wrong attempts give exactly one lock.
- **Phase list:** the Mongo session schema's phase enum is built from `PHASE_ORDER`.
- **In-memory copy:** the in-memory session repository copies through the domain's snapshot/restore (the same path as Mongo), not a hand-written field list.
- **Typing and dependencies:**
  - `accountRepo` is required in the dependency types of the handlers that use it, and `AppRuntime` always provides it;
  - unused `@middy/http-cors`, `@middy/http-header-normalizer` and `@middy/http-security-headers` are removed after confirming nothing imports them;
  - Node is pinned in `.nvmrc`, `engines` and `netlify.toml` `NODE_VERSION`, all with the same major version, matching what runs today.

**Leftovers**
- The fake screens' `stepRationales` become strings.
- The obsolete "chain should be finalized" BDD step is deleted.
- The register error body in `claudPoc/ConceptChain (API overlay).html` is fixed.
- The catalog's `activeBoard` and board notes are updated.
- Every `.scratch/*/issues/*.md` whose work is verifiably done gets `Status: resolved`, with a one-line dated pointer to the commit or route that did it. Unverifiable ones are listed for the user, not guessed.

## Testing Decisions

- **What a good test checks:** external behaviour only, meaning status and body for a given token, body and session state.
- **Handler tests** (the in-memory repository, a real token issuer and the fake clock) cover:
  - **Roster:** names, join times, `leftAt`, and `participantCount` after a learner leaves.
  - **Extend:** a timed phase is extended and the submission window reopens; untimed → 409; completed → 409; out-of-range seconds → 400; a participant → 403.
  - **End:** works from every phase; twice → 409; a participant → 403.
  - **Leave:** a learner who left gets 403 on every write; leave twice → 200; the instructor can't leave → 403; chains are kept.
  - **Analytics:** each metric against a hand-computed fixture; nulls before the posttest; instructor versus participant shapes.
  - **Seed:** the same seed gives the same board, and different seeds give different boards.
  - **Minimum length:** comes from the pack, with the fallback to 4.
  - **Size limit:** an over-limit body → 413, and an over-limit body with no token → 401.
  - **Sign-in race:** five concurrent wrong passwords give one lock.
- **Repository contract suites** (in-memory and Mongo): `leftAt` and the board seed round-trip; a legacy participant loads with `leftAt = null`; the in-memory copy keeps every field (a test adds a field to a fixture and expects it to survive).
- **BDD** (`npm run test:bdd <feature>`, one feature per process, against `dev:local`):
  - the classroom journey: the roster shows a joined learner; the teacher extends a phase, then ends the session; a learner leaves and can no longer submit;
  - the assessment journey: fetches analytics after the posttest;
  - every feature is run after the redirect removal.
- **Contract:** the generated schemas are regenerated, and the staleness test plus the catalog drift tests pass.
- **Prior art:** `tests/functions/list-round-chains.test.ts`, `session-phase-deadline.test.ts`, `session-board.test.ts`, `instructor-accounts.test.ts`, `bad-request-body.test.ts`, the repository contract suites, and `classroom-session-journey.feature`.
- **Baselines:** typecheck passes, vitest (`--no-file-parallelism`) is green, lint is no worse than 49, and boundaries no worse than 6.

## Out of Scope

- The stream route (SSE) or any push channel. Screens poll.
- Wiring the prototype screens to the real in-game API. That's a separate effort, which this spec unblocks.
- Password reset, email verification and university-email checks (ADR-0007).
- Rewriting git history to remove the old API key. The user must rotate the key.
- Pagination, and query filters on lists.

## Further Notes

- **Sources:**
  - the 2026-11-19 screen-by-screen review;
  - the environment backlog `.scratch/session-phase-deadlines/wiki/environment-backlog.md`;
  - the ticket log entries for `def5537`, `c100d42`, `fac7912`, `a5a5204`, `4839cee` and `b042157`.
- **Glossary terms used:** Game Session, Gameplay Round, Concept Chain, Curriculum Pack, Pack Version, Semantic Domain, Keyword Card, Capability Token, Instructor Account.
- **Related ADRs:** ADR-0005 (npm-first), ADR-0006 (pack lifecycle), ADR-0007 (accounts; in-game routes use Capability Tokens).
- **Open for the user:**
  - whether `validateCurriculumPack` should report a pack with a missing or wrongly typed field as a 200 report rather than a 400;
  - the 256 KB limit;
  - the 600-second cap on a single extension.
