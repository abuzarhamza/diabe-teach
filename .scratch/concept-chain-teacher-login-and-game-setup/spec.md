# Spec: Teacher login and Game setup pages for the Concept Chain prototype

Status: ready-for-agent

Related:
- `../concept-chain-screens-api-overlay/spec.md`: the teacher, lobby and learner screens and the API overlay that these pages join.
- `claudPoc/ConceptChain (API overlay).html`: the earlier single-page prototype. Its Session builder is the starting point for Game setup.

## Problem Statement

A teacher who opens the Concept Chain prototype lands straight on the teacher screen with a demo Game Session already created. They can't say who they are, can't choose which Curriculum Pack to play or make their own, and can't set how long each phase lasts. The earlier single-page prototype has a Session builder that covers pack choice and timings, but it lives in a different page and design. It also uses wording that doesn't match the new screens: "Create session", "Start session", and "New round" for reshuffling the board. The teacher has no single path from "I'm here" to "my class is playing".

## Solution

Two new pages go in front of the teacher screen, giving the teacher one path:

```text
Teacher login  ──►  Game setup  ──[Start game]──►  Teacher screen (live Game Session)
```

1. **Teacher login**: the first page a teacher opens. They enter their name and email and sign in. This is a demo sign-in only: there's no password check, and the teacher is remembered in this browser. Once signed in, they go to Game setup. Opening Game setup or the teacher screen without signing in sends them back here.
2. **Game setup** (replaces the "Session builder" name). It is rebuilt in the new screens' design from the earlier prototype's Session builder, in two sections:
   - **Choose a pack**: pick an existing Curriculum Pack (the topics the prototype already ships, e.g. Diabetes mellitus), or **create a new pack** from pasted or uploaded keywords, with a pack name, learner level and learning objective. Packs the teacher creates are saved in the browser and appear in the list next time.
   - **Board preview**: the board the class will get, dealt from the chosen pack at the chosen size, with a **Shuffle** button the teacher can press until they're happy with it. This replaces the shuffle half of the old "New round".
   - **Time allotment**: chain-building time and explaining (peer review) time per Gameplay Round, with an option to let either phase be **teacher-paced** (no timer). It also has the shortest chain allowed and the board size, and shows **"Rounds: 2"** as a fixed, read-only value with the note "Each round gets a freshly shuffled board". This replaces the old "as many rounds as you like".
   - A single **"Start game"** button (replacing "Create session" / "Start session") creates the Game Session with the chosen pack, timings and previewed board, then opens the teacher screen showing the new room code.
   - **Revised 2026-11-18 ("Don't make me think"):** the page is laid out as three numbered steps: **1 Pick a topic**, **2 How long?**, **3 Start**. Step 3 stays on screen while the teacher scrolls. Each timer is a single dropdown, and the rarely changed settings sit in a closed **"Board & chain length"** box that shows their current values. The defaults are good enough to press Start straight away. See *Game setup layout (revised 2026-11-18)* under Implementation Decisions.
3. **Wording changes** across the teacher pages:
   - "Create session" / "Start session" → **"Start game"**.
   - "New round" is removed. Its "start another round" half moves to the teacher screen's phase button: at the end of Round 1 it reads **"Start Round 2 · new board →"**, so the teacher knows a fresh shuffle is coming.
   - There is no "Reshuffle now" during a round. It has no API, and it would invalidate chains learners are already building.
4. The teacher screen shows who is signed in, a **"Sign out"** link back to Teacher login, and the pack and timings in use. "Start a new session" on the teacher screen goes back to **Game setup** instead of silently making a new session with default settings.
5. Both new pages get the **API overlay** toggle and tags from the existing overlay. Teacher login is tagged as a gap because there is no teacher sign-in endpoint. Game setup maps to `listCurriculumPacks`, `getCurriculumPackById`, `validateCurriculumPack`, `registerCurriculumPack`, and step **A** `createGameSession` with its `timerConfig`.

## User Stories

