# Spec: List a Gameplay Round's Concept Chains

**Status:** ready-for-agent

## Problem Statement

During a Classroom Game, the teacher's screen has to show every Concept Chain the learners submitted in the current Gameplay Round. The teacher uses that list to review chains, see peer votes, and record an Instructor Final Ruling. The learner's screen needs two lists: "My chains" (their own chains, with the peer votes and the teacher's ruling as they come in) and "Review classmates" (other learners' chains, to vote on during peer-adjudication).

No API can return these lists today. Submitting a chain returns that one chain, and adjudicating returns that one chain, but nothing lists a round's chains. The streaming route that was meant to push `chain.submitted` / `chain.adjudicated` events was never built. As a result:

- the teacher's review list, the roster's per-learner chain counts, and the "To check" column can't come from the server;
- a learner never sees peer votes or the teacher's ruling on their own chain after submitting it;
- a learner can't see classmates' chains, so peer voting can't be wired up;
- the prototype's teacher and learner screens have to keep faking the whole game in the browser.

This is the biggest blocker to wiring the in-game screens to the real API.

## Solution

A new read route, **`GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains`**, returns every Concept Chain of that Gameplay Round that the caller is allowed to see. Each chain comes with its status, peer votes and verdict, plus the display names the screens need, so a screen doesn't need a learner roster to label chains and votes.

Who sees what:

