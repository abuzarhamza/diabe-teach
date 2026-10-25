# API Architecture: Hexagonal DDD & Netlify Serverless Deployment

Authoritative coding standard for designing, implementing, testing, and reviewing backend domain logic, API routes, ports/adapters, and Netlify serverless deployment (`ADR-0001`, `ADR-0002`).

## 1. Hexagonal Rings & Directory Layout

Organize code into four explicit hexagonal rings plus a thin Netlify composition root. Dependencies point strictly **inward**:

```
src/
├── domain/                     ← Inner Ring: Pure DDD tactical model (zero I/O, zero async infra)
├── application/                ← Middle Ring: Use-case orchestrators, Driving Ports & Driven Ports
└── adapters/
    ├── driving/
    │   └── http/               ← Primary Driving Adapter: Web-Standard Fetch (Request -> Response)
    └── driven/                 ← Secondary Driven Adapters: In-Memory, MongoDB, LLM, Fake Judge
netlify/
└── functions/
    └── api.ts                  ← Composition Root: Netlify Functions v2 catch-all (/api/v1/*)
```

### Inward-Only Dependency Rule (Enforced by `dependency-cruiser`)

- **`src/domain/**`** imports only from `src/domain/**`. Pure, synchronous, deterministic computation. Inject time and randomness as values (`nowMs`, `seed`) rather than calling `Date.now()`, `Math.random()`, `crypto`, `fetch`, or `node:*`.
- **`src/application/**`** imports only from `src/application/**` and `src/domain/**`. Defines inbound **Driving Ports** (use-case command/query handlers) and outbound **Driven Ports** (interfaces for persistence, narrative adjudication, event streaming, clock, and ID generation).
- **`src/adapters/driving/**`** imports from `src/application/**` and `src/domain/**`. Translates HTTP `Request`, `BearerAuth` capability tokens, and JSON payloads into Application commands/queries, and maps Domain Results/Errors into OpenAPI `Response` shapes (`docs/api/openapi.yaml`).
- **`src/adapters/driven/**`** imports from `src/application/**` and `src/domain/**` to implement Driven Ports.
- **No cross-adapter imports**: Driving Adapters and Driven Adapters never import each other directly; only the **Composition Root** (`netlify/functions/api.ts` and test harnesses) wires them together.

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

## 4. HTTP Driving Adapter & Error Translation

- **Factory Seam (`createApp(deps)`)**:
  - Expose `createApp(deps)` in `src/adapters/driving/http/` returning a standard Web Fetch handler (`{ fetch(request: Request): Promise<Response> }`).
- **Single Error Translation Boundary**:
  - Domain and Application layers return typed domain results or throw typed `DomainError` subclasses—never HTTP status codes.
  - The HTTP Driving Adapter maps every error to `#/components/schemas/ApiErrorResponse` (`{ code, message, details? }`) using the 15 canonical `ApiErrorCode` values in `docs/api/openapi.yaml` (`INVALID_REQUEST_BODY`, `UNAUTHORIZED_TOKEN`, `FORBIDDEN_ROLE`, `PACK_NOT_FOUND`, `SESSION_NOT_FOUND`, `ROOM_CODE_NOT_FOUND`, `CHAIN_NOT_FOUND`, `PACK_ALREADY_EXISTS`, `INVALID_PHASE_TRANSITION`, `PHASE_CLOSED_FOR_SUBMISSIONS`, `ADJUDICATION_LOCKED_BY_INSTRUCTOR`, `ASSESSMENT_ALREADY_SUBMITTED`, `PACK_VALIDATION_FAILED`, `CHAIN_TOPOLOGY_INVALID`, `ASSESSMENT_INCOMPLETE`).

## 5. Netlify Serverless Deployment Conventions

- **Single Catch-All Netlify Function v2**:
  - `netlify/functions/api.ts` exports the default Web-Standard handler `(req: Request, context: Context) => Promise<Response>` and `export const config: Config = { path: "/api/v1/*" }`.
  - Keep `netlify/functions/api.ts` as a pure Composition Root (reading env vars, instantiating Driven Adapters, and delegating to `createApp(deps).fetch(req)`).
- **Stateless Persistence via MongoDB + Optimistic Concurrency Control**:
  - Production Driven Adapters for `SessionRepositoryPort` (`MongoSessionRepository`, collection `game_sessions`) and `CurriculumPackRepositoryPort` (`MongoCurriculumPackRepository`, collection `curriculum_packs`) use the official `mongodb` driver with a module-scoped cached `MongoClient` (`maxPoolSize: 5` for serverless warm-container reuse) and optimistic concurrency control (`version` field with atomic `findOneAndUpdate({ _id, version }, { $set: ..., $inc: { version: 1 } })`) so concurrent serverless invocations never silently overwrite each other's state.
- **Server-Sent Events (`GET /api/v1/sessions/:sessionId/stream`)**:
  - Return a Web `ReadableStream` with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, immediately flushing the `session.snapshot` event, emitting monotonic `id:` and `retry:` directives, and streaming room updates through `SessionEventPublisherPort` so `EventSource` clients automatically reconnect across serverless invocation lifecycles.

## 6. Testing Discipline at the Hexagonal Seams

- **Primary Seam**: Exercise the full HTTP + Application + Domain stack in-process via `createApp({ packRepo: inMemoryPackRepo, sessionRepo: inMemorySessionRepo, narrativeAdjudicator: fakeAdjudicator, eventPublisher: inMemoryEventBus, clock: fakeClock, idGen: deterministicIdGen }).fetch(request)`—zero network sockets, zero Netlify CLI emulator required.
- **Domain Service Seam**: Test pure combinatorial edge cases (`BoardTopologyService`, `CurriculumPackValidatorService`, `RoundScoringService`, `MetacognitiveAnalyticsService`) directly against their pure domain entry points.