1. As a teacher, I want a sign-in page as my starting point, so that the prototype knows who is running the class.
2. As a teacher, I want to sign in with just my name and email, so that getting started takes seconds.
3. As a teacher, I want to be told clearly that this is a demo sign-in with no password, so that I don't assume my account is protected.
4. As a teacher, I want to stay signed in when I reload, so that I don't have to sign in again mid-class.
5. As a teacher, I want to be sent to sign-in if I open Game setup or the teacher screen without signing in, so that the flow always starts in the right place.
6. As a teacher, I want to sign out from the teacher screen, so that a colleague can use the same computer.
7. As a teacher, I want my name shown on Game setup and the teacher screen, so that I can see who is signed in.
8. As a teacher, I want a page called "Game setup", so that I know this is where I prepare the game before my class plays.
9. As a teacher, I want to see the available Curriculum Packs with their name, keyword count and description, so that I can choose a topic.
10. As a teacher, I want to preview a pack's keywords before choosing it, so that I know it suits my class.
11. As a teacher, I want to create a new pack by pasting keywords, so that I can teach my own topic.
12. As a teacher, I want to create a new pack by uploading a .txt or .csv file of keywords, so that I can reuse lists I already have.
13. As a teacher, I want to start a new pack from an existing one and edit it, so that I don't type everything from scratch.
14. As a teacher, I want duplicate and empty keywords removed automatically, with a count of how many I have, so that my pack is clean.
15. As a teacher, I want to be told how many keywords the chosen board size needs (e.g. 49 for 7×7), so that I add enough.
16. As a teacher, I want to give my pack a name, learner level and learning objective, so that the class knows what we're practising.
17. As a teacher, I want packs I create to be saved and listed next time, so that I can reuse them.
18. As a teacher, I want to delete a pack I created, so that my list stays tidy.
19. As a teacher, I want to set the chain-building time per round in minutes, so that it fits my lesson.
20. As a teacher, I want to set the peer-review time per round in minutes, so that discussion fits too.
21. As a teacher, I want to make a phase teacher-paced instead of timed, so that I can move on when my class is ready.
22. As a teacher, I want sensible default times already filled in, so that I can start quickly.
23. As a teacher, I want times outside the allowed range rejected with a clear message, so that I don't start a broken game.
24. As a teacher, I want to set the shortest chain allowed, so that I can make the game easier or harder.
25. As a teacher, I want to choose the board size, so that it suits my class and pack.
26. As a teacher, I want a summary of my choices next to the "Start game" button, so that I can check them before starting.
27. As a teacher, I want "Start game" disabled until a pack is chosen and the settings are valid, so that I can't start an empty game.
28. As a teacher, I want "Start game" to take me to the teacher screen with a new room code, so that I can share it with my class at once.
29. As a teacher, I want the teacher screen to show the pack and timings I chose, so that I know the game is set up as I asked.
30. As a teacher, I want the chain-building and peer-review timers on the teacher and learner screens to use my chosen times, so that the game follows my plan.
31. As a teacher, I want a teacher-paced phase to show "Teacher-paced" instead of a countdown, so that learners know I'll move us on.
32. As a teacher, I want "Start a new session" on the teacher screen to take me back to Game setup, so that a new game can use different settings.
33. As a teacher, I want Game setup to remember my last choices, so that running the same lesson again is quick.
34. As a teacher, I want the words "Start game" used everywhere a game is started, so that the wording is consistent.
35. As a learner, I want the board and timers to match what my teacher set up, so that the game is fair and predictable.
36. As a developer, I want both new pages to have the API overlay toggle, so that I can see which API each element would call.
37. As a developer, I want the sign-in form tagged as a gap with "no teacher sign-in endpoint", so that I know authentication has to be designed.
38. As a developer, I want the pack list tagged with `listCurriculumPacks` and the preview with `getCurriculumPackById`, so that I know how to load packs.
39. As a developer, I want "create a new pack" tagged with `validateCurriculumPack` then `registerCurriculumPack`, with a note that a real pack needs card ids, domains and a rubric the prototype doesn't collect, so that I know the gap.
40. As a developer, I want "Start game" tagged as step A `createGameSession`, with a live sample showing `packId`, `mode: "classroom"`, `adjudicationMode: "peer-instructor"`, `creatorDisplayName` and the `timerConfig` built from my choices (seconds, `null` for teacher-paced), so that I can copy a realistic request.
41. As a developer, I want the shortest-chain and board-size settings flagged where the API ignores them, so that I don't assume the server enforces them.
42. As a developer, I want the API overlay's flow legend to show the new pages in the screens list, so that the end-to-end flow includes login and setup.
43. As a teacher, I want to preview the board my class will get on Game setup, so that I can check the keyword layout before anyone joins.
44. As a teacher, I want a Shuffle button on the board preview, so that I can get a different layout if this one is too easy or too hard.
45. As a teacher, I want the board preview to update when I change the pack or board size, so that it always matches my settings.
46. As a teacher, I want Round 1 of my game to use the board I previewed, so that what I checked is what my class plays.
47. As a teacher, I want to see that a game has exactly 2 rounds, so that I'm not surprised there's no third round.
48. As a teacher, I want to be told each round gets a freshly shuffled board, so that I know Round 2 won't repeat Round 1's layout.
49. As a teacher, I want the button at the end of Round 1 to say "Start Round 2 · new board", so that I know pressing it starts a new round with a fresh shuffle.
50. As a developer, I want the Shuffle button tagged with the `seed` field of `createGameSession`, marked "partial" because the backend ignores `seed`, so that I know a previewed board can't be reproduced server-side yet.
51. As a developer, I want the "Start game" sample request to include the previewed board's `seed`, so that the request matches what the teacher saw.

