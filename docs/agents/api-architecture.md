# API Architecture: Hexagonal DDD & Netlify Serverless Deployment

Authoritative coding standard for designing, implementing, testing, and reviewing backend domain logic, API routes, ports/adapters, and Netlify serverless deployment (`ADR-0001`, `ADR-0002`).

## 1. Hexagonal Rings & Directory Layout

Organize code into four explicit hexagonal rings plus a thin Netlify composition root. Dependencies point strictly **inward**:

```
src/
├── domain/                     ← Inner Ring: Pure DDD tactical model (zero I/O, zero async infra)
├── application/                ← Middle Ring: Use-case orchestrators, Inbound & Outbound Ports
├── adapters/
│   ├── inbound/
│   │   └── http/               ← Inbound Adapters: openapi-backend router (createApp) + per-endpoint handlers
│   └── outbound/               ← Outbound Adapters: In-Memory, MongoDB (all collection/URI wiring), HMAC Token
└── config/                     ← Composition Root Config: runtime.types.ts & runtime.config.ts
netlify/
└── functions/
    └── api.ts                  ← Single Netlify Functions v2 Entrypoint (/api/v1/*)
```

### Inward-Only Dependency Rule (Enforced by `dependency-cruiser`)

- **`src/domain/**`** imports only from `src/domain/**`. Pure, synchronous, deterministic computation. Inject time and randomness as values (`nowMs`, `seed`) rather than calling `Date.now()`, `Math.random()`, `crypto`, `fetch`, or `node:*`.
- **`src/application/**`** imports only from `src/application/**` and `src/domain/**`. Defines **Inbound Ports** (use-case command/query handlers) and **Outbound Ports** (interfaces for persistence, narrative adjudication, event streaming, clock, and ID generation).
- **`src/adapters/inbound/**`** imports from `src/application/**` and `src/domain/**`. Translates HTTP `Request`, `BearerAuth` capability tokens, and JSON payloads into Application commands/queries, and maps Domain Results/Errors into OpenAPI `Response` shapes (`docs/api/openapi.yaml`).
- **`src/adapters/outbound/**`** imports from `src/application/**` and `src/domain/**` to implement Outbound Ports, and encapsulates all MongoDB driver/collection wiring (`DEFAULT_MONGODB_DB_NAME`, `CURRICULUM_PACKS_COLLECTION`, `getMongoDatabase`).
- **No cross-adapter imports**: Inbound Adapters (`src/adapters/inbound/`) and Outbound Adapters (`src/adapters/outbound/`) never import each other directly; only the **Composition Root** (`src/config/runtime.config.ts`, `netlify/functions/api.ts`, and test harnesses) wires them together.

### No God Modules: Separate Interface/Contract Files from Class/Implementation Files

Never combine TypeScript `interface`/`type` contracts and `class`/factory implementations inside the same file. Keep every module single-purpose and easy to read and review:

- **Domain Ring (`src/domain/`)**:
  - Value Object & Aggregate contracts (`*.types.ts`, e.g., `curriculum-pack.types.ts`) live in dedicated type files.
  - Aggregate Root and Value Object classes (`curriculum-pack.ts`, `pack-id.ts`) contain only the class implementation and private domain helpers.
- **Application Ring (`src/application/`)**:
  - Inbound Port contracts (`*UseCasePort`, `*Query`, `*Result`, `*Dependencies`) and Outbound Port contracts (`*Port`) live in `src/application/ports/*.port.ts`.
  - DTO shape contracts (`*Dto`, `*ProjectionOptions`) live in `src/application/dtos/*.dto.ts`.
  - Use Case classes (`src/application/use-cases/*.use-case.ts`) and Projector classes (`src/application/dtos/*-projector.ts`) contain only the class implementation.
- **Inbound & Outbound Adapters (`src/adapters/inbound/` & `src/adapters/outbound/`)**:
  - HTTP handler contracts (`RouteContext`, `HttpRequestInput`, `EndpointHttpHandler`, `HttpEndpointDefinition`, `*Dependencies`) live in `src/adapters/inbound/http/http-handler.types.ts`.
  - Persistence document schemas and adapter options (`CurriculumPackDocument`, `CurriculumPackCollectionLike`, `MongoCurriculumPackRepositoryOptions`) live in `src/adapters/outbound/*.types.ts`, separate from repository and adapter classes.

## 2. DDD Tactical Rules in the Domain Ring

Use the ubiquitous language from `GLOSSARY.md` across all class, type, method, and error names:

