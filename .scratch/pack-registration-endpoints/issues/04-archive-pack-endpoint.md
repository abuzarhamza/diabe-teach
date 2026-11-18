# 04: `POST /api/v1/packs/{packId}/archive` - Archive Curriculum Pack

**What to build:** An endpoint for instructors to archive a Curriculum Pack, hiding it from the pack list while preserving access for existing sessions. System packs cannot be archived. Returns the updated pack state.

**Blocked by:** 01-extend-pack-domain-model

**Status:** completed

- [x] Create `ArchiveCurriculumPackUseCase` in `src/application/use-cases/`
- [x] Check pack exists (404 if not)
- [x] Check pack is not a system pack (403 if it is)
- [x] Check pack is not already archived (409 if it is)
- [x] Set `isArchived: true`, `archivedAt: new Date()`
- [x] Create HTTP handler `netlify/functions/packs/archive-pack.ts`
- [x] Require instructor Capability Token
- [x] Return 200 with updated pack state
- [x] Tests: happy path, system pack rejection, already archived, not found
