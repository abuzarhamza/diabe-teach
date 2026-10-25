# 17 — Pure MongoDB Persistence Without In-Memory Built-In Fallback

**Document Target**: `wiki/17-pure-mongodb-persistence-without-in-memory-fallback.md`  
**Related ADRs**: `docs/adr/0001`, `docs/adr/0002`  
**Related Specs**: `.scratch/get-pack-by-id-endpoint/spec.md`, `docs/agents/api-architecture.md`

---

## 1. Executive Summary

Removing hardcoded in-memory built-in pack logic (`builtInPacks`, `DIABE_TEACH_PACK`, and constructor seed branching) from `MongoCurriculumPackRepository` is an architectural and operational improvement that aligns our codebase with canonical **Domain-Driven Design (DDD)**, **Hexagonal Architecture (Ports & Adapters)**, and **Serverless Database Best Practices**:

1. **Repository Purity & Single Responsibility**: An Outbound Persistence Adapter's sole responsibility is translating between the database model and domain aggregate roots. Harboring hardcoded domain aggregates within a database adapter violates Single Responsibility, creates a "dual source of truth", and prevents runtime database updates to `diabe-teach` from taking effect.
2. **Proper Role for `DIABE_TEACH_PACK`**: `DIABE_TEACH_PACK` belongs in the **Domain Ring** as the canonical clinical domain definition (Shadan et al. 2025) and serves as:
   - The master database seed payload for deployment/migration scripts (`scripts/seed-curriculum-packs.ts`).
   - The primary test fixture for lightning-fast unit and acceptance tests via `InMemoryCurriculumPackRepository([DIABE_TEACH_PACK])`.
3. **Code Simplification**: `MongoCurriculumPackRepository.findById` simplifies from a stateful, branching fallback method into a pure 3-line query:
   ```ts
   public async findById(packId: PackId): Promise<CurriculumPack | null> {
     const collection = await this.#getCollection();
     const doc = await collection.findOne({ _id: packId.value });
     return doc ? MongoCurriculumPackRepository.#toDomain(doc) : null;
   }
   ```
4. **Serverless Efficiency**: Netlify Functions v2 (running on AWS Lambda) caches MongoDB connection pools across warm invocations via `MongoConnectionManager` (`maxPoolSize: 5`). MongoDB queries by primary key (`_id: "diabe-teach"`) leverage the default unique clustered index, executing in `<1ms`. Read caching is cleanly handled at the HTTP transport layer (`ETag` / `Cache-Control`) without polluting repository internals.

---

## 2. Why Eliminating Built-In In-Memory Fallback Solves Key Problems

### 2.1 The "Dual Source of Truth" Anti-Pattern
Previously, `MongoCurriculumPackRepository` checked `#builtInPacks.get(packId.value)` before querying MongoDB. If `packId.value === "diabe-teach"`, MongoDB was never consulted.

This created operational liabilities:
- **Shadowed Production Updates**: If an educator or administrator corrected a typo or added new assessment items to `diabe-teach` in MongoDB Atlas, the production API silently ignored the database and served the compile-time snapshot.
- **Hidden Connection Failures**: If `MONGODB_URI` was misconfigured or Atlas was down, requests for `/api/v1/packs/diabe-teach` succeeded while requests for other packs failed, masking infrastructure issues.
- **Stateful Contamination**: In Hexagonal Architecture (Alistair Cockburn), Driven Adapters are stateless plumbing. Storing an in-memory `Map` inside a database adapter blurs the boundary between persistence and domain data.

### 2.2 DDD Aggregate Root Purity (Evans & Vernon)
According to Eric Evans (*Domain-Driven Design*, Ch. 6 & 12) and Vaughn Vernon (*Implementing Domain-Driven Design*, Ch. 12):
> *"A repository represents all objects of a certain type as a conceptual set... The repository mechanism itself must not hardcode entities."*

