# 01: Teacher publishes a new pack from pasted words

**What to build:** A signed-in teacher clicks **New pack** in the Pack Library and lands on `/packs/new`. The editor looks like the prototype's "New pack" panel. The teacher pastes words (one per line, or separated by commas, semicolons or tabs). Blanks and case-insensitive duplicates are dropped, and the words show as chips with a running count. The teacher enters a **Pack name**, and optionally a **Learner level** (with the prototype's suggestions) and a **Learning objective**. **Publish** registers the pack in the shared library and takes the teacher to its Pack Detail page, which shows version 1.0.0. The library list shows the new pack without a reload. **Cancel** returns to the library without saving. The editor sits under the existing teacher guard.

The pack body is built by a pure UI-domain rule ported from the prototype (`packInput` and `cleanKeywords`; see spec, Implementation Decisions):
- version 1.0.0
- one Semantic Domain `general`, and one card per word
- a one-line Adjudication Rubric
- `minChainLength` 2, Chebyshev-8
- board size `floor(sqrt(n))`, clamped to 3..7
- no assessment and no survey

The pack id is a slug of the name, made unique with `-2`, `-3`… against every pack id, archived ones included.

This tracer also adds the register call to the packs API module, and a named publish hook that invalidates the pack list and the pack's detail query.

**Blocked by:** react-web-ui 03 (Pack Library and Pack Detail: the packs API module, pack hooks, the `/packs` and `/packs/:packId` screens)

**Status:** done

**Spec:** `../spec.md`

- [x] Screen test (rendered `/packs/new` over the fake fetch): paste with a duplicate in other case and a blank line → one chip per distinct word, and the count is right.
- [x] Screen test: Publish sends `POST /api/v1/packs` with the Account Token. Its body has the slug id, version 1.0.0, one card per word, the `general` domain, and a board size that matches the word count.
- [x] Screen test: when the slug is taken by an **archived** pack, the id gets `-2` (the list is read with `includeArchived=true`).
- [x] Screen test: after a 201, the teacher is on `/packs/<packId>` and the library query is invalidated (no `useEffect`).
- [x] Screen test: fewer than 9 distinct words, or an empty name, gives a plain sentence with focus on the field to fix, and the fake `fetch` is never called for registering.
- [x] Screen test: a signed-out teacher opening `/packs/new` is sent to `/login` with the reason.
- [x] Only `*-hooks.ts` files import TanStack Query. The pack-building and id rules are pure UI-domain code (no React, no fetch).
- [x] Manual check in Chrome against `dev:prototype` (no `VITE_API_KEY`): publish a pack and see it in the library and on its detail page.

## Comments

**2026-11-27 (built):**
- `web/src/domain/pack-editor.ts` (pure): `cleanWords` (port of `cleanKeywords`, returns `{ words, empty, duplicates }`), `newPackBoardSize` (floor(sqrt(n)) clamped 3..7), `slug`, `newPackId(name, takenIds)` (no leading digits, `-2`, `-3`…), `cardIds`, `newPackProblem` (fewer than 9 words → focus `words`; empty name → focus `name`; words are checked first, as in the prototype), `newPackInput(draft, takenIds)` (port of `packInput` without `base`). **Ticket 04** adds the `base` variant and `nextVersion` here; `cardIds(words, taken)` already takes the taken set it needs.
- `web/src/api/packs-api.ts`: `CurriculumPackInput`, `PackValidationIssue`, `PackRegistered`, `registerPack(input)` (Account Token; local 401 when signed out). `validatePack` is left for ticket 03.
- `web/src/features/packs/pack-hooks.ts`: `usePublishPack()`. `mutate(draft)` reads `GET /api/v1/packs?includeArchived=true` (fresh, not from the cache) for the taken ids, builds the pack and registers it; `onSuccess` invalidates `packKeys.all` (list and detail). The screen navigates in `mutate(..., { onSuccess })`, after the refetch.
- `PackEditorPage` (`/packs/new`, under `TeacherRoute`): Paste words + `Add pasted words` (the paste box clears after adding), chips in `ul "Words in the new pack"`, the "N words" count, Pack name, Learner level (datalist with the prototype's suggestions), Learning objective, local refusal as a `role="alert"` with focus, `Publish` (disabled while pending), `Cancel` (a link to `/packs`). Server refusals show in `ErrorBanner` through `packRefusalSentence` (unknown codes keep the server's message); ticket 03 owns the publish-refusal sentences and issue lists. The Pack Library has a `New pack` link; the TopBar has `nav "Teacher screens"` with a `Packs` link (chief-of-staff extra scope; test in `top-bar.test.tsx`). Editor CSS from `setup.html`/`shared.css` appended to `web/src/styles.css`.
- Tests: `web/tests/features/packs/pack-editor.test.tsx` (9 screen tests). Not met as written: "the library query is invalidated" is proved by the outcome (Back to the Pack Library lists the new pack), but with TanStack's default `staleTime: 0` a remount refetches anyway, so removing the invalidation would not fail a test. It becomes observable once a screen keeps pack data fresh (`staleTime`) or the library stays mounted.
- Not in this ticket: the 60-character word limit from the spec (no AC here; ticket 02 or 03 should add it with its notes), Remove/Clear all/"dropped" note/upload/copy (ticket 02), Check pack (ticket 03).
- Manual check: verify-diabe-teach-web run `proof-web-pack-editor`, recipe `features/pack-editor.md`, all bullets passed (including `-2` against an archived pack).