Added 2026-11-18 after a "Don't make me think" review of Game setup:

52. As a teacher, I want "Start game" visible at all times on Game setup, so that I never have to scroll to find how to begin.
53. As a teacher, I want the page to show three numbered steps (pick a topic, how long, start), so that I know what to do and in what order without reading.
54. As a teacher, I want to press "Start game" straight away with the pre-filled choices, so that a normal lesson takes one click.
55. As a teacher, I want each timer to be one dropdown (3, 4, 5, 8, 10 or 15 minutes, or "No timer – I'll move them on"), so that I don't have to work out how a minutes box and a checkbox interact.
56. As a teacher, I want board size and shortest chain in a closed "Board & chain length" box that shows their current values and a clear "Change" button, so that the settings I rarely change don't slow me down but I can still see and find them.
57. As a teacher, I want the shortest chain as a dropdown ("Chains need at least N words"), so that I can't type an invalid number.
58. As a teacher, I want pack cards to show just the pack name, with the chosen pack's word count and description shown once, so that the list is quick to scan.
59. As a teacher, I want "+ New pack" as the last card in the pack list, so that I find it where I'm already looking.
60. As a teacher, I want learner level and learning objective marked "(optional)" in the pack editor, so that I know I can skip them.
61. As a teacher, I want the board preview kept small, with the full word list behind a "See all N words" link, so that the page stays short.
62. As a teacher, I want one plain sentence next to "Start game" summing up my choices (topic, times, 2 rounds), so that I can check them at a glance.
63. As a teacher, I want plain words instead of our internal terms (no "Game Session", "Gameplay Round", "Time allotment" or "keywords per side"), so that the page reads like a lesson plan.
64. As a teacher, I want "Rounds: 2" shown as part of the summary sentence instead of as a box that looks like a setting, so that I don't look for a way to change it.

## Implementation Decisions

