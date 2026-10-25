# 16 — Using Mongoose for `MongoCurriculumPackRepository` in Hexagonal DDD

## Research Question

> *"Can we use the `mongoose` library for our outbound `export class MongoCurriculumPackRepository implements CurriculumPackRepositoryPort`?"*

---

## 1. Executive Summary: Yes — It Is a Textbook Hexagonal Outbound Adapter Swap

**Yes.** Replacing or wrapping the low-level `mongodb` driver with **`mongoose`** inside `src/adapters/outbound/` preserves our Hexagonal DDD architecture **100% intact**:

1. **Zero Impact on Domain or Application Rings (`src/domain/`, `src/application/`)**:
   - [`src/application/ports/curriculum-pack-repository.port.ts`](../src/application/ports/curriculum-pack-repository.port.ts) defines the Outbound Port purely in terms of Domain types:
     ```ts
     export interface CurriculumPackRepositoryPort {
       findById(packId: PackId): Promise<CurriculumPack | null>;
     }
     ```
   - Neither `CurriculumPack`, `PackId`, nor `GetCurriculumPackByIdUseCase` knows whether `MongoCurriculumPackRepository` queries MongoDB via raw `mongodb` (`Collection<CurriculumPackDocument>`) or via `mongoose` (`Model<CurriculumPackDocument>`).
2. **Enforced by `dependency-cruiser` (`npm run lint:boundaries`)**:
   - Updating the `mongodb-isolated-to-outbound-adapters` rule in [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) to match `node_modules/(mongodb|mongoose)` guarantees that Mongoose `Schema`, `Model`, and `HydratedDocument` types can never leak out of `src/adapters/outbound/` into `src/domain/`, `src/application/`, or `src/adapters/inbound/`.
3. **Eliminates Manual `getCollection` Boilerplate while Adding Schema Enforcement & Optimistic Concurrency**:
   - Instead of manually calling `db.collection<CurriculumPackDocument>("curriculum_packs")`, a compiled Mongoose `Model<CurriculumPackDocument>` binds the collection name (`curriculum_packs`), schema definition (`_id: { type: String, required: true }`), and query helpers (`model.findOne({ _id: packId.value }).lean().exec()`) into a clean construct inside `src/adapters/outbound/`.

---

## 2. Primary Source Grounding