- **Aggregate Roots (Transactional Consistency Boundaries)**:
  - **`GameSession`**: Owns its `GameplayRound` entities, participant roster, capability token hashes (`instructorToken`, `participantToken`), submitted `ConceptChain` entities, `AdjudicationVerdict`s, `AssessmentAttempt`s, perception survey responses, and timed phase state machine. Every state mutation—joining, advancing phases (with mandatory board reshuffle on entering `round-1` or `round-2`), recording a `ConceptChain` before the 20-minute `chain-mapping` cutoff, casting peer votes, locking an `InstructorFinalRuling`, and recording one-shot `AssessmentAttempt`s—executes through invariant-enforcing methods on `GameSession`.
  - **`CurriculumPack`**: Read-mostly Aggregate Root identified by `PackId`, bundling `KeywordCard`s, `SemanticDomain`s, `AdjudicationRubric`, `CalibrationExample`s, and optional assessment/survey instruments.
- **Value Objects**:
  - Model `GridCoord`, `BoardGrid`, `ChainPath`, `AdjudicationRubric`, `CalibrationExample`, `AdjudicationVerdict`, `PlayerRoundStanding`, `UncertaintyCalibration`, `ChainDiversityIndex`, and `BoardNeglectHeatmap` as immutable, value-compared structures.
- **Stateless Domain Services**:
  - Keep cross-concept calculations pure and side-effect-free:
    - `BoardTopologyService`: seeded PRNG board dealing (`rows × cols`) and path adjacency verification (`chebyshev-8` or `orthogonal-4`, uniqueness, bounds, `minChainLength`).
    - `CurriculumPackValidatorService`: exhaustive structural and topological invariant validation returning all issues (`jsonPointer`, `rule`, `message`).
    - `RoundScoringService`: coordinate-path deduplication per participant and leaderboard ranking (`longestValidChainLength` DESC $\to$ `totalValidChainsCount` DESC $\to$ `cumulativeRationaleScore` DESC).
    - `MetacognitiveAnalyticsService`: Pretest/Posttest comparison separating Correct %, Wrong Guess %, and explicit `"I_DONT_KNOW"` % to compute `UncertaintyCalibration`, `ChainDiversityIndex`, and `BoardNeglectHeatmap`.

## 3. Application Ports & Role-Aware Projection

- **Driven Ports**:
  - `CurriculumPackRepositoryPort`: loads built-in (`diabe-teach`) and custom registered `CurriculumPack` aggregates; saves newly published packs with duplicate-ID conflict detection.
  - `SessionRepositoryPort`: loads and atomically persists `GameSession` aggregates (and resolves sessions by `roomCode`) using optimistic concurrency control.
  - `NarrativeAdjudicatorPort`: evaluates a `ConceptChain` against a `CurriculumPack`'s `AdjudicationRubric` (implemented by an LLM adapter in production and a deterministic rubric/fixture adapter in tests).
  - `SessionEventPublisherPort`: publishes real-time domain events (`session.snapshot`, `participant.joined`, `phase.changed`, `chain.submitted`, `chain.adjudicated`, `standings.updated`) and subscribes SSE streams.
  - `ClockPort` & `IdGeneratorPort`: deterministic time (`nowMs()`) and ID/token generation.
- **Role-Aware Schema Projection**:
  - Strip `correctIndex` and `explanation` from `CurriculumPack` and Pretest `AssessmentAttempt` responses inside Application/DTO projection mappers unless caller holds a verified `instructorToken` or has completed the Posttest. Never mutate the `CurriculumPack` Aggregate to hide fields.

## 4. HTTP Inbound Adapter & Central OpenAPI YAML Routing (`openapi-backend`)

- **Central YAML Routing & `x-api-key` Security via `openapi-backend` (`src/adapters/inbound/http/create-app.ts`)**:
  - `docs/api/openapi.yaml` is the single source of truth for all API routes, HTTP methods, path parameters, security schemes (`ApiKeyAuth` for `x-api-key` and `BearerAuth` for session capability tokens), and `operationId`s.
  - `createApp(deps)` initializes `OpenAPIBackend` (`openapi-backend`) with `docs/api/openapi.yaml` (`quick: true`), registers the `ApiKeyAuth` security handler + `unauthorizedHandler` (returning `401 UNAUTHORIZED_TOKEN` with `"Missing or invalid x-api-key header."` when `apiKey` or `requireApiKey` is active), and maps each `operationId` (e.g., `getCurriculumPackById`) to its per-endpoint handler.
