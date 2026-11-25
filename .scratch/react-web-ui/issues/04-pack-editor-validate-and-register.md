# 04: Pack Editor — dry-run validate and register a pack / Pack Version

**Status:** ready-for-agent
**Blocked by:** 03

**What to build:** `packsApi.validatePack`, `registerPack`; `/packs/new` (`PackEditorPage`) with a JSON editor (keyword entry from `setup.html` editor is a stretch goal), "Validate" showing errors/warnings, "Publish" registering and navigating to `/packs/:packId`.

## Acceptance criteria
- [ ] Validation errors list each `details` field; warnings shown but don't block publish.
- [ ] Registering a new version of an existing pack shows the new version on detail page.