By removing in-memory aggregates from `MongoCurriculumPackRepository`:
- **Persistence Boundary Separation**: The repository's contract is purely: *Given a `PackId`, fetch the document from `curriculum_packs` and map to `CurriculumPack` aggregate root.*
- **Clean Inversion of Control**: The application decides which repository to inject. For unit tests, `InMemoryCurriculumPackRepository` provides zero-I/O in-memory collections; for production, `MongoCurriculumPackRepository` queries MongoDB.

---

## 3. Simplified Repository Structure

```ts
export class MongoCurriculumPackRepository implements CurriculumPackRepositoryPort {
  public static readonly modelName = CURRICULUM_PACK_MODEL_NAME;
  public static readonly collectionName = CURRICULUM_PACKS_COLLECTION;

  readonly #getCollection: () => Promise<CurriculumPackCollectionLike>;

  public constructor(options: MongoCurriculumPackRepositoryOptions) {
    this.#getCollection = options.getCollection;
  }

  public static getModel(connection: Connection): Model<CurriculumPackDocument> {
    return (
      (connection.models[CURRICULUM_PACK_MODEL_NAME] as Model<CurriculumPackDocument> | undefined) ??
      connection.model<CurriculumPackDocument>(
        CURRICULUM_PACK_MODEL_NAME,
        curriculumPackSchema,
        CURRICULUM_PACKS_COLLECTION,
      )
    );
  }

  public static fromConfig(config: MongoCurriculumPackConnectionConfig): MongoCurriculumPackRepository {
    return new MongoCurriculumPackRepository({
      getCollection: async () => {
        if (!config.mongoUri) {
          throw new Error("MONGODB_URI environment variable is required to query Curriculum Packs.");
        }
        const connection = await MongoConnectionManager.getConnection(
          config.mongoUri,
          config.mongoDbName ?? DEFAULT_MONGODB_DB_NAME,
        );
        const model = MongoCurriculumPackRepository.getModel(connection);
        return {
          findOne: async (filter) =>
            model.findOne(filter).lean<CurriculumPackDocument | null>().exec(),
        };
      },
    });
  }

  public async findById(packId: PackId): Promise<CurriculumPack | null> {
    const collection = await this.#getCollection();
    const doc = await collection.findOne({ _id: packId.value });
    return doc ? MongoCurriculumPackRepository.#toDomain(doc) : null;
  }

  static #toDomain(doc: CurriculumPackDocument): CurriculumPack {
    return CurriculumPack.create({
      id: doc._id,
      title: doc.title,
      version: doc.version,
      description: doc.description,
      boardConfig: doc.boardConfig,
      domains: doc.domains,
      cards: doc.cards,
      adjudicationRubric: doc.adjudicationRubric,
      assessmentInstrument: doc.assessmentInstrument,
      perceptionSurvey: doc.perceptionSurvey,
    });
  }
}
```

---

## 4. Canonical Roles for `DIABE_TEACH_PACK`

```
src/domain/curriculum-pack/diabe-teach-pack.ts (Canonical Domain Aggregate)
    │
    ├──▶ scripts/seed-curriculum-packs.ts ──────▶ MongoDB Atlas ("curriculum_packs" collection)
    │                                                   ▲
    │                                                   │ queries at runtime
    │                                                   ▼
    │                                     MongoCurriculumPackRepository
    │
    └──▶ tests/ ────────────────────────────────▶ InMemoryCurriculumPackRepository([DIABE_TEACH_PACK])
```

1. **Domain Aggregate Definition**:
   `src/domain/curriculum-pack/diabe-teach-pack.ts` remains the master, immutable definition of the Shadan et al. 2025 curriculum pack.
2. **Database Seeding Script (`scripts/seed-curriculum-packs.ts`)**:
   An idempotent database seed script connects to MongoDB via `MongoConnectionManager` and upserts `DIABE_TEACH_PACK` into the `curriculum_packs` collection.
3. **In-Memory Test Repository (`InMemoryCurriculumPackRepository`)**:
   For domain, application use-case, and HTTP integration unit tests, `new InMemoryCurriculumPackRepository([DIABE_TEACH_PACK])` provides instant, deterministic execution without requiring a live MongoDB server.