- **Request Transformer + Endpoint Handler Factory Pipeline (`createEndpointHandler`)**:
  - Each HTTP Inbound Adapter in `src/adapters/inbound/http/` separates transport parsing from use-case execution using two pure building blocks:
    1. **Request Transformer (`transform<Endpoint>Request`)**: Pure function `(input: HttpRequestInput) => TQuery` that extracts path parameters from `context?.params` (populated by `openapi-backend`, Netlify Functions v2 `URLPattern`, or AWS Lambda `event.pathParameters`) and parses `Authorization: Bearer <token>` headers via `parseBearerTokenHeader`.
    2. **Endpoint Handler Factory (`create<Endpoint>Handler(deps)`)**: Instantiates the Application Use Case with injected Outbound Ports (`deps`) and delegates `{ transformRequest, execute }` to `createEndpointHandler` (`src/adapters/inbound/http/endpoint-handler.factory.ts`), returning `(request: Request, context?: RouteContext) => Promise<Response>`.
- **Single Error Translation Boundary**:
  - Domain and Application layers return typed domain results or throw typed `DomainError` subclasses—never HTTP status codes.
  - `mapDomainErrorToResponse` in `endpoint-handler.factory.ts` maps every `DomainError` to `#/components/schemas/ApiErrorResponse` (`{ code, message, details? }`) using the 15 canonical `ApiErrorCode` values in `docs/api/openapi.yaml` (`INVALID_REQUEST_BODY`, `UNAUTHORIZED_TOKEN`, `FORBIDDEN_ROLE`, `PACK_NOT_FOUND`, `SESSION_NOT_FOUND`, `ROOM_CODE_NOT_FOUND`, `CHAIN_NOT_FOUND`, `PACK_ALREADY_EXISTS`, `INVALID_PHASE_TRANSITION`, `PHASE_CLOSED_FOR_SUBMISSIONS`, `ADJUDICATION_LOCKED_BY_INSTRUCTOR`, `ASSESSMENT_ALREADY_SUBMITTED`, `PACK_VALIDATION_FAILED`, `CHAIN_TOPOLOGY_INVALID`, `ASSESSMENT_INCOMPLETE`).

## 5. Netlify Serverless Deployment & Composition Root (`src/config/` + `netlify/functions/api.ts`)

- **Runtime Config Inside `src/config/` & Single Netlify Entrypoint (`netlify/functions/api.ts` + `netlify.toml`)**:
  - Project-root `netlify.toml` configures `[functions]` with `directory = "netlify/functions"`, `node_bundler = "esbuild"`, and `included_files = ["docs/api/openapi.yaml"]`.
  - `src/config/runtime.types.ts` defines the composition root contracts (`RuntimeEnvConfig`, `ProductionDependencies`, `ServerlessRouteConfig`, `ServerlessHttpHandler`).
  - `src/config/runtime.config.ts` centralizes environment parsing (`loadRuntimeEnvConfig`), warm-cached production Outbound Adapter wiring (`getProductionDependencies`), handler bridging (`createServerlessHttpHandler`), and route config helpers (`defineServerlessRouteConfig`).
  - `netlify/functions/api.ts` is the sole file under `netlify/`, exporting `export default createServerlessHttpHandler()` and `export const config = defineServerlessRouteConfig({ path: "/api/v1/*", method: ["GET", "POST", "PUT", "PATCH", "DELETE"] })`.
- **Stateless Persistence via MongoDB + Optimistic Concurrency Control**:
  - Production Driven Adapters for `SessionRepositoryPort` (`MongoSessionRepository`, collection `game_sessions`) and `CurriculumPackRepositoryPort` (`MongoCurriculumPackRepository`, collection `curriculum_packs`) use the official `mongodb` driver with a module-scoped cached `MongoClient` (`maxPoolSize: 5` for serverless warm-container reuse) and optimistic concurrency control (`version` field with atomic `findOneAndUpdate({ _id, version }, { $set: ..., $inc: { version: 1 } })`) so concurrent serverless invocations never silently overwrite each other's state.
- **Server-Sent Events (`GET /api/v1/sessions/:sessionId/stream`)**:
  - Return a Web `ReadableStream` with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, immediately flushing the `session.snapshot` event, emitting monotonic `id:` and `retry:` directives, and streaming room updates through `SessionEventPublisherPort` so `EventSource` clients automatically reconnect across serverless invocation lifecycles.

## 6. Testing Discipline at the Hexagonal Seams

- **Primary Seam**: Exercise the full HTTP + Application + Domain stack in-process via `createApp({ packRepo: inMemoryPackRepo, sessionRepo: inMemorySessionRepo, narrativeAdjudicator: fakeAdjudicator, eventPublisher: inMemoryEventBus, clock: fakeClock, idGen: deterministicIdGen }).fetch(request)`—zero network sockets, zero Netlify CLI emulator required.
- **Domain Service Seam**: Test pure combinatorial edge cases (`BoardTopologyService`, `CurriculumPackValidatorService`, `RoundScoringService`, `MetacognitiveAnalyticsService`) directly against their pure domain entry points.
