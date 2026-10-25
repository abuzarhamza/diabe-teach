# 12: Remove In-Memory Built-In Packs from `MongoCurriculumPackRepository` and Add Seeding Script

**What to build:** Refactor `MongoCurriculumPackRepository` to be a pure database persistence adapter that fetches 100% of packs from MongoDB (with no `#builtInPacks` map or in-memory fallback), and provide an idempotent database seeding script (`scripts/seed-curriculum-packs.ts`) using the canonical `DIABE_TEACH_PACK` domain aggregate.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11 (all completed)

**Status:** done

- [x] `MongoCurriculumPackRepository` removes all `#builtInPacks` in-memory state, constructor seed loops, and `DIABE_TEACH_PACK` imports, querying MongoDB via `findOne({ _id: packId.value })` for every requested pack.
- [x] `MongoCurriculumPackRepositoryOptions` and `MongoCurriculumPackConnectionConfig` in `mongo-curriculum-pack-repository.types.ts` remove optional `builtInPacks?: readonly CurriculumPack[]`.
- [x] `scripts/seed-curriculum-packs.ts` provides an idempotent script that connects to MongoDB via `MongoConnectionManager` and upserts `DIABE_TEACH_PACK` into the `curriculum_packs` collection, and `package.json` provides `"db:seed"`.
- [x] All unit, integration, and boundary tests (`npm test`, `npm run typecheck`, `npm run lint:boundaries`) pass with zero violations.