- **Instructor** (the session's instructor Capability Token): every chain in the round, in any phase.
- **Participant** (a learner's Capability Token for the session):
  - **while that round is in chain-mapping:** only their own chains, so nobody can copy a classmate's chain;
  - **from that round's peer-adjudication on** (peer-adjudication, round-summary, later rounds, posttest, survey, completed): every chain in the round, so they can review and vote.

The screens poll this route, alongside the session state, to stay fresh. Live streaming is a separate decision.

## User Stories

1. As a teacher running a Classroom Game, I want to list every Concept Chain submitted in the current Gameplay Round, so that I can review them.
2. As a teacher, I want each chain in the list to show who submitted it (their display name), so that I can give feedback to the right learner.
3. As a teacher, I want each chain's path, keywords, narrative and step rationales, so that I can judge whether the story holds up at every link.
4. As a teacher, I want each chain's status (pending review, approved, rejected), so that I can see at a glance what still needs a ruling.
5. As a teacher, I want each chain's peer votes, with the voter's display name and comment, so that I can weigh the class's view before ruling.
6. As a teacher, I want each chain's verdict, including whether it is locked by my Instructor Final Ruling, so that I don't rule twice on the same chain.
7. As a teacher, I want to see chains while chain-mapping is still running, so that I can watch the class's progress and count chains per learner.
8. As a teacher, I want to list Round 1's chains while Round 2 is running, or after the game ends, so that I can look back at earlier work.
9. As a teacher, I want chains listed in the order they were submitted, so that the review list doesn't reshuffle every time I poll.
10. As a teacher, I want to list a round in which nobody submitted a chain and get an empty list, so that my screen can say "No chains yet" rather than show an error.
11. As a teacher, I want to list Round 2 before it has started and get an empty list, so that my screen can poll without special cases.
12. As a teacher, I want the roster's per-learner chain counts and the standings' "To check" column to come from this list, so that they match what the server holds.
13. As a learner, I want to see my own chains during chain-mapping, so that I can check what I've already submitted and avoid repeats.
14. As a learner, I want to see peer votes and comments on my chains once peer-adjudication starts, so that I learn how classmates judged my reasoning.
15. As a learner, I want to see the teacher's Instructor Final Ruling and feedback on my chains, so that I learn from the authoritative verdict.
16. As a learner, I want to see classmates' chains during peer-adjudication, so that I can approve or challenge them.
17. As a learner, I want to see which of my classmates' chains I have already voted on, so that I don't vote twice by mistake.
18. As a learner, I must not see classmates' chains during chain-mapping, so that nobody can copy another learner's chain.
19. As a learner, I want to look back at a finished round's chains in the round summary, so that I can compare my chains with the class's.
20. As a teacher, I want a learner from another Game Session to be refused, so that one class can't see another class's chains.
21. As a teacher, I want a request with no token, or an invalid or expired token, to be refused, so that chains aren't public.
22. As a client developer, I want an unknown session to return 404 `SESSION_NOT_FOUND`, so that my screen can tell a bad link from an empty round.
23. As a client developer, I want a round number other than 1 or 2 to return 400, so that a typo doesn't look like an empty round.
24. As a client developer, I want the response to reuse the `SubmittedChain` shape that submit and adjudicate already return, so that I can render chains from all three routes with one component.
25. As a client developer, I want the route documented in OpenAPI and the prototype's API catalog, so that the screens' API overlay no longer shows it as missing.
26. As a solo learner (Solo Practice), I want to list my own chains in any phase, so that the solo screen works with the same route. In Solo Practice the only participant is me.

## Implementation Decisions

- **Route:** `GET /api/v1/sessions/{sessionId}/rounds/{roundNumber}/chains`, operationId `listRoundChains`. It shares its path with the existing `POST` (submit a Concept Chain). It's a new Netlify Functions v2 file with its own `config.path` and `method: "GET"`. Check under `npm run dev:local` that the `GET` and `POST` on the same path reach their own functions. Session paths still have forced `netlify.toml` redirects, so the redirect for this path may need to be removed or narrowed by method, as was done for the pack routes in teacher-login ticket 05.
- **Auth:** `BearerAuth` (the Capability Token), `tokenRequired`, through the shared `createApiHandler` chain, like get-standings:
  - no token, or an invalid or expired token → 401 `UNAUTHORIZED_TOKEN`;
  - a token for another session → 403 `FORBIDDEN_ROLE`;
  - an Account Token → 401. Teachers act in-game with the session's Capability Token, per ADR-0007.
- **Validation:** `roundNumber` must be `1` or `2`, or the route returns 400 `INVALID_REQUEST_BODY`, or a path-parameter error code if one already exists. An unknown `sessionId` returns 404 `SESSION_NOT_FOUND`.
- **New application use case** `ListRoundChainsUseCase`, in the same style as `GetRoundStandingsUseCase`:
  - it reads the Game Session by id through the existing `GameSessionRepositoryPort` and uses the existing `getChainsForRound`;
  - it applies the visibility rule;
  - it maps each chain to the response DTO.
  - No repository or storage change is needed, because chains are stored inside the Game Session document.
- **Visibility rule.** It lives in the domain (for example, a Game Session method that answers "may this participant see classmates' chains in round N?"), not in the handler:
  - Instructor role: all chains.
  - Participant role: if the session's current phase is that round's `chain-mapping`, or an earlier phase (pretest, trial-orientation, or Round 1 phases when asking about Round 2), only chains whose `participantId` is the caller's; otherwise all chains of the round.
  - In practice, before a round's chain-mapping no chains exist, so "own only" and "all" give the same empty list. The rule only matters during chain-mapping.
- **Response shape:** `{ roundNumber, chains: SubmittedChainListItem[] }`, sorted by `submittedAt` ascending, with `chainId` as the tie-breaker. `SubmittedChainListItem` is the existing `SubmittedChain` schema plus:
  - `participantDisplayName` (string): the submitting participant's display name, or `"Unknown"` if not found, as standings does;
  - in each peer vote, `voterDisplayName` (string), worked out the same way.

  Adding these as an extension schema leaves submit and adjudicate responses unchanged. Display names are already public to the class through standings, so this exposes nothing new. No account email or Account id appears.
- **Empty results:** a round with no chains, or a round not yet started, returns 200 with `chains: []`.
- **OpenAPI:** add the `get` operation on the existing chains path, the `SubmittedChainListItem` schema, the 400/401/403/404 responses, and a description of the visibility rule.
- **Prototype API catalog:** in `listRoundChains`, set the status to implemented, record the auth (instructor and participant), drop the "missing" deviation, and update the `C.review`, `C.classChains`, `C.myChains` and `C.roster` notes. Wiring the prototype screens to this route is **not** part of this spec (see Out of Scope).

## Testing Decisions

- **Good tests check external behaviour only:** the HTTP status and response body for a given token, session state and phase. They never check how the use case is put together.
- **Handler tests** (new file, prior art `tests/functions/get-standings.test.ts` and `tests/functions/adjudicate-chain.test.ts`, using the in-memory Game Session repository and a real token issuer) cover:
  - instructor during chain-mapping sees every learner's chains, in submission order, with display names;
  - participant during chain-mapping sees only their own chains;
  - participant during peer-adjudication and round-summary sees every chain in the round;
  - participant listing Round 1 while Round 2 is in chain-mapping sees every Round 1 chain;
  - peer votes come back with `voterDisplayName`, and an Instructor Final Ruling comes back with `verdict.isLocked`;
  - a round with no chains, and Round 2 before it starts, return 200 with an empty list;
  - an unknown session gets 404; round 0 or round 3 gets 400;
  - no token, a bad token, an expired token and an Account Token each get 401, and another session's token gets 403;
  - no email, Account id or stack trace appears in any response body.
- **BDD:** extend the classroom journey (`classroom-session-journey.feature`). After a learner submits a chain:
  - the teacher lists the round's chains and sees it with the learner's name;
  - during chain-mapping a second learner sees only their own chains;
  - after the teacher moves to peer-adjudication, the second learner sees the first learner's chain.

  Run one feature per process, as always (`npm run test:bdd <feature>`).
- **Routing check:** under `npm run dev:local`, a `GET` and a `POST` to the same chains path each reach their own function. The BDD steps above cover this.
- Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse than baseline (lint 96, boundaries 6).

## Out of Scope

- Wiring the prototype's teacher and learner screens to this route. That's a follow-up, after Start game and the lobby are wired.
- The streaming route (`streamGameSessionEvents`) and any push updates. The screens poll.
- A learner roster endpoint (names and progress for learners with no chains yet).
- Returning the board (`activeBoard`) and shuffling the board at each round.
- Paging. A class submits tens of chains per round, not thousands.
- Filtering by status or participant through query parameters. The screens filter on their side.
- Changing how chains are submitted or adjudicated.

## Further Notes

- The API overlay review of the prototype screens (`claudPoc/concept-chain/api-catalog.js`, `listRoundChains`) found this gap, and it was confirmed in the 2026-11-19 screen-by-screen review of what the UI still needs.
- Domain terms follow `GLOSSARY.md`: Game Session, Gameplay Round, Concept Chain, Capability Token, Instructor Final Ruling.
- ADR-0007: in-game routes keep using the per-session Capability Token, never the Account Token.
- Once this lands, the prototype's teacher screen can drop its fake review list, roster counts and "To check" counts. The learner screen can drop its fake "My chains" and "Review classmates" lists.
