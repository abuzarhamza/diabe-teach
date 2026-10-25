# Spec: Hexagonal DDD API Architecture & Netlify Serverless Deployment

Status: ready-for-agent

## Problem Statement

Without an explicit, enforceable architectural standard for API development and deployment, backend implementations of the Concept-Chain Educational Game Engine risk tangling core pedagogical and clinical domain rules with HTTP transport concerns, OpenAPI error formatting, LLM SDK calls, and Netlify serverless runtime specifics. In a serverless environment like Netlify Functions, naive in-memory state management silently loses `GameSession` state and custom `CurriculumPack` registrations across stateless invocations or concurrent classroom requests, while scattering HTTP status codes and answer-key filtering across domain objects makes invariants brittle and forces tests to boot heavy serverless emulators.

## Solution

Establish and enforce a **Domain-Driven Design (DDD)** and **Hexagonal Architecture (Ports & Adapters)** standard for the `/api/v1/*` platform API deployed on **Netlify Functions v2** and backed by **MongoDB**:

1. **Concentric Hexagonal Rings with Inward-Only Dependencies**: Isolate a pure, zero-I/O **Domain Ring** (`GameSession` and `CurriculumPack` Aggregate Roots, immutable Value Objects, and stateless Domain Services) inside an **Application Ring** (use-case command/query handlers, role-aware DTO projection mappers, and outbound Driven Ports), surrounded by a Web-Standard `Request`/`Response` **HTTP Driving Adapter** and pluggable **Driven Adapters**, enforced at build time by `dependency-cruiser`.
2. **DDD Aggregate Transactional Boundaries**: Enforce all session lifecycle invariants—mandatory deck reshuffling on round entry, 20-minute `chain-mapping` submission cutoffs, coordinate-path deduplication, permanent `Instructor Final Ruling` locks, and one-shot Pretest/Posttest `Assessment Attempt` completeness—through methods on the `GameSession` Aggregate Root.
3. **Single Catch-All Netlify Functions v2 Composition Root**: Route all `/api/v1/*` requests through a single Netlify Functions v2 entry point that wires production Driven Adapters into the Web-Standard Fetch HTTP Driving Adapter (`createApp(deps)`).
4. **Stateless Serverless Persistence via MongoDB & SSE Streaming**: Back `SessionRepositoryPort` and `CurriculumPackRepositoryPort` with **MongoDB** (`game_sessions` and `curriculum_packs` collections) using a warm-cached serverless `MongoClient` and document `version` optimistic concurrency control in production (and deterministic In-Memory adapters in tests), and serve `GET /api/v1/sessions/:sessionId/stream` via a Web `ReadableStream` with SSE `id:` and `retry:` auto-reconnection semantics.

## User Stories

