# Spec: `GET /api/v1/packs` — List Curriculum Packs Endpoint

Status: completed

## Problem Statement

The ConceptChain dashboard prototype requires a topic dropdown populated with available Curriculum Packs. Frontend clients need to fetch a list of registered Curriculum Packs with summary metadata (title, version, subject domain, board configuration, card/domain counts, and feature flags for assessment/survey availability) to populate navigation controls and display pack selection options.

## Solution

Implement `GET /api/v1/packs` endpoint following the established hexagonal architecture pattern with Middy middleware, returning an array of `CurriculumPackSummaryDto` objects containing metadata sufficient for UI rendering without transferring full pack payloads.

## User Stories

1. As a medical educator browsing available topics, I want to see a list of all registered Curriculum Packs with their titles and subject domains, so that I can select the appropriate pack for my classroom session.
2. As a frontend developer rendering a topic dropdown, I want to fetch pack summaries with `cardCount` and `domainCount`, so that I can display pack complexity indicators without loading full card arrays.
3. As an API consumer, I want the pack list endpoint to return board configuration metadata (`rows`, `cols`, `minChainLength`, `adjacencyRule`), so that I can pre-configure UI grid layouts.
4. As a curriculum administrator, I want to see `hasAssessmentInstrument` and `hasPerceptionSurvey` flags for each pack, so that I can identify which packs support pre/post testing workflows.
5. As an API consumer with a valid `x-api-key`, I want the pack list endpoint to be accessible, so that authenticated clients can browse available curricula.
6. As an API consumer without a valid `x-api-key` when `API_KEY` is configured, I want to receive `401 Unauthorized`, so that unauthenticated access is blocked.

## Implementation Decisions

### Architecture Stack (Following Established Pattern)

- **HTTP Handler** (`netlify/functions/packs/list-packs.ts`): Netlify Functions v2 with Middy middleware pipeline
- **Middleware Stack**: `httpHeaderNormalizer` → `authMiddleware` → `domainErrorMiddleware`
- **Use Case** (`src/application/use-cases/list-curriculum-packs.use-case.ts`): Simple orchestration calling repository and projecting DTOs
- **Port Definition** (`src/application/ports/list-curriculum-packs.port.ts`): `ListCurriculumPacksDependencies`, `ListCurriculumPacksResult`, `ListCurriculumPacksUseCasePort`
- **DTO Type** (`src/application/dtos/curriculum-pack.dto.ts`): Added `CurriculumPackSummaryDto`
- **Projector Method** (`src/application/dtos/curriculum-pack-projector.ts`): Added `CurriculumPackProjector.toSummaryDto(pack)`

### Repository Port Extension

```typescript
// src/application/ports/curriculum-pack-repository.port.ts
export interface CurriculumPackRepositoryPort {
  findById: (packId: PackId) => Promise<CurriculumPack | null>;
  findAll: () => Promise<readonly CurriculumPack[]>;  // NEW
}
```

### Collection Interface Extension (MongoDB)

```typescript
// src/adapters/outbound/mongo-curriculum-pack-repository.types.ts
export interface CurriculumPackCollectionLike {
  findOne: (filter: { readonly _id: string }) => Promise<CurriculumPackDocument | null>;
  find: () => Promise<readonly CurriculumPackDocument[]>;  // NEW
}
```

### Summary DTO Shape (OpenAPI `CurriculumPackSummary`)

```typescript
export interface CurriculumPackSummaryDto {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  readonly subjectDomain: string;           // From adjudicationRubric.subjectDomain
  readonly boardConfig: BoardConfig;
  readonly cardCount: number;               // Derived: cards.length
  readonly domainCount: number;             // Derived: domains.length
  readonly hasAssessmentInstrument: boolean; // Derived: assessmentInstrument !== null
  readonly hasPerceptionSurvey: boolean;     // Derived: perceptionSurvey !== null
}
```

### Response Shape

```json
{
  "packs": [
    {
      "id": "diabe-teach",
      "title": "Diabe-teach: Undergraduate Diabetes Mellitus Clinical Reasoning",
      "version": "1.0.0",
      "subjectDomain": "Undergraduate Diabetes Mellitus",
      "boardConfig": { "rows": 7, "cols": 7, "minChainLength": 4, "adjacencyRule": "chebyshev-8" },
      "cardCount": 49,
      "domainCount": 7,
      "hasAssessmentInstrument": true,
      "hasPerceptionSurvey": true
    }
  ]
}
```

## Testing Decisions

### Testing Seam

Tests execute at the **HTTP handler level** using the factory function `createListPacksHandler(deps)` that accepts injected dependencies, consistent with existing `createGetPackByIdHandler` pattern.

### Test Cases Implemented

1. **Happy path**: Returns 200 with array of pack summaries
2. **Empty state**: Returns 200 with empty `packs` array when no packs registered
3. **API key required**: Returns 401 when `requireApiKey: true` and no `x-api-key` header
4. **API key provided**: Returns 200 when valid `x-api-key` matches configured key

### Prior Art

- `tests/functions/get-pack-by-id.test.ts` - Handler factory pattern with dependency injection
- `tests/functions/get-pack-by-id-comprehensive.test.ts` - API key validation scenarios

## Out of Scope

- Pagination (not needed for small pack collections)
- Filtering/search (all packs returned)
- Sorting (client-side responsibility)
- Caching headers (future optimization)

## Further Notes

### Files Created

- `netlify/functions/packs/list-packs.ts` - HTTP handler
- `src/application/use-cases/list-curriculum-packs.use-case.ts` - Use case
- `src/application/ports/list-curriculum-packs.port.ts` - Port definition
- `tests/functions/list-packs.test.ts` - Tests (4 passing)

### Files Modified

- `src/application/ports/curriculum-pack-repository.port.ts` - Added `findAll()` method
- `src/application/dtos/curriculum-pack.dto.ts` - Added `CurriculumPackSummaryDto` type
- `src/application/dtos/curriculum-pack-projector.ts` - Added `toSummaryDto()` method
- `src/adapters/outbound/mongo-curriculum-pack-repository.ts` - Implemented `findAll()`
- `src/adapters/outbound/mongo-curriculum-pack-repository.types.ts` - Added `find()` to collection interface
- `src/adapters/outbound/in-memory-curriculum-pack-repository.ts` - Implemented `findAll()`

### OpenAPI Contract

Defined in `docs/api/openapi.yaml`:
- `operationId: listCurriculumPacks`
- Path: `GET /api/v1/packs`
- Response schema: `{ packs: CurriculumPackSummary[] }`
