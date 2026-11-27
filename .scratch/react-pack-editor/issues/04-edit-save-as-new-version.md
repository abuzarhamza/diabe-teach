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

**Status:** ready-for-agent

**Spec:** `../spec.md`

- [ ] Screen test: from `/packs/<id>` (version 1.1.0), the action opens the editor prefilled with its words, and the heading names v1.2.0.
- [ ] Screen test: after removing one word and adding one, the Publish body has the same id and version 1.2.0. It keeps the original domains, rubric, assessment and survey, keeps the kept cards unchanged, and has one new card with a unique id.
- [ ] Screen test: after a 201, the detail page shows version 1.2.0, and the list and detail queries are invalidated.
- [ ] Screen test: reloading the new-version route reloads the pack and the same prefill.
- [ ] Screen test: a System Pack's detail page has no "save as new version" action.
- [ ] `verify-diabe-teach-web` has a `pack-editor` feature file listed in its README. It was run end to end once, and the evidence survived cleanup.