1. As a domain engineer, I want the Domain Ring to have zero imports from Application, Adapters, HTTP frameworks, LLM SDKs, or Node/Netlify runtime APIs, so that all Concept-Chain game mechanics are 100% pure, deterministic, and portable.
2. As a domain engineer, I want `GameSession` modeled as a transactional Aggregate Root that owns its `GameplayRound` entities, participant roster, capability tokens, submitted `ConceptChain` entities, `AdjudicationVerdict` states, and `AssessmentAttempt` records, so that no external caller can mutate session state into an invalid configuration.
3. As a domain engineer, I want `CurriculumPack` modeled as an immutable, read-mostly Aggregate Root containing `KeywordCard` items, `SemanticDomain` groupings, an `AdjudicationRubric`, `CalibrationExample` fixtures, and optional assessment/survey instruments, so that *Diabe-teach* and custom discipline packs share identical structural guarantees.
4. As a domain engineer, I want `BoardTopologyService`, `CurriculumPackValidatorService`, `RoundScoringService`, and `MetacognitiveAnalyticsService` implemented as stateless, pure Domain Services operating on immutable Value Objects (`GridCoord`, `BoardGrid`, `ChainPath`, `PlayerRoundStanding`, `UncertaintyCalibration`, `ChainDiversityIndex`, `BoardNeglectHeatmap`), so that complex graph and statistical calculations can be verified in isolation without I/O setup.
5. As an instructor advancing a `GameSession` into `round-1` or `round-2`, I want the `GameSession` Aggregate Root to require a fresh PRNG seed from the Application Ring and generate a new `BoardGrid` via `BoardTopologyService`, so that familiarity with the Trial Orientation board layout never carries into competitive Gameplay Rounds.
6. As a learner submitting a `ConceptChain`, I want the `GameSession` Aggregate Root to reject submissions unless the active `GameplayRound` is in the `chain-mapping` sub-phase and the path passes `BoardTopologyService` validation, raising typed Domain Errors (`PhaseClosedForSubmissionsError`, `ChainTopologyInvalidError`) with exact broken transition metadata.
7. As a supervising instructor issuing an `Instructor Final Ruling` (`instructor-approve` or `instructor-reject`), I want the `GameSession` Aggregate Root to permanently lock the target `ConceptChain`'s `AdjudicationVerdict` (`isLocked: true`, `adjudicatorType: "instructor-final"`) and reject any subsequent peer votes or AI evaluations with `AdjudicationLockedByInstructorError`.
8. As a learner submitting a Pretest or Posttest `Assessment Attempt`, I want the `GameSession` Aggregate Root to enforce that every question in the `CurriculumPack`'s assessment instrument has an explicit candidate answer (`0..3`) or `"I_DONT_KNOW"` declaration and that each stage is submitted at most once per participant.
9. As an application architect, I want all external side effects abstracted behind six outbound Driven Ports (`CurriculumPackRepositoryPort`, `SessionRepositoryPort`, `NarrativeAdjudicatorPort`, `SessionEventPublisherPort`, `ClockPort`, `IdGeneratorPort`) in the Application Ring, so that use cases remain agnostic of Netlify Blobs, LLM providers, and system clocks.
10. As a study administrator, I want role-aware DTO projection mappers in the Application Ring to strip `correctIndex` and `explanation` from `CurriculumPack` and Pretest `Assessment Attempt` payloads unless the caller supplies a valid `instructorToken` or completes the Posttest, without mutating the underlying `CurriculumPack` Aggregate Root.
11. As a frontend or API consumer, I want the HTTP Driving Adapter to act as the single boundary that translates typed `DomainError` instances and request validation failures into the 15 canonical machine-readable `ApiErrorCode` values and HTTP status codes defined in the OpenAPI 3.1 contract.
12. As a platform engineer deploying to Netlify, I want a single Netlify Functions v2 catch-all handler configured for `/api/v1/*` to act purely as the Composition Root—reading environment variables (`MONGODB_URI`, `MONGODB_DB_NAME`, `CAPABILITY_TOKEN_SECRET`), instantiating production Driven Adapters, and delegating the Web-Standard `Request` to `createApp(deps).fetch(request)`.
13. As a classroom participant playing on a horizontally scaled Netlify serverless deployment, I want the production `MongoSessionRepository` Driven Adapter to use document `version` conditional updates (`findOneAndUpdate({ _id, version }, { $set: ..., $inc: { version: 1 } })`) with bounded optimistic concurrency retry on `GameSession` mutations, so that simultaneous chain submissions or peer votes from multiple students never clobber one another.
14. As a game creator publishing a custom `CurriculumPack` via `POST /api/v1/packs` on Netlify, I want `MongoCurriculumPackRepository` to persist the custom pack in the MongoDB `curriculum_packs` collection alongside the built-in `diabe-teach` pack and enforce atomic duplicate-ID conflict detection (`409 PACK_ALREADY_EXISTS`).
15. As a connected classroom client subscribing to `GET /api/v1/sessions/:sessionId/stream` on Netlify Functions v2, I want the HTTP Driving Adapter to return a Web `ReadableStream` (`text/event-stream`) that immediately flushes the current `session.snapshot` event and emits subsequent room events with monotonic `id:` and `retry:` directives, so that `EventSource` clients automatically reconnect when a serverless invocation reaches its execution window.
16. As an engineer running `lint:boundaries`, I want `dependency-cruiser` to fail the build if the Domain Ring imports anything outside Domain, if the Application Ring imports Adapters or external frameworks, if Driving and Driven Adapters import each other directly, or if any module introduces a circular dependency.
17. As a developer or CI pipeline running automated tests, I want to exercise all 14 `/api/v1/*` endpoints in milliseconds by calling `createApp(inMemoryTestDeps).fetch(request)` in-process with zero network sockets, zero external LLM calls, and zero Netlify CLI processes.

## Implementation Decisions

