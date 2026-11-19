# Spec: API overlay for the Concept Chain teacher, lobby and learner screens

Status: ready-for-agent

Related: `../conceptchain-api-overlay/spec.md` (the earlier overlay for the single-page prototype, which used a click-blocking "inspect mode") and its `RESEARCH.md` (the UI → API mapping and implementation-status findings this spec reuses).

## Problem Statement

The Concept Chain prototype now has three screens that together play one Game Session:

- the **teacher screen** (room code, phase steps, timer, board, review list with Instructor Final Ruling, learner roster, standings);
- the **lobby** a learner lands on after joining (welcome, classmates in the room, session timeline, rules, example Concept Chain);
- the **learner game screen** (join form, chain builder on the board, peer review votes, "My chains", round results).

All three run on an in-browser mock of the Game Session API. Someone reading or demoing them can't tell which element corresponds to which backend operation, what the request and response look like, which Capability Token is needed, or whether the backend actually implements it. They also can't see the **order** of calls across the screens: the teacher creates the session, learners join, the teacher advances phases, learners submit, and so on. That knowledge lives in `docs/api/openapi.yaml`, the Netlify handlers and research notes. Today people work it out by reading code.

## Solution

Add an **"API overlay" toggle button** to the header of all three screens. When it's on:

- Every element tied to an API operation gets a **highlighted boundary**. Elements that **send** a request (buttons, forms) get a **dashed** outline. Elements that only **show** API data (board, timer, phase steps, rosters, standings) get a **solid** outline in a different color.
- Every highlighted element gets a **letter tag (A, B, C, …)**. The letter is that operation's **step in the end-to-end flow** and means the same thing on every screen. Each tag also shows a small actor badge: 👩‍🏫 teacher or 🎓 learner.
- **Hovering or keyboard-focusing** a highlighted element shows a **card** with: the flow step, operationId, METHOD + path, required auth, a sample request, a sample response, error codes, an implementation status badge, and known differences between the code and the spec.
- Sample request and response values are **filled from the live demo session** (real room code, participant id, current chain, current phase) where possible, and fall back to fixed examples otherwise.
- **Clicks still work normally**, so the whole flow can be played with the overlay on. Clicking or tapping a tag **pins** its card open so the JSON can be copied. Tapping a tag is also how cards open on touch screens.
- A **flow legend** panel lists every step A → H in order, who makes the call, and which screen it happens on.
- Whether the overlay is on or off is saved for the browser tab, so it survives the automatic switches between join form, lobby and game screen.

### Flow steps (the letters)

| Tag | Step | Operation(s) | Actor | Where it shows |
| --- | --- | --- | --- | --- |
| A | Create session | `createGameSession` | 👩‍🏫 | Teacher: room code, "Reset session", "Start a new session" |
| B | Join session | `joinGameSession` | 🎓 | Learner: join form |
| C | Watch session | `getGameSessionState`, `streamGameSessionEvents`; plus proposed **list round chains** (missing) | 👩‍🏫 🎓 | Teacher: phase steps, timer, board, roster, review list. Lobby: classmates, timeline, phase pill. Learner: phase pill, timer, board, classmates' chains, My chains |
| D | Advance phase | `transitionSessionPhase` | 👩‍🏫 | Teacher: "Next phase" |
| E | Submit Concept Chain | `submitConceptChain` | 🎓 | Learner: "Submit chain" (and the builder it reads from) |
| F | Peer vote | `adjudicateConceptChain` (`peer-approve` / `peer-challenge`) | 🎓 | Learner: Approve / Challenge |
| G | Instructor Final Ruling | `adjudicateConceptChain` (`instructor-approve` / `instructor-reject`) | 👩‍🏫 | Teacher: Approve / Reject with feedback and quality score |
| H | Round standings | `getRoundStandings` | 👩‍🏫 🎓 | Teacher standings table; learner round results |

Elements with no backend operation are tagged as gaps rather than steps: "+1 min" (no API to extend a phase) and the teacher's review list (no endpoint lists a round's Concept Chains). Demo-only controls ("Add sample learners & chains", "Not you? Join again") are left untagged.

## User Stories

