# 03: `POST /api/v1/packs` - Register Curriculum Pack

**What to build:** An endpoint for instructors to register new Curriculum Packs. Validates the pack structure, checks for duplicate packId + version, stores the pack with createdBy/createdAt metadata, and returns the registered pack. Supports versioning - same packId with different version creates a new entry.

**Blocked by:** 01-extend-pack-domain-model, 02-validate-pack-endpoint

**Status:** completed

- [x] Create `RegisterCurriculumPackUseCase` in `src/application/use-cases/`
- [x] Reuse `PackValidator` from validate endpoint
- [x] Check `existsByIdAndVersion` before creating
- [x] Set `createdBy` from instructor's sessionId
- [x] Set `createdAt` to current timestamp
- [x] Set `isSystemPack: false`, `isArchived: false`
- [x] Create HTTP handler `netlify/functions/packs/register-pack.ts`
- [x] Require instructor Capability Token
- [x] Return 201 with registered pack on success
- [x] Return 409 `PACK_ALREADY_EXISTS` if duplicate
- [x] Return 422 `PACK_VALIDATION_FAILED` if invalid
- [x] Tests: happy path, duplicate version, invalid structure, missing auth
