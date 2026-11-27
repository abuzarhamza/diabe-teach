# Spec: Pack Editor in the React web app (new Curriculum Pack, and new Pack Version)

**Status:** ready-for-agent
**Supersedes:** the acceptance criteria of `.scratch/react-web-ui/issues/04-pack-editor-validate-and-register.md` (that ticket now points here).
**Depends on:** react-web-ui 03 (Pack Library and Pack Detail, plus the packs API module and its hooks).

## Problem Statement

A teacher who wants to play Concept Chain on their own topic needs a Curriculum Pack of their own words. In the approved prototype (Game setup's "New pack" panel in `claudPoc/`), a teacher pastes or uploads a list of words, names the pack, and saves it to the shared pack library. They can also take an existing pack, change its words, and save the result as a new Pack Version. The React web app (ADR-0008) has no way to do either. A teacher can sign in and (after ticket 03) browse packs, but can't add one. The web-ui ticket asked for a JSON editor, which no teacher should have to write.

## Solution

The React web app gets a **Pack Editor** at `/packs/new` that behaves like the prototype's "New pack" panel and looks like it (same design system):

- The teacher builds a word list in three ways: pasting words (one per line, or separated by commas, semicolons or tabs), uploading a `.txt` or `.csv` file, or copying the words of an existing pack. Words show as removable chips with a running count. Blank entries and duplicates (ignoring case) are dropped, and the screen says how many were dropped. **Clear all** empties the list.
- The teacher gives the pack a **name** (required) and, optionally, a **learner level** and a **learning objective**.
- The screen says how many words a pack needs (at least 9, for a 3 × 3 board) and what board size the current list allows.
- **Check pack** asks the server to dry-run validate the pack. It lists every error and every warning in plain language, naming the part of the pack each one concerns. Warnings never block publishing.
- **Publish** registers the pack in the shared library and takes the teacher to its Pack Detail page, which shows the version just released.
- **Cancel** returns to the Pack Library without saving.
- From a pack's **Pack Detail** page, **Edit → save as new version** opens the same editor, prefilled with that pack's name and words. The heading names the version it will release, for example "Edit “Diabetes basics” → save as v1.2.0". Publishing registers that new Pack Version under the same pack id and returns to its detail page.

The editor is for signed-in teachers only. A signed-out teacher is sent to `/login` with the reason, as on every teacher screen.

## User Stories

1. As a teacher, I want to open a "New pack" editor from the Pack Library, so that I can add a topic of my own to the shared library.
2. As a teacher, I want to paste a list of words, one per line or separated by commas, so that I can reuse a list I already have.
3. As a teacher, I want to upload a `.txt` or `.csv` file of words, so that I don't have to copy and paste a long list.
4. As a teacher, I want to copy all the words of an existing pack into my new one, so that I can start from something close to what I need.
5. As a teacher, I want blank lines and repeated words (ignoring case and extra spaces) dropped automatically, so that my pack has no duplicate cards.
6. As a teacher, I want to be told how many words were added and how many duplicates or blanks were dropped, so that I trust what the editor did with my list.
7. As a teacher, I want to see my words as chips I can remove one at a time, so that I can drop a word I don't want.
8. As a teacher, I want a "Clear all" button, so that I can start the list over.
9. As a teacher, I want a running word count, plus a note on how many more words I need (at least 9) and what board size my list allows, so that I know when the pack is big enough.
10. As a teacher, I want to name my pack, so that I and my colleagues can find it in the library.
11. As a teacher, I want to add an optional learner level (with suggestions like "Year 2 undergraduate") and an optional learning objective, so that colleagues know who the pack is for.
12. As a teacher, I want a "Check pack" button that asks the server whether the pack is valid without saving it, so that I can fix problems before publishing.
13. As a teacher, I want every validation error listed in plain language, naming the part of the pack it concerns, so that I know exactly what to fix.
14. As a teacher, I want warnings shown apart from errors and not to stop me from publishing, so that optional gaps don't block me.
15. As a teacher, I want a "Publish" button that saves the pack to the shared library, so that I can use it in a game.
16. As a teacher, I want to land on the new pack's detail page after publishing, showing the version I just released, so that I can see it worked.
17. As a teacher, I want the pack id made for me from the pack name, and kept unique against every pack (including archived ones), so that I never have to invent an id or collide with a colleague's pack.
18. As a teacher, I want the Publish button disabled while publishing, so that a double click can't send two requests.
19. As a teacher, I want "Publish" refused with a clear sentence when my list has fewer than 9 words or the name is empty, with focus on what to fix, so that I don't wait for the server to tell me.
20. As a teacher, I want the server's refusal explained when someone else released the same version first (409 `PACK_ALREADY_EXISTS`), so that I know to reload and try again.
21. As a teacher, I want the server's refusal explained when I try to release a new version of a built-in System Pack (403 `PACK_IS_SYSTEM_PACK`), so that I understand why it can't be changed.
22. As a teacher, I want a structural refusal (400 `INVALID_REQUEST_BODY` or 422 `PACK_VALIDATION_FAILED`) shown with its issues, so that a pack the server rejects is never silently lost.
23. As a teacher, I want an "Edit → save as new version" action on a pack's detail page, so that I can update a pack without overwriting the version earlier games used.
24. As a teacher editing a pack, I want the editor prefilled with the pack's name and words, and the heading to name the version it will release, so that I know I'm releasing a new version, not a new pack.
25. As a teacher releasing a new version, I want the pack's Semantic Domains, Adjudication Rubric, assessment and survey kept, and the cards for words I kept left unchanged, so that a small word change doesn't wipe the pack's other content.
26. As a teacher releasing a new version, I want the new version to start unarchived even if the pack was archived, so that it shows in the library again.
27. As a teacher, I want "Cancel" to take me back without saving anything, so that I can leave the editor safely.
28. As a signed-out teacher opening `/packs/new`, I want to be sent to `/login` with the reason, so that I know to sign in first.
29. As a teacher whose Account Token expires while editing, I want a refused publish (401) to send me to `/login` with the reason, so that I'm not left on a broken screen.
30. As a teacher using a keyboard or screen reader, I want every field labelled, the added-words note announced politely, and errors announced as alerts, so that I can build a pack without a mouse.
31. As a developer debugging a refused publish, I want the API code shown in the `ErrorBanner` in development, so that I can tell refusals apart.

## Implementation Decisions

- **Keyword editor, not JSON.** Decided by the user on 2026-11-27, over a JSON editor or a keyword editor with an extra JSON tab. Teachers never see or type `CurriculumPackInput`; the app builds it.
- **Pure domain rules** (`web/src/domain/`, no React, `fetch` or storage), ported from the prototype (`account-api.js` and `shared.js`), not invented:
  - *Word cleaning:* split on newlines, commas, semicolons and tabs; trim; unquote CSV-style `"…"`; collapse inner spaces; drop blanks and case-insensitive duplicates. Return the words plus how many blanks and duplicates were dropped. A word is at most 60 characters.
  - *Board size from word count:* `floor(sqrt(n))`, clamped to 3..7 for a new pack. At least 9 distinct words (3 × 3) are needed to publish.
  - *Next Pack Version:* a minor bump of a `MAJOR.MINOR.PATCH` version ("1.1.0" → "1.2.0"); anything else becomes "1.0.0".
  - *Pack id for a new pack:* a slug of the name (lowercase ASCII, hyphens, no leading digits), made unique with `-2`, `-3`… against every pack id in the library, archived ones included.
  - *Card ids:* a slug of each word, made unique the same way.
  - *Building a new pack:* version "1.0.0". The description is level and objective joined by " · ", falling back to the title. The board config is `{ rows, cols, minChainLength: 2, adjacencyRule: "chebyshev-8" }`. There is one Semantic Domain `general` ("General"). Each card has `verbatimLabel = displayLabel = summary = word`, empty aliases and domain `general`. There is a one-line Adjudication Rubric (persona "Teacher", subject = title, one continuity criterion, no calibration examples). `assessmentInstrument` and `perceptionSurvey` are `null`.
  - *Building a new Pack Version* from the current version (a `PublicCurriculumPack`): same id, next version, and the title and description replaced only if given. Cards are matched to words by label, ignoring case: kept words keep their card unchanged, and new words get new cards in the first domain. Board rows and cols shrink to fit the word count (never below 3). Domains, rubric, assessment and survey are kept.
- **Packs API module** (from ticket 03) gains `validatePack(input)` → `{ valid, errors, warnings }` and `registerPack(input)` → `{ packId, version, warnings }`. Both send the Account Token (`AccountAuth`). Each issue is `{ path, code, message }`.
- **Hooks:** the packs hooks module gains named hooks for checking and publishing (for example `useCheckPack`, `usePublishPack`), following the react-login-screen 06 rule that only `*-hooks.ts` files import TanStack Query. A successful publish invalidates the pack list and that pack's detail query, so the library and detail page show the new version without `useEffect`.
- **Routes:** `/packs/new` (new pack), and the same editor reached from Pack Detail for a new version (a route such as `/packs/:packId/new-version`, or `/packs/new?from=:packId`; either works, but it must survive a reload). Both sit under the existing teacher guard.
- **Errors:** sentences for `PACK_ALREADY_EXISTS`, `PACK_IS_SYSTEM_PACK`, `PACK_VALIDATION_FAILED` and `INVALID_REQUEST_BODY` live in a pure domain mapping, like `login-errors`. A 401 follows the existing signed-out path (react-login-screen 05). Validation issues are listed with their `path`; the client checks (name, word count) run before any request and put focus on the field to fix.
- **File upload** reads the file in the browser (no upload to the server). Only `.txt`/`.csv`/plain text is accepted, and its text goes through the same word cleaning.
- **Look:** the prototype's editor panel (`claudPoc/concept-chain/setup.html`, section "New pack"), with styles in `shared.css` (copied to the web stylesheet). The board preview and Shuffle belong to Game Setup (ticket 05), not here.
- **No `useEffect`** (ADR-0008). Derived values (count, size note, next version) are computed during render from the pure domain helpers.

## Testing Decisions

- **One seam, chosen by the user on 2026-11-27:** the rendered screen in jsdom over the fake `fetch` (`web/tests/support/`), as for the login screen and react-web-ui 02. The pure helpers (word cleaning, pack building, next version, ids) are tested only through what the screen does and sends, not directly.
- **What makes a good test:** drive the screen by role and label as a teacher would (type or paste words, upload a file with `userEvent.upload`, click Check pack or Publish), then assert on what the teacher sees (chips, count, notes, errors, the URL after publishing) and on the requests sent (method, path, Account Token, and the body's id, version, cards and board config). Never assert on hook internals or component state.
- **Cases to cover at least:**
  - paste with duplicates and blanks gives the right chips and the right "dropped" note
  - upload of a `.csv`
  - copy words from an existing pack
  - fewer than 9 words or an empty name is refused locally with focus on the field
  - Check pack shows errors and warnings apart
  - Publish sends a correct new-pack body with a unique id (against an archived pack with the same slug) and lands on detail
  - Publish refusals: 409, 403, 422 with issues, 401 sends the teacher to login
  - new version: prefilled words, heading names the next version, the body keeps the pack's domains and rubric and kept cards, and the result shows on detail
  - the button is disabled while publishing
- **Prior art:** `web/tests/features/accounts/*.test.tsx` (screen tests over the fake fetch, refusals with focus), `web/tests/features/game-session/join-session.test.tsx`, and the ticket 03 pack screen tests once they exist.
- **Real browser:** run the `verify-diabe-teach-web` skill after implementation (it is only proven on the Lobby so far), and add a `pack-editor` feature to its map.

## Out of Scope

- A JSON or "advanced" editor for the full `CurriculumPackInput` (several Semantic Domains, aliases, card summaries, rubric criteria, calibration examples, assessment questions, survey items).
- Editing anything other than words, name, level and objective. Domains, rubric, assessment and survey of an existing pack are carried over unchanged.
- Choosing the board size or minimum chain length in the editor (Game Setup chooses the board size; ticket 05).
- Deleting packs or versions (registered Pack Versions are immutable, ADR-0006). Archiving is ticket 03.
- Uploading files to the server, or file types other than plain text and CSV.
- Server-side changes. Every route used (`POST /api/v1/packs/validate`, `POST /api/v1/packs`) already exists.

## Further Notes

- **Decision records:** ADR-0006 (registration, immutable Pack Versions, 409 on duplicates), ADR-0007 (Account Token and the shared library: any teacher may release a new version of any non-system pack), ADR-0008 (three layers, no `useEffect`).
- **Glossary:** Curriculum Pack, Pack Version, Keyword Card, Semantic Domain, Adjudication Rubric, Calibration Example, System Pack.
- **System Packs (react-web-ui open question (a), decided by the user on 2026-11-27):** the API gains an `isSystemPack` flag. "Edit → save as new version" is hidden for System Packs; the 403 sentence stays as a fallback.
- The prototype's per-card summary is just the word itself. Richer card content needs the out-of-scope advanced editor.