1. As a developer, I want an "API overlay" toggle in the header of every Concept Chain screen, so that I can turn the overlay on from wherever I am.
2. As a developer, I want the overlay off by default, so that a normal demo looks unchanged.
3. As a developer, I want the toggle to show whether the overlay is on (pressed state), so that I know what mode I'm in.
4. As a developer, I want the overlay to stay on when the learner screen switches from join form to lobby to game, so that I can follow one learner through the whole flow.
5. As a developer, I want every element that sends an API request to get a dashed outline, so that I can see what calls the backend.
6. As a developer, I want every element that only displays API data to get a solid outline in a different color, so that I can tell reads from writes at a glance.
7. As a developer, I want a letter tag on each highlighted element, so that I can see where it sits in the flow.
8. As a developer, I want the same letter to mean the same operation on every screen, so that "E" on the learner screen and "E" in the teacher's review list are clearly the same call.
9. As a developer, I want each tag to show whether the teacher or a learner makes the call, so that I know which Capability Token applies.
10. As a developer, I want a flow legend listing A → H in order with actor and screen, so that I can understand the whole Game Session lifecycle without opening the spec.
11. As a developer, I want hovering a highlighted element to show its API card, so that I can explore quickly with the mouse.
12. As a keyboard user, I want focusing a highlighted element to show the same card, so that the overlay is usable without a mouse.
13. As a touch-screen user, I want tapping a tag to open the card, so that the overlay works on a phone or tablet.
14. As a developer, I want clicking a tag to pin the card open until I close it, so that I can select and copy from it.
15. As a developer, I want Esc to close a pinned card, so that it's quick to dismiss.
16. As a developer, I want clicks on the real elements to keep working while the overlay is on, so that I can play the flow and watch the cards change.
17. As a developer, I want the card to show the operationId and METHOD + path (with `/api/v1` base path), so that I can find it in `openapi.yaml`.
18. As a developer, I want the card to list path params with allowed values (e.g. `roundNumber` ∈ {1, 2}), so that I build URLs correctly.
19. As a developer, I want the card to show required auth (`x-api-key` when configured; Bearer teacher or learner Capability Token), so that I attach the right headers.
20. As a developer, I want a sample request body with `$ref`s resolved into concrete fields, so that I don't need to read the YAML.
21. As a developer, I want the sample request filled from the live demo state (e.g. the chain I'm building, converted to `GridCoord` path and `stepRationales`), so that the example matches what I see.
22. As a developer, I want a sample success response with status code, filled from the live demo state where possible, so that I know what to parse.
23. As a developer, I want the possible error statuses and codes (e.g. 409 `PHASE_CLOSED_FOR_SUBMISSIONS`, 422 `CHAIN_TOPOLOGY_INVALID`, 409 `ADJUDICATION_LOCKED_BY_INSTRUCTOR`), so that I can handle failures.
24. As a developer, I want a status badge (implemented / partial / spec only / missing) on each card, so that I don't integrate against something that doesn't exist.
25. As a developer, I want known code-vs-spec differences listed on the card, so that I'm not surprised at runtime.
26. As a developer, I want a copy button on the sample request, sample response and path, so that I can paste into curl or code.
27. As a developer, I want multi-call elements (e.g. the teacher's review list needs a list endpoint plus a stream) to show each operation in order, so that I understand the sequence.
28. As a developer, I want the teacher's review list flagged in red as needing a missing "list round chains" endpoint, so that the biggest backend gap is obvious.
29. As a developer, I want "+1 min" flagged as having no API, so that I don't assume the server can extend a phase.
30. As a developer, I want the board card to note that `activeBoard` is in the spec but not yet returned by the backend, so that I know the board can't come from the server yet.
31. As a developer, I want the timer card to explain `phaseEndsAt` (null = teacher-paced) and the 5-second submission grace period, so that I understand when submissions close.
32. As a developer, I want the "Next phase" card to say the server never auto-advances and only moves to the next phase, so that I keep the teacher in control.
33. As a developer, I want the Approve/Reject card to say `feedback` is required and the ruling locks the chain, so that the UI collects feedback and disables re-ruling.
34. As a developer, I want the peer vote card to say learners can't vote on their own chain or on a locked chain, so that I handle 403 and 409.
35. As a developer, I want the standings card to explain ranking (longest approved chain, then number approved) and any missing fields, so that I know what to compute client-side.
36. As a developer, I want the join form card to show that the response gives a `participantId` and `participantToken` to keep for later calls, so that I store them.
37. As a developer, I want the lobby's classmates list card to point to the `participant.joined` stream event, so that I know how the list updates live.
38. As a developer, I want the card to update when the phase changes while it's open, so that live values stay accurate.
39. As a developer, I want the overlay to have no effect on the demo session data when toggled, so that turning it on never changes the game.
40. As a developer, I want the overlay to keep working when the page re-renders (board redraw, new chains), so that tags don't disappear after a state change.
41. As a product owner, I want cards to use GLOSSARY terms (Game Session, Gameplay Round, Concept Chain, Keyword Card, Instructor Final Ruling, Capability Token), so that developers learn the domain language.
42. As a developer, I want the catalog checked automatically against `openapi.yaml`, so that the cards can't silently fall out of date with the API spec.

## Implementation Decisions

- **Scope of change:** only the three prototype screens and their shared files, plus one test. No backend, OpenAPI or domain changes.
- **Shared modules:** two new modules sit beside the existing shared mock-session script.
  - An **API catalog** module: pure data, no DOM. It declares `steps` (letter, title, actor, operation ids, screens), `operations` keyed by operationId, `gaps` (UI elements with no API), and `globalNotes`. Placeholder operations that don't exist in the spec (e.g. "list round chains") have status `missing` and make no operationId claim against the spec.
  - An **overlay** module: the toggle, outlines, tags, cards, legend and persistence. Each screen includes both modules and makes no other overlay-specific changes beyond the attribute below.
- **Marking elements:** each screen marks API-bound elements with a declarative attribute naming a catalog entry (for example `data-api="E"` or a finer key such as `data-api="G.reject"`), and marks reads vs. writes. Dynamically rendered elements (chain cards, vote buttons, roster entries) get the attribute in their render templates. The overlay finds elements by this attribute, so it needs no knowledge of page internals.
- **Catalog entry shape** (sketch):
  ```
  steps[letter]      = { title, actor: "teacher"|"learner"|"both", ops: opId[], screens: string[] }
  operations[opId]   = { method, path, pathParams, auth: ("apiKey"|"instructor"|"participant")[],
                         request, response: { status, body }, errors: [{ status, code }],
                         status: "implemented"|"partial"|"specced-only"|"missing", deviations: string[],
                         sample?: (session, ctx) => { request?, response? } }
  ```
- **Contract source of truth:** contracts are hand-written from `docs/api/openapi.yaml` with `$ref`s resolved. Statuses and deviations come from the earlier overlay research and **must be re-checked against the current code** when filling the catalog. For example, the Chain-Mapping deadline and grace period are now implemented, and a survey handler now exists, so parts of that research are out of date. The catalog is static: no runtime YAML fetch, so pages still work when opened as files.
- **Live samples:** a sample builder reads the mock session state (session ids, room code, phase, `phaseEndsAt`, active board, the current learner's draft chain, the chain under the cursor) and produces request and response JSON in API shapes. The prototype's mock state already mirrors `PublicSessionState` and `SubmittedChain`. Samples are labelled "example from demo session". The mock can't provide some values (tokens, server-assigned ids before a call), so those are shown as placeholders like `<participantToken>`.
- **Re-rendering:** the screens rebuild their DOM on every state change. The overlay re-applies tags after each render by observing DOM mutations under the page root, rather than hooking each render function.
- **Positioning:** tags and cards are positioned in a separate layer above the page, so they don't change the page layout. Cards flip to stay inside the viewport.
- **Persistence:** the on/off state is stored in tab-scoped session storage under its own key, separate from the demo session store and the learner identity key.
- **Event isolation:** while the overlay is on, it adds listeners only for hover, focus and tag clicks. It never calls `preventDefault` on page elements. When it's off, it removes its listeners and layer.
- **Accessibility:** the toggle is a button with `aria-pressed`. A tag is a focusable button labelled with its step and operation. A pinned card is a non-modal dialog that closes with Esc and returns focus to its tag. Outline and tag colors meet contrast in both light and dark themes, and reads vs. writes are told apart by line style (dashed vs. solid) as well as by color.
- **Visual language:** reuses the prototype's tokens. Status badge colors follow the existing good / warn / bad colors, with `missing` in the bad color.

## Testing Decisions

- **Good tests check external behaviour only:** whether the catalog agrees with the API contract. They don't assert internal function names or layout.
- **Seam: catalog ↔ OpenAPI drift (the one seam).** A vitest test loads the catalog module (it is pure data, so it can be evaluated without a DOM) and parses `docs/api/openapi.yaml` with the existing `yaml` dependency. It asserts that:
  - every catalog operation not marked `missing` exists in the spec with the same operationId, method and path;
  - every error status listed for an operation is a response status the spec declares for it;
  - every step letter references only operations that exist in the catalog;
  - every catalog operation is referenced by at least one step or listed as a gap.
- **Prior art:** `tests/app-runtime-yaml-integration.test.ts` (YAML parsing in tests) and the vitest style used across `tests/`.
- **Not automated:** hover, tag placement, pinning, copying and persistence across page switches. These are checked by hand in a browser by playing a full session with the overlay on. A jsdom DOM test is out of scope for now.

## Out of Scope

- Wiring the screens to the real API (fetch calls, tokens, server-driven session).
- Fixing any backend gap the overlay reveals: list round chains, `activeBoard`, SSE stream, phase extension, response-shape drift.
- Changing `docs/api/openapi.yaml`.
- Pre-test, post-test and survey screens, and the operations only they would use (assessments, survey, analytics), beyond listing them in the legend as "no screen yet".
- Bringing the earlier single-page prototype's overlay up to this design.
- Generating the catalog from the OpenAPI file at runtime or build time.
- Refreshing generated OpenWiki pages.

## Further Notes

- Step letters follow the order of a classroom Game Session. If a step is added later (for example the Trial Round calibration examples via `getCurriculumPackById`), append a new letter rather than re-lettering, so screenshots and discussions stay valid.
- The drift test catches changes to the spec, but not changes to implementation status. Update catalog statuses whenever a backend gap closes.
