# 11: Refactor `MongoCurriculumPackRepository` and `MongoConnectionManager` to Use `mongoose` Schema & Model with `.lean()`

**What to build:** Use the `mongoose` library inside `src/adapters/outbound/` (`MongoConnectionManager` and `MongoCurriculumPackRepository`) to define a typed `curriculumPackSchema` (`_id: { type: String, required: true }`, `collection: "curriculum_packs"`) and query custom packs via `model.findOne({ _id }).lean().exec()`, while keeping `mongoose` strictly isolated to `src/adapters/outbound/` via `.dependency-cruiser.cjs`.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09, 10 (all completed)

**Status:** done

- [x] `mongoose` is installed in `package.json` and guarded by `.dependency-cruiser.cjs` (`node_modules/(mongodb|mongoose)`) so it can only be imported inside `src/adapters/outbound/`.
- [x] `MongoConnectionManager` in `src/adapters/outbound/mongo-client-singleton.ts` caches warm `mongoose.Connection` promises (`mongoose.createConnection(uri, { dbName, maxPoolSize: 5, serverSelectionTimeoutMS: 5000 }).asPromise()`) and evicts failed connections on error.
- [x] `MongoCurriculumPackRepository` in `src/adapters/outbound/mongo-curriculum-pack-repository.ts` defines `curriculumPackSchema` (`new Schema<CurriculumPackDocument>({ _id: { type: String, required: true }, ... })`), exposes `MongoCurriculumPackRepository.getModel(connection)`, and wires `MongoCurriculumPackRepository.fromConfig(config)` using `model.findOne(filter).lean<CurriculumPackDocument | null>().exec()`.
- [x] All unit, integration, and boundary tests (`npm test`, `npm run typecheck`, `npm run lint:boundaries`) pass with zero violations.