1. **Mongoose Official AWS Lambda / Serverless Guide ([`mongoosejs.com/docs/lambda.html`](https://mongoosejs.com/docs/lambda.html))**:
   - Recommends caching the connection promise (`mongoose.createConnection(uri, { dbName, maxPoolSize: 5, serverSelectionTimeoutMS: 5000 }).asPromise()`) at module/class scope across warm serverless invocations so `mongoose` reuses the underlying connection pool rather than opening a new socket per request.
2. **Mongoose Official `.lean()` Guide ([`mongoosejs.com/docs/lean.html`](https://mongoosejs.com/docs/lean.html))**:
   - By default, Mongoose queries instantiate a heavy `HydratedDocument` class with change tracking, getters/setters, and state machine overhead (~5–10x heavier in memory and CPU than a plain JS object).
   - Chaining **`.lean()`** (`await model.findOne({ _id: packId.value }).lean().exec()`) instructs Mongoose to skip instantiating a `HydratedDocument` and return a plain old JavaScript object (POJO) directly from the MongoDB cursor.
   - In **Hexagonal DDD**, `.lean()` is essential: our repository immediately maps the persistence POJO into our own rich Domain Aggregate Root (`CurriculumPack.create(...)`). Using `.lean()` avoids paying the CPU/memory cost of double-hydrating both a Mongoose `HydratedDocument` and a DDD `CurriculumPack` Aggregate Root.
3. **Mongoose Official TypeScript Guide ([`mongoosejs.com/docs/typescript.html`](https://mongoosejs.com/docs/typescript.html))**:
   - Supports defining a strict persistence document interface (`CurriculumPackDocument` with `_id: string`) and passing it as the generic parameter to `new Schema<CurriculumPackDocument>(...)` and `connection.model<CurriculumPackDocument>("CurriculumPack", curriculumPackSchema)`.
   - Prevents `OverwriteModelError` across warm invocations via `connection.models.CurriculumPack ?? connection.model<CurriculumPackDocument>("CurriculumPack", curriculumPackSchema)`.
4. **Mongoose Schema Guide — Optimistic Concurrency ([`mongoosejs.com/docs/guide.html#optimisticConcurrency`](https://mongoosejs.com/docs/guide.html#optimisticConcurrency) & [`versionKey`](https://mongoosejs.com/docs/guide.html#versionKey))**:
   - Supports customizing the version field (`versionKey: "version"`, `optimisticConcurrency: true`) for mutable aggregates like `GameSession`, aligning with `ADR-0002` and `docs/agents/api-architecture.md` §5.

---

## 3. How `MongoConnectionManager` and `MongoCurriculumPackRepository` Look with Mongoose

### A. `MongoConnectionManager` (`src/adapters/outbound/mongo-client-singleton.ts`)

```ts
import mongoose, { Connection } from "mongoose";

export class MongoConnectionManager {
  static readonly #cachedConnections = new Map<string, Promise<Connection>>();

  public static async getConnection(
    uri: string,
    dbName = "diabe_teach",
  ): Promise<Connection> {
    const cacheKey = `${uri}::${dbName}`;
    let connPromise = MongoConnectionManager.#cachedConnections.get(cacheKey);
    if (!connPromise) {
      const connection = mongoose.createConnection(uri, {
        dbName,
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      });
      connPromise = connection.asPromise().catch((err: unknown) => {
        MongoConnectionManager.#cachedConnections.delete(cacheKey);
        throw err;
      });
      MongoConnectionManager.#cachedConnections.set(cacheKey, connPromise);
    }
    return connPromise;
  }
}
```

### B. `MongoCurriculumPackRepository` (`src/adapters/outbound/mongo-curriculum-pack-repository.ts`)

```ts
const curriculumPackSchema = new Schema<CurriculumPackDocument>(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    version: { type: String, required: true },
    description: { type: String },
    boardConfig: { type: Schema.Types.Mixed, required: true },
    domains: { type: [Schema.Types.Mixed], required: true },
    cards: { type: [Schema.Types.Mixed], required: true },
    adjudicationRubric: { type: Schema.Types.Mixed, required: true },
    assessmentInstrument: { type: Schema.Types.Mixed },
    perceptionSurvey: { type: Schema.Types.Mixed },
  },
  {
    collection: CURRICULUM_PACKS_COLLECTION,
    versionKey: false,
  },
);
```

And inside `MongoCurriculumPackRepository.fromConfig(config)`:
```ts
const connection = await MongoConnectionManager.getConnection(
  config.mongoUri,
  config.mongoDbName ?? DEFAULT_MONGODB_DB_NAME,
);
const model = MongoCurriculumPackRepository.getModel(connection);
return {
  findOne: async (filter: { readonly _id: string }) =>
    model.findOne(filter).lean<CurriculumPackDocument | null>().exec(),
};
```

---

## 4. Exact Configuration Changes Required to Adopt `mongoose`

1. **`package.json`**:
   - Install `mongoose` (`npm install mongoose`).
2. **`.dependency-cruiser.cjs`**:
   - Update `mongodb-isolated-to-outbound-adapters` to guard `node_modules/(mongodb|mongoose)` so Mongoose is strictly isolated inside `src/adapters/outbound/`.

---

## References

- [Mongoose Official Guide: Using Mongoose With AWS Lambda](https://mongoosejs.com/docs/lambda.html)
- [Mongoose Official Guide: Faster Mongoose Queries With `.lean()`](https://mongoosejs.com/docs/lean.html)
- [Mongoose Official Guide: Using TypeScript with Mongoose](https://mongoosejs.com/docs/typescript.html)
- [Mongoose Official Guide: Schemas & `optimisticConcurrency` / `versionKey`](https://mongoosejs.com/docs/guide.html)
- Vaughn Vernon, *Implementing Domain-Driven Design* (Ch. 12: Repositories — separating persistence models from Domain Aggregate Roots)