- **Scope of change:** prototype files only, plus tests: two new pages next to the existing teacher, lobby and learner screens, changes to the teacher screen and the shared mock, and new catalog entries for the API overlay. No backend, OpenAPI or domain changes.
- **Page names:** "Teacher login" and "Game setup". Game setup replaces the name "Session builder". Both reuse the existing shared design tokens and layout, not the earlier single-page prototype's styles.
- **Teacher identity (demo only):** the signed-in teacher (name, email, signed-in time) is stored in browser storage under its own key, separate from the demo Game Session store and the learner identity key. It isn't secret and has no password. The page says plainly that it is a demo sign-in. A small guard shared by Game setup and the teacher screen redirects to Teacher login when no teacher is stored.
- **Packs:** the mock offers a pack catalog: the built-in topics from the earlier prototype, plus teacher-created packs saved in browser storage. In the mock, a pack holds an id, name, description (learner level + objective), keyword list and board size. Built-in packs can't be deleted; teacher-created ones can.
- **Session creation:** the shared mock's session creation takes a settings object that mirrors `CreateSessionRequest`: `packId`, `mode: "classroom"`, `adjudicationMode: "peer-instructor"`, `creatorDisplayName` from the signed-in teacher, and `timerConfig`. The mock's fixed per-phase timers are replaced by this `timerConfig`. Minutes are converted to seconds and teacher-paced phases are sent as `null`. The allowed range is 1 to 86400 seconds, as in `SessionTimerConfig`. The board is dealt from the chosen pack's keywords at the chosen board size. Shortest chain is enforced by the mock's chain validation.
- **Board preview and seed:** the mock deals boards from a seed, so the same seed, pack and board size always give the same board. Game setup holds a preview seed. Shuffle replaces it with a new random seed. Changing the pack or board size re-deals with the current seed. "Start game" passes the seed as `CreateSessionRequest.seed`, and the mock uses it for Round 1's board. Round 2 always gets a new seed when the teacher starts it from the teacher screen, as it does today.
- **Rounds:** fixed at 2, matching `PhaseIdentifier` (`round-1:*`, `round-2:*`). Game setup shows the count read-only; there is no input.
- **Round button wording:** the teacher screen's phase button labels its action from the next phase. Going from `round-1:round-summary` to `round-2:chain-mapping`, it reads "Start Round 2 · new board →". Other labels are unchanged.
- **Time allotment fields:** Game setup exposes chain-building (`roundMappingSec`) and peer-review (`roundAdjudicationSec`) time. They apply to both Gameplay Rounds. Other phases (pre-test, trial round, round summary, post-test, survey) keep their current teacher-paced behaviour in the prototype.
- **Remembered settings:** the last-used pack and settings are stored per browser and pre-filled on the next visit.
- **Wording:** "Start game" replaces "Create session" / "Start session" on the new pages and on the teacher screen. The teacher screen's "Start a new session" (both the reset button and the end-of-session button) navigates to Game setup after the existing two-click confirm, instead of creating a session with defaults.
- **API overlay:** the new pages include the overlay modules and mark elements with the existing `data-api` / `data-api-io` attributes. New catalog entries are pack operations (`listCurriculumPacks`, `getCurriculumPackById`, `validateCurriculumPack`, `registerCurriculumPack`) and a gap for teacher sign-in. Step A also lists Game setup's "Start game" as one of its elements, with a live `sample` building the `createGameSession` request from the form. Deviations already known from earlier research are carried onto the cards:
  - registering a pack needs an instructor token that only `createGameSession` issues;
  - the earlier research says register and validate responses drift from the spec;
  - shortest chain is fixed server-side and not read from the pack.
- **Game setup layout (revised 2026-11-18, user stories 52–64):** replaces the first layout from tickets 02–04 without changing what is sent.
  - Left column: **1 Pick a topic** (pack cards showing the name only, plus a "Yours" tag on teacher-made packs; the last card is "+ New pack", which opens the editor), then the board preview capped at about 360px wide, with Shuffle, a one-line "N words · description" for the chosen pack, and a closed "See all N words" list.
  - Right column (the step 3 Start box is sticky): **2 How long?** with "Building chains" and "Reviewing chains" dropdowns (3, 4, 5, 8, 10, 15 min, "No timer – I'll move them on"), a closed **Board & chain length** box: a bordered row showing the current values ("4 × 4 board · chains of 5+ words") and a "Change" button that reads "Done" when open, holding Board: N × N and "Chains need at least N words" (2–6). It replaced a small "More options" link on 2026-11-18 because the user missed the link entirely, then **3 Start** with the summary sentence, "Start game →" and "You'll get a room code to share with your class."
  - A remembered value that isn't in a dropdown's list (for example 7 minutes) is added to that list, so the teacher's last choice is never lost.
  - The fixed "Rounds: 2" box, the "15 packs" count, the separate keyword list panel and the label/value summary list are removed. Their information is in the summary sentence or the chosen pack's line.
  - If Start can't run, the message names what to fix (for example "Choose a topic first.").
  - Unchanged: the `CreateSessionRequest` that is sent, remembered settings, the pack editor's behaviour, element ids that tests rely on, and every `data-api` tag (the tags move with their elements).
