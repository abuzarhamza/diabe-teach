# 04: Edit → save as new version

**What to build:** On a pack's Pack Detail page, **Edit → save as new version** opens the editor for that pack. The route must survive a reload. The editor is filled with the pack's name and the labels of its cards. The heading names the version it will release, for example "Edit “Diabetes basics” → save as v1.2.0", a minor bump; any version not in `MAJOR.MINOR.PATCH` form becomes 1.0.0.

Publish registers a new Pack Version under the **same pack id**, built by a pure UI-domain rule ported from the prototype's `packInput` with a base pack:
- The pack's Semantic Domains, Adjudication Rubric, assessment and survey are kept.
- Cards for kept words (matched by label, ignoring case) are unchanged.
- New words get new unique card ids in the first domain.
- Board rows and cols shrink to fit the word count, never below 3.
- Title and description are replaced only if given.

The teacher then lands on the detail page showing the new version, which starts unarchived even if the pack was archived. The action is hidden for System Packs (`isSystemPack`, decided by the user on 2026-11-27); a 403 is still explained by ticket 03's sentence as a fallback.

This ticket also adds a `pack-editor` feature (new pack and new version) to the `verify-diabe-teach-web` skill's map and runs it once in Chrome.

**Blocked by:** 01 (Teacher publishes a new pack from pasted words)

**Status:** done

**Spec:** `../spec.md`

- [x] Screen test: from `/packs/<id>` (version 1.1.0), the action opens the editor prefilled with its words, and the heading names v1.2.0.
- [x] Screen test: after removing one word and adding one, the Publish body has the same id and version 1.2.0. It keeps the original domains, rubric, assessment and survey, keeps the kept cards unchanged, and has one new card with a unique id.
- [x] Screen test: after a 201, the detail page shows version 1.2.0, and the list and detail queries are invalidated.
- [x] Screen test: reloading the new-version route reloads the pack and the same prefill.
- [x] Screen test: a System Pack's detail page has no "save as new version" action.
- [x] `verify-diabe-teach-web` has a `pack-editor` feature file listed in its README. It was run end to end once, and the evidence survived cleanup.

## Comments

**2026-11-27 (built):**
- `web/src/domain/pack-editor.ts` gains `nextVersion(version)` and `packVersionInput(draft, base)` (port of the prototype's `packInput` with `base`). Its body lists only CurriculumPackInput's ten fields, never a spread of the base, so `isSystemPack` (and any later response-only field) is stripped; `assessmentInstrument`/`perceptionSurvey` default to `null`. Kept cards match by `displayLabel || verbatimLabel`, ignoring case; new card ids are made unique against the kept cards' ids only (as the prototype). Board side = max(3, min(base rows, floor(sqrt(n)))) for both rows and cols.
- `pack-hooks.ts`: `PackEditorDraft = NewPackDraft & { base? }`; `draftPackInput` branches on `base` (no id lookup for a new version), so `useCheckPack` and `usePublishPack` both follow.
- Route `/packs/:packId/new-version` → `PackVersionEditorPage` (reads the pack with `usePack`, so a reload refills it; loading note and 404 banner otherwise). `PackEditor` is the shared component; it freezes `base` in `useState` so the post-publish refetch doesn't change the heading before navigating. Prefill is from `useState` initialisers (no `useEffect`). Level/objective start empty (the description is kept unless typed). Pack Detail shows `Edit → save as new version` unless `isSystemPack`.
- Tests: 7 new screen tests in `pack-editor.test.tsx` (34 in all). The invalidation test records which route each request was sent from and asserts the list and detail were re-read while still on the editor; deleting `onSuccess: refreshPacks` fails it (checked).
- Not met / caveats: the base pack is read without an instructor token, so assessment answer keys (`correctIndex`, `explanation`) are absent and the new version carries the redacted questions (the prototype did the same). A pack whose questions had keys loses them in the new version; needs an instructor-token read or a server-side carry-over. The chip list is still named "Words in the new pack" in version mode.
- Manual check: run `proof-web-pack-editor-04`, recipe bullets `version-open`, `version-reload`, `version-publish`, `version-unarchived` (archived pack came back unarchived at v1.1.0), `version-system-pack-hidden`, all passed.
