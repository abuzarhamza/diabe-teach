# 09: Consolidate MongoDB Collection Wiring into `src/adapters/outbound/`, Move Runtime Config into `src/config/`, and Remove `netlify/config/`

**What to build:** Encapsulate all MongoDB collection and connection wiring (`DEFAULT_MONGODB_DB_NAME`, `CURRICULUM_PACKS_COLLECTION`, `getMongoDatabase`) inside `src/adapters/outbound/`, move runtime environment and dependency configuration into `src/config/`, and delete `netlify/config/` so that `netlify/functions/api.ts` is the sole file under `netlify/`.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08 (all completed)

**Status:** done

- [x] `MongoCurriculumPackRepository` in `src/adapters/outbound/` owns `DEFAULT_MONGODB_DB_NAME` (`"diabe_teach"`), `CURRICULUM_PACKS_COLLECTION` (`"curriculum_packs"`), and `getMongoDatabase` connection wiring via `MongoCurriculumPackRepository.fromConfig` (with contract types in `mongo-curriculum-pack-repository.types.ts`), so no file outside `src/adapters/outbound/` imports `getMongoDatabase` or `CurriculumPackDocument`.
- [x] Runtime environment parsing and production dependency wiring live inside `src/config/runtime.types.ts` and `src/config/runtime.config.ts` (following the strict separation between `*.types.ts` contract files and implementation files).
- [x] `netlify/config/` (`create-netlify-function-handler.ts`, `netlify-runtime.config.ts`, `netlify-runtime.types.ts`) is completely deleted, and `netlify/functions/api.ts` is the only file in `netlify/`.
- [x] `.dependency-cruiser.cjs` enforces that `src/config/` is the only folder inside `src/` allowed to wire `src/adapters/inbound/` and `src/adapters/outbound/` together, and `mongodb` is strictly isolated to `src/adapters/outbound/`.
- [x] All unit, integration, and boundary tests (`npm test`, `npm run typecheck`, `npm run lint:boundaries`) pass with zero violations.
