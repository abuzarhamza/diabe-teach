# 04: Pack Editor — dry-run validate and register a pack / Pack Version

**Status:** ready-for-agent
**Blocked by:** 03
**Detailed spec:** `.scratch/react-pack-editor/spec.md` (2026-11-27; supersedes the "What to build" and acceptance criteria below: a keyword editor like the prototype, not a JSON editor, tested as rendered screens only).

**What to build:** `packsApi.validatePack`, `registerPack` (with hooks in `features/packs/pack-hooks.ts`); `/packs/new` (`PackEditorPage`) with a JSON editor (keyword entry from `setup.html` editor is a stretch goal), "Validate" showing errors/warnings, "Publish" registering and navigating to `/packs/:packId`.

## Acceptance criteria
- [ ] Tested as a rendered `/packs/new` screen over the fake fetch (`web/tests/features/packs/pack-editor.test.tsx`).
- [ ] Validation errors list each `details` field; warnings shown but don't block publish.
- [ ] Registering a new version of an existing pack shows the new version on detail page.
