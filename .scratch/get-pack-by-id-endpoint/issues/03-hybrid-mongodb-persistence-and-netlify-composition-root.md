# 03: Hybrid MongoDB Persistence (`MongoCurriculumPackRepository`) & Netlify Functions v2 Composition Root

**What to build:** Implement `MongoCurriculumPackRepository` (resolving built-in `diabe-teach` in $O(1)$ from memory with zero database queries and loading custom registered `CurriculumPack` documents from the MongoDB `curriculum_packs` collection via a warm-cached serverless `MongoClient` singleton) and wire the production Netlify Functions v2 catch-all Composition Root (`netlify/functions/api.ts` for `/api/v1/*`).

**Blocked by:** 01: Walking Skeleton — Anonymous `GET /api/v1/packs/{packId}` with Built-in `diabe-teach` Curriculum Pack & `404 PACK_NOT_FOUND`, 02: Role-Aware Assessment Answer-Key Redaction & `CapabilityToken` Verification (`200` Redacted vs. Full Key & `401 UNAUTHORIZED_TOKEN`)

**Status:** resolved

- [x] `MongoCurriculumPackRepository` returns the built-in `DIABE_TEACH_PACK` in $O(1)$ from memory without invoking `findOne` on the MongoDB collection.
- [x] When requesting a custom `packId` (e.g., `GET /api/v1/packs/cardio-teach`), `MongoCurriculumPackRepository` queries the MongoDB `curriculum_packs` collection (`findOne({ _id: "cardio-teach" })`), rehydrates the `CurriculumPack` Aggregate Root, and `GET /api/v1/packs/cardio-teach` applies the exact same role-aware answer-key redaction rules (`anonymous`/`participant` redacted, `instructor` unredacted).
- [x] When a custom `packId` is absent from both built-in packs and MongoDB, `MongoCurriculumPackRepository` returns `null` and `GET /api/v1/packs/{packId}` returns `404 Not Found` (`PACK_NOT_FOUND`).
- [x] A module-scoped MongoDB connection helper caches the `MongoClient` connection promise across warm Netlify Functions v2 invocations (`maxPoolSize: 5`).
- [x] `netlify/functions/api.ts` exports the default Web-Standard handler `(req: Request, context: unknown) => Promise<Response>` and `export const config = { path: "/api/v1/*" }`, wiring `MongoCurriculumPackRepository` and `HmacCapabilityTokenAdapter` into `createApp(deps)`.
- [x] `npm run lint:boundaries` enforces that `mongodb` is only imported in `src/adapters/driven/` and `netlify/functions/`, and `npm test` and `npm run typecheck` pass.