- **Navigation:** the learner screens are unchanged. The teacher's starting page is Teacher login; the teacher screen is reached through "Start game".

## Testing Decisions

- **Good tests check external behaviour only:** what the catalog promises compared with the API contract, and what request the sample builder produces from a given form state. They don't assert page layout or internal function names.
- **Seam 1 (existing, preferred): the API overlay catalog tests.** Extend the existing drift test to cover the two new pages: every `data-api` key on them must resolve in the catalog, and every new pack operation must match `docs/api/openapi.yaml` by operationId, method, path and error statuses. Extend the existing sample test so that, for a given Game setup state, the `createGameSession` sample has the chosen `packId`, `creatorDisplayName`, the previewed `seed`, and a `timerConfig` with minutes converted to seconds and teacher-paced phases as `null`.
- **Seam 2 (existing): the shared mock.** If the mock's session-creation and pack functions stay pure enough to load in vitest (as the catalog is), add checks that a session created with a given `timerConfig` gets the matching `phaseEndsAt` on entering chain-mapping, or `null` when teacher-paced, that a too-short chain is rejected, and that the same seed, pack and board size deal the same board, which becomes Round 1's board. If the mock can't be loaded without a DOM, leave this to the browser check.
- **Prior art:** the overlay's existing drift and sample tests, and `tests/app-runtime-yaml-integration.test.ts` for YAML parsing.
- **Checked by hand in a browser:** the redirect guard, sign-in and sign-out, pack create, save and delete, file upload, remembered settings, "Start game" → teacher screen with the chosen timings visible on teacher and learner screens, and the overlay on both new pages.

## Out of Scope

- Real teacher authentication (passwords, accounts, tokens, a sign-in endpoint) and any backend change.
- Wiring the pages to the real API.
- The earlier single-page prototype: it stays as it is. Game setup is a new page, not an edit of that file.
- The AI keyword suggestions, saved "share codes" and team setup from the earlier Session builder.
- Timers for pre-test, trial round, round summary, post-test and survey.
- Changing the learner join, lobby or game screens beyond showing the chosen timings that come through the shared session.

## Further Notes

- On 2026-11-17 the user asked for this with a message that was cut off after "time allotmen…". Decisions not stated by the user follow the recommendations Claude gave in the same conversation:
  - a demo sign-in with name and email;
  - "New round" removed from setup, with new rounds started from the teacher screen. On 2026-11-17 the user asked what replaces it, and this spec adopts Claude's answer: a board preview with Shuffle on Game setup, a fixed "Rounds: 2" display, and the "Start Round 2 · new board →" button label;
  - the overlay added to both new pages.
  Confirm these, and anything that came after "time allotment", before implementation starts.
- On 2026-11-18 the user asked for Game setup to follow "Don't make me think" and approved the review's recommendations (sticky Start, numbered steps, timer dropdowns, More options, plain wording, slimmer pack cards and preview). Recorded as user stories 52–64 and ticket 06.
- Learner level and learning objective have no field on a Game Session or Curriculum Pack in the API. The closest is the pack `description`, so the overlay card should say so.
- Teacher-created packs in the prototype are plain keyword lists. A real `registerCurriculumPack` needs Keyword Card ids, Semantic Domains and an adjudication rubric, so this is a known gap, not a bug.