- **Hexagonal Ring Structure & Dependency Direction**:
  - **Domain Ring**: Houses Aggregate Roots (`GameSession`, `CurriculumPack`), Entities (`GameplayRound`, `Participant`, `SubmittedChain`, `AssessmentAttempt`), Value Objects (`GridCoord`, `BoardGrid`, `ChainPath`, `AdjudicationRubric`, `CalibrationExample`, `AdjudicationVerdict`, `PlayerRoundStanding`, `UncertaintyCalibration`, `ChainDiversityIndex`, `BoardNeglectHeatmap`), stateless Domain Services (`BoardTopologyService`, `CurriculumPackValidatorService`, `RoundScoringService`, `MetacognitiveAnalyticsService`), Domain Events, and typed `DomainError` subclasses. Zero external or I/O dependencies.
  - **Application Ring**: Houses inbound Driving Port command/query use-case handlers (`ListPacksUseCase`, `GetPackUseCase`, `ValidatePackUseCase`, `RegisterPackUseCase`, `CreateSessionUseCase`, `JoinSessionUseCase`, `GetSessionStateUseCase`, `TransitionPhaseUseCase`, `SubmitChainUseCase`, `AdjudicateChainUseCase`, `GetRoundStandingsUseCase`, `SubmitAssessmentUseCase`, `SubmitSurveyUseCase`, `GetSessionAnalyticsUseCase`), Role-Aware DTO Projectors, and outbound Driven Port interfaces.
  - **Driving Adapters Ring**: Houses the Web-Standard Fetch HTTP router (`createApp(deps)`), Bearer capability token extraction middleware, OpenAPI request payload validators, SSE `ReadableStream` controller, and the centralized `DomainError` $\to$ `ApiErrorResponse` translator.
  - **Driven Adapters Ring**: Houses pairs of production and test adapters for every Driven Port:
    - `CurriculumPackRepositoryPort`: `InMemoryCurriculumPackRepository` (seeded with `diabe-teach`) and `MongoCurriculumPackRepository` (checking built-in `diabe-teach` in memory first and querying the MongoDB `curriculum_packs` collection for custom packs).
    - `SessionRepositoryPort`: `InMemorySessionRepository` and `MongoSessionRepository` (storing serialized `GameSession` documents and indexed `roomCode` fields in the MongoDB `game_sessions` collection with `version` optimistic locking and automatic retry on concurrent write conflicts).
    - `NarrativeAdjudicatorPort`: `LlmNarrativeAdjudicatorAdapter` (prompted strictly by the pack's `AdjudicationRubric` and `CalibrationExample`s) and `DeterministicRubricAdjudicatorAdapter` (for deterministic tests and offline fixtures).
    - `SessionEventPublisherPort`: `InMemorySessionEventBus` and MongoDB state/change-stream publisher for SSE connections.
    - `ClockPort` and `IdGeneratorPort`: production system implementations and controllable deterministic test doubles.
  - **Composition Root**: A thin Netlify Functions v2 entry point configured with `path: "/api/v1/*"` wires production Driven Adapters into `createApp(deps)` and exports the default Web-Standard `(req: Request, context: Context) => Promise<Response>` handler.
- **Transactional Aggregate Mutation & Optimistic Concurrency Pattern**:
  - Every mutating Application use case executes a load-modify-save unit-of-work loop against `SessionRepositoryPort`:
    1. Load the `GameSession` Aggregate Root alongside its current storage version/ETag.
    2. Invoke the pure domain method on `GameSession` (passing injected `clock.nowMs()`, `idGenerator`, or `BoardTopologyService`).
    3. Persist the updated `GameSession` conditional on the prior version/ETag; if a concurrent serverless invocation modified the session in flight, reload the fresh `GameSession` and re-apply the domain command up to a bounded retry count before surfacing a conflict error.
    4. Publish emitted Domain Events to `SessionEventPublisherPort`.
- **Automated Boundary Enforcement (`dependency-cruiser`)**:
  - Static dependency rules enforce:
    1. `domain- stays-pure`: Domain Ring modules cannot import from Application, Adapters, Composition Root, or external runtime/framework packages.
    2. `application-depends-only-on-domain`: Application Ring modules cannot import from Adapters, Composition Root, HTTP routers, `@netlify/*`, or LLM SDKs.
    3. `no-cross-adapter-imports`: Driving Adapters cannot import Driven Adapters and vice versa.
    4. `no-circular`: Zero circular dependencies across the codebase.

## Testing Decisions

- **Primary Testing Seam (The HTTP Driving Adapter Factory `createApp(deps)`)**:
  - All API behavioral and contract tests target the `createApp(deps)` factory seam using standard Web `Request` and `Response` objects (`await app.fetch(new Request(...))`).
  - Tests inject `InMemoryCurriculumPackRepository`, `InMemorySessionRepository`, `DeterministicRubricAdjudicatorAdapter`, `InMemorySessionEventBus`, `FakeClock`, and `DeterministicIdGenerator`.
  - Every response is validated against the OpenAPI 3.1 schema and the 15 canonical `ApiErrorCode` values.
- **Secondary Testing Seams**:
  - **Pure Domain Services & Aggregates**: Direct table-driven unit tests on `BoardTopologyService`, `CurriculumPackValidatorService`, `RoundScoringService`, `MetacognitiveAnalyticsService`, and `GameSession` state transitions (including *Diabe-teach* Figure 2 Chains A, B, and C, mandatory board reshuffling, and Table 1 metacognitive ratios).
  - **Driven Adapter Contract Tests**: Focused adapter tests verifying that both `InMemorySessionRepository` and `NetlifyBlobsSessionRepository` (against a mocked/local blob store) honor optimistic concurrency ETag conflict detection and retry semantics.
  - **Architectural Boundary Verification**: Running `lint:boundaries` (`dependency-cruiser`) to verify that inward-only hexagonal ring imports are respected.

## Out of Scope

- Replacing HTTP REST + SSE with GraphQL or gRPC Driving Adapters.
- Multi-region active-active relational database clustering outside Netlify Blobs for the baseline serverless deployment.
- Permanent user account authentication (OAuth2/OIDC) beyond session-scoped `instructorToken` and `participantToken` capability tokens.

## Further Notes

- Agent Rule & Coding Standard: [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md)
- Architectural Decision Record: [`docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md`](../../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
- Parent Platform Spec: [`.scratch/concept-chain-api/spec.md`](../concept-chain-api/spec.md)
- OpenAPI 3.1 Contract Spec: [`.scratch/openapi-contract/spec.md`](../openapi-contract/spec.md) and [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml)
- Domain Glossary: [`GLOSSARY.md`](../../GLOSSARY.md)
