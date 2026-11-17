# 05: `POST /api/v1/packs/{packId}/unarchive` - Restore Archived Pack

**What to build:** An endpoint for instructors to restore an archived Curriculum Pack, making it visible in the pack list again. Only works on archived packs. Returns the updated pack state.

**Blocked by:** 01-extend-pack-domain-model, 04-archive-pack-endpoint

**Status:** completed

- [x] Create `UnarchiveCurriculumPackUseCase` in `src/application/use-cases/`
- [x] Check pack exists (404 if not)
- [x] Check pack is archived (409 `PACK_NOT_ARCHIVED` if not)
- [x] Set `isArchived: false`, `archivedAt: null`
- [x] Create HTTP handler `netlify/functions/packs/unarchive-pack.ts`
- [x] Require instructor Capability Token
- [x] Return 200 with updated pack state
- [x] Tests: happy path, not archived error, not found
