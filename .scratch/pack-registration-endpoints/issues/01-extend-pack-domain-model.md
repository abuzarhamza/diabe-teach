# 01: Extend CurriculumPack domain model for registration lifecycle

**What to build:** Extend the CurriculumPack aggregate and repository port to support pack registration, archiving, and system pack protection. Add new fields (isSystemPack, isArchived, createdBy, authorName, createdAt, archivedAt) and repository methods (create, archive, unarchive, findAllActive, existsByIdAndVersion).

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Add lifecycle fields to `CurriculumPackProps` in `curriculum-pack.types.ts`
- [x] Update `CurriculumPack` aggregate to handle new fields
- [x] Extend `CurriculumPackRepositoryPort` with `create`, `archive`, `unarchive`, `findAllActive`, `existsByIdAndVersion`
- [x] Update `InMemoryCurriculumPackRepository` with new methods
- [x] Update `MongoCurriculumPackRepository` with new methods
- [x] Update Mongoose schema for new fields
- [x] Add domain errors: `PackAlreadyExistsError`, `PackIsSystemPackError`, `PackAlreadyArchivedError`, `PackNotArchivedError`
- [x] Update `GET /api/v1/packs` to use `findAllActive` (exclude archived)
- [x] Seed `diabe-teach` with `isSystemPack: true`
