# Spec: `GET /api/v1/packs/{packId}` — Hexagonal DDD Vertical Slice with `openapi-backend` YAML Routing, Netlify Deployment Config & MongoDB

Status: ready-for-agent

## Problem Statement

Every workflow in the Concept-Chain Educational Game Platform—rendering the 7×7 keyword board, running the 15-minute Trial Orientation with Figure 2 Calibration Examples, administering the 10-question Pretest/Posttest Assessment Instrument, and collecting the 9-item Perception Survey—depends on fetching a **Curriculum Pack** by its `packId` via `GET /api/v1/packs/{packId}`.

Serving `GET /api/v1/packs/{packId}` on **Netlify Functions v2** (and **AWS Lambda** under the hood) while keeping the codebase easy to read, review, and scale across all 14 endpoints requires satisfying seven constraints simultaneously:
1. **Complete Clinical Fidelity**: The built-in `diabe-teach` Curriculum Pack must accurately expose all 49 verbatim Appendix 1 Keyword Cards, 7 Semantic Domains, the Figure 2 reference 7×7 board and Calibration Examples (Valid Chain A [9 cards], Valid Chain B [7 cards], and Invalid Chain C [non-adjacent transition]), 10 Bloom Level 2/3 multiple-choice questions, and 9 Appendix 2 Likert survey items.
2. **Answer-Key Secrecy Across Pretest and Posttest**: Anonymous callers and learners holding a `participantToken` must never receive `correctIndex` or `explanation` in `GET /api/v1/packs/{packId}`, whereas an instructor holding a valid `instructorToken` must receive the full unredacted assessment key—and a caller passing a malformed or tampered `Authorization` header must receive an immediate `401 UNAUTHORIZED_TOKEN` error.
3. **Hexagonal DDD Ring Isolation (`domain`, `application`, `adapters/inbound`, `adapters/outbound`)**: The `CurriculumPack` Aggregate Root and `PackId` Value Object in the Domain Ring must remain 100% pure and free of HTTP, OpenAPI, Netlify, or MongoDB driver concerns.
4. **No God Modules (Strict Separation of Interface/Contract Files from Class/Implementation Files)**: Every module across all four rings must separate TypeScript interfaces, ports, DTOs, and configuration contracts (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from classes and factory implementations (`*.ts`, `*.use-case.ts`, `*.handler.ts`, `*.factory.ts`).
5. **Simple Request Transformer + Endpoint Handler Factory Pipeline**: Inbound HTTP handlers must follow a clean 3-step pipeline (`transformRequest -> execute -> jsonResponse / mapDomainErrorToResponse`) via a shared `createEndpointHandler` factory so parameter extraction, use-case execution, and error translation are never tangled.
6. **Central YAML Routing via Existing Framework (`openapi-backend` + `docs/api/openapi.yaml`)**: Instead of scattering routes across many files or maintaining a custom router, all API routing must be driven in one place by the official **`openapi-backend`** framework reading `docs/api/openapi.yaml` and dispatching matched `operationId`s (such as `getCurriculumPackById`) to their registered Inbound HTTP handlers.
7. **All Application, Adapter, MongoDB, and Runtime Config Inside `src/` (With Only `netlify/functions/api.ts` in `netlify/`)**: MongoDB collection wiring (`DEFAULT_MONGODB_DB_NAME`, `CURRICULUM_PACKS_COLLECTION`, `getMongoDatabase`) must live inside `src/adapters/outbound/`, runtime environment and dependency wiring must live inside `src/config/`, and `netlify/functions/api.ts` must be the sole file under `netlify/`.

## Solution

Implement the end-to-end **`GET /api/v1/packs/{packId}`** vertical slice across all four Hexagonal DDD rings (`Domain`, `Application`, `Inbound Adapters`, `Outbound Adapters` with **MongoDB**) plus `src/config/`, centrally routed by **`openapi-backend`** from `docs/api/openapi.yaml` and deployed via the single **Netlify Functions v2** entrypoint (`netlify/functions/api.ts` + `netlify.toml`):

1. **Domain Ring (`src/domain/`)**:
   - Separate all Value Object and Aggregate property contracts (`AdjacencyRule`, `BoardConfig`, `SemanticDomain`, `KeywordCard`, `GridCoord`, `CalibrationExample`, `AdjudicationRubric`, `AssessmentQuestion`, `AssessmentInstrument`, `PerceptionSurveyItem`, `PerceptionSurvey`, `CurriculumPackProps`) into `curriculum-pack.types.ts`.
   - Implement the `PackId` Value Object (`pack-id.ts`), the immutable `CurriculumPack` Aggregate Root (`curriculum-pack.ts`), the canonical built-in `DIABE_TEACH_PACK` (`diabe-teach-pack.ts`), and typed Domain Errors (`PackNotFoundError`, `UnauthorizedTokenError` in `domain-errors.ts`).
2. **Application Ring (`src/application/`)**:
   - Separate Inbound Port contracts (`GetCurriculumPackByIdQuery`, `GetCurriculumPackByIdResult`, `GetCurriculumPackByIdDependencies`, `GetCurriculumPackByIdUseCasePort` in `get-curriculum-pack-by-id.port.ts`), Outbound Port contracts (`CurriculumPackRepositoryPort`, `CapabilityTokenPort`), and DTO contracts (`PublicAssessmentQuestionDto`, `PublicCurriculumPackDto`, `CurriculumPackProjectionOptions` in `curriculum-pack.dto.ts`).
   - Implement `GetCurriculumPackByIdUseCase` (`get-curriculum-pack-by-id.use-case.ts`) and `CurriculumPackProjector` (`curriculum-pack-projector.ts`).
3. **Inbound HTTP Adapter Ring (`src/adapters/inbound/http/`)**:
   - Separate HTTP handler contracts (`RouteContext`, `HttpRequestInput`, `EndpointHttpHandler`, `HttpEndpointDefinition`, `GetPackByIdHandlerDependencies`, `AppDependencies`, `HttpApp`) into `http-handler.types.ts`.
   - Implement the shared `createEndpointHandler` factory (`endpoint-handler.factory.ts`) and the `GET /api/v1/packs/{packId}` Request Transformer + Handler Factory (`transformGetPackByIdRequest` and `createGetPackByIdHandler` in `get-pack-by-id.handler.ts`).
   - Implement `createApp(deps)` (`create-app.ts`) using **`openapi-backend`** initialized with `docs/api/openapi.yaml` (`quick: true`), registering `getCurriculumPackById`, `notFound`, and `notImplemented` handlers in one central router.
4. **Outbound Adapters Ring (`src/adapters/outbound/`), Runtime Config (`src/config/`), & Single Netlify Entrypoint (`netlify/functions/api.ts`)**:
   - Separate MongoDB repository contracts (`CurriculumPackDocument`, `CurriculumPackCollectionLike`, `MongoCurriculumPackRepositoryOptions`, `MongoConnectionConfig`) into `mongo-curriculum-pack-repository.types.ts`.
   - Encapsulate all MongoDB collection/URI wiring (`DEFAULT_MONGODB_DB_NAME`, `CURRICULUM_PACKS_COLLECTION`, `getMongoDatabase`, `MongoCurriculumPackRepository.fromConfig`) inside `src/adapters/outbound/`.
   - Place runtime environment parsing and dependency wiring (`runtime.types.ts`, `runtime.config.ts`) inside `src/config/`, and remove `netlify/config/` so `netlify/functions/api.ts` is the only file in `netlify/`.

## User Stories

1. As a learner or anonymous client calling `GET /api/v1/packs/diabe-teach` with no `Authorization` header, I want to receive `200 OK` with `{ pack: PublicCurriculumPack }` containing all 49 Appendix 1 Keyword Cards, 7 Semantic Domains, `boardConfig` (`7×7`, `minChainLength: 4`, `"chebyshev-8"`), Figure 2 Calibration Examples (Chains A, B, and C), 10 assessment questions, and 9 perception survey items.
2. As a study administrator, when an anonymous caller requests `GET /api/v1/packs/diabe-teach`, I want `correctIndex` and `explanation` omitted from every question in `pack.assessmentInstrument.questions`, so that learners cannot inspect network responses to find Pretest/Posttest answers.
3. As a learner calling `GET /api/v1/packs/diabe-teach` with a valid `Authorization: Bearer <participantToken>`, I want to receive `200 OK` with `correctIndex` and `explanation` omitted from `pack.assessmentInstrument.questions`, matching the redacted learner view.
4. As an instructor calling `GET /api/v1/packs/diabe-teach` with a valid `Authorization: Bearer <instructorToken>`, I want to receive `200 OK` with `correctIndex` (`0..3`) and `explanation` included on every question in `pack.assessmentInstrument.questions`, so that I can review the complete answer key.
5. As an API consumer passing a malformed `Authorization` header (e.g., non-Bearer scheme, empty token, or invalid/tampered token signature) to `GET /api/v1/packs/{packId}`, I want to receive `401 Unauthorized` with `{ code: "UNAUTHORIZED_TOKEN", message: "..." }`, so that broken authentication headers are surfaced immediately instead of silently returning a redacted response.
6. As an API consumer requesting an unknown `packId` (e.g., `GET /api/v1/packs/unknown-pack`) that is neither built-in nor present in the MongoDB `curriculum_packs` collection, I want to receive `404 Not Found` with `{ code: "PACK_NOT_FOUND", message: "Curriculum Pack 'unknown-pack' was not found.", details: { packId: "unknown-pack" } }`.
7. As a learner inspecting the `diabe-teach` pack's Keyword Cards, I want each of the 49 cards to include `id`, `verbatimLabel` (exact string from Appendix 1, such as `"Hyperglycaemia"` and `"Lipo-hypertrophy"`), `displayLabel`, `aliases` (such as `["Hyperglycemia"]` and `["Lipohypertrophy", "lipodistrophy"]`), `domainId`, and `summary`.
8. As a learner in the 15-minute Trial Orientation phase, I want `pack.adjudicationRubric` on `diabe-teach` to include the 7×7 `calibrationBoardCardIds` matrix from Figure 2 of the publication alongside the three `calibrationExamples` (Valid Chain A with 9 cards, Valid Chain B with 7 cards, and Invalid Chain C with 4 cards and `isValid: false` due to non-adjacent `Islet Cells` and `Pancreas`).
9. As a game creator who has stored a custom `CurriculumPack` document (e.g., `_id: "cardio-teach"`) in the MongoDB `curriculum_packs` collection, I want `GET /api/v1/packs/cardio-teach` to load the document from MongoDB, rehydrate the `CurriculumPack` Aggregate Root, and apply the exact same role-aware answer-key projection as the built-in `diabe-teach` pack.
10. As a player requesting `GET /api/v1/packs/diabe-teach` on Netlify Functions v2, I want `MongoCurriculumPackRepository` to serve the built-in `diabe-teach` pack directly from in-memory constants in $O(1)$ without making a MongoDB network query.
11. As a backend developer, I want all API routes and `operationId` mappings defined in one central YAML file (`docs/api/openapi.yaml`) and dispatched by the official `openapi-backend` framework in `createApp(deps)`, so that I never have to maintain custom regex routers or duplicate route definitions across files.
12. As an API consumer calling an unknown URL or an OpenAPI operation that has not been registered yet, I want `openapi-backend`'s `notFound` and `notImplemented` handlers in `createApp(deps)` to return a structured JSON `ApiErrorResponse` (`404` / `501`) rather than an unhandled exception.
13. As a platform engineer deploying to Netlify Functions v2, I want all MongoDB collection/URI wiring inside `src/adapters/outbound/`, runtime dependency configuration inside `src/config/`, and only `netlify/functions/api.ts` inside `netlify/`, so that no MongoDB or runtime config files sit outside `src/`.
14. As a code reviewer, I want every module in the codebase to separate interface/contract definitions (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from class and factory implementations (`*.ts`, `*.use-case.ts`, `*.handler.ts`, `*.factory.ts`), and use intuitive `src/adapters/inbound/`, `src/adapters/outbound/`, and `src/config/` directories.
15. As a developer running `lint:boundaries`, I want `dependency-cruiser` to verify that Domain and Application modules never import `mongodb`, `openapi-backend`, or `@netlify/functions`, that Inbound and Outbound Adapters never import each other directly, and that `mongodb` is strictly isolated to `src/adapters/outbound/`.
16. As a platform operator protecting `/api/v1/*` routes with a client API key, when `apiKey` (or `requireApiKey: true` in Netlify production via `process.env.API_KEY`) is configured, I want requests with a missing or mismatched `x-api-key` header (or when `API_KEY` is unset in production) to be rejected at the `openapi-backend` `ApiKeyAuth` security handler with `401 Unauthorized` (`{ code: "UNAUTHORIZED_TOKEN", message: "Missing or invalid x-api-key header." }`), while valid `x-api-key` requests proceed to `Authorization: Bearer` session role evaluation without leaking `x-api-key` concerns into the Domain, Application, or individual endpoint handler modules.
17. As a maintainer, I want a single Netlify Function entrypoint (`netlify/functions/api.ts`) and a single route matcher (`openapi-backend` reading `docs/api/openapi.yaml` in `createApp`), with no redundant per-endpoint Netlify function files (`get-pack-by-id.ts`), no `netlify/config/` folder outside `src/`, no duplicate URL regexes in endpoint handlers, and no duplicate `x-api-key` checks inside `createEndpointHandler`.

## Implementation Decisions

- **Central YAML Routing & `ApiKeyAuth` Security via `openapi-backend` (`src/adapters/inbound/http/create-app.ts`)**:
  - Uses `OpenAPIBackend` from `openapi-backend` pointed at `docs/api/openapi.yaml` with `quick: true` and `validate: false` (since domain/application validation produces canonical `DomainError` codes).
  - Registers the `ApiKeyAuth` security handler (`securityHandlers.ApiKeyAuth`) and `unauthorizedHandler` in `OpenAPIBackend` using timing-safe comparison against `deps.apiKey` when `deps.apiKey !== undefined` or `deps.requireApiKey === true`, returning `401 Unauthorized` (`{ code: "UNAUTHORIZED_TOKEN", message: "Missing or invalid x-api-key header." }`) on failure.
  - Maps `operationId: getCurriculumPackById` to `createGetPackByIdHandler(deps)`, forwarding extracted path parameters (`c.request.params.packId`) via `RouteContext`.
  - Registers `notFound` and `notImplemented` handlers so both unknown URLs and not-yet-implemented OpenAPI operations return structured JSON `Response` objects.
- **Request Transformer + Endpoint Handler Factory Pipeline (`src/adapters/inbound/http/`)**:
  - `endpoint-handler.factory.ts` provides `createEndpointHandler({ transformRequest, execute, successStatus })`, centralizing JSON serialization and `DomainError` $\to$ `ApiErrorResponse` translation without duplicating `x-api-key` checks.
  - `get-pack-by-id.handler.ts` exports the pure `transformGetPackByIdRequest` transformer (which reads `context?.params?.packId` directly without any duplicate URL regex) and `createGetPackByIdHandler` factory.
- **No God Modules — Dedicated Interface/Contract Files Across All Rings**:
  - Domain contracts in `curriculum-pack.types.ts`; Application contracts in `get-curriculum-pack-by-id.port.ts`, `curriculum-pack-repository.port.ts`, `capability-token.port.ts`, and `curriculum-pack.dto.ts`; Inbound HTTP contracts in `http-handler.types.ts`; Outbound MongoDB contracts in `mongo-curriculum-pack-repository.types.ts`; Runtime config contracts in `src/config/runtime.types.ts`.
- **All MongoDB Inside `src/adapters/outbound/`, Config Inside `src/config/`, and Only `netlify/functions/api.ts` in `netlify/`**:
  - `MongoCurriculumPackRepository` in `src/adapters/outbound/mongo-curriculum-pack-repository.ts` encapsulates `DEFAULT_MONGODB_DB_NAME`, `CURRICULUM_PACKS_COLLECTION`, and `getMongoDatabase` via `MongoCurriculumPackRepository.fromEnv` / `fromConnectionConfig`, keeping 100% of MongoDB collection and connection logic inside `src/adapters/outbound/`.
  - `src/config/runtime.config.ts` and `src/config/runtime.types.ts` provide `loadRuntimeEnvConfig`, `buildProductionDependencies`, `getProductionDependencies`, and `createServerlessHttpHandler`, keeping all TypeScript config and composition wiring inside `src/config/`.
  - `netlify/config/` is deleted so `netlify/functions/api.ts` is the sole file under `netlify/`.
  - `netlify.toml` configures `directory = "netlify/functions"`, `node_bundler = "esbuild"`, and `included_files = ["docs/api/openapi.yaml"]`.

## Testing Decisions

- **Primary Testing Seam (`createApp(deps)`, `src/config/runtime.config.ts`, & `netlify/functions/api.ts`)**:
  - Exercise `createApp(deps).fetch(request)` through `openapi-backend` (`docs/api/openapi.yaml` $\to$ `operationId: getCurriculumPackById` $\to$ `transformGetPackByIdRequest` $\to$ `GetCurriculumPackByIdUseCase` $\to$ `CurriculumPackProjector`).
  - Exercise `createGetPackByIdHandler(deps)(request, { params: { packId: "diabe-teach" } })` directly with `context.params`.
  - Exercise `netlify/functions/api.ts` and `src/config/runtime.config.ts` (`loadRuntimeEnvConfig`, `buildProductionDependencies`, `createServerlessHttpHandler`).
  - Verify `404` / `501` responses when calling unknown routes or unimplemented OpenAPI operations in `docs/api/openapi.yaml`.

## Out of Scope

- Implementing the remaining 13 `operationId` handlers in `docs/api/openapi.yaml` (`listCurriculumPacks`, `validateCurriculumPack`, `registerCurriculumPack`, `createGameSession`, etc.), which will each be registered in `createApp(deps)` as their vertical slices are built.

## Further Notes

- Framework Research Note: [`wiki/12-serverless-function-and-endpoint-frameworks-research.md`](../../wiki/12-serverless-function-and-endpoint-frameworks-research.md)
- Handler Factory Pattern Note: [`wiki/11-simple-factory-and-transformer-handler-pattern.md`](../../wiki/11-simple-factory-and-transformer-handler-pattern.md)
- Architecture Standard: [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md) and [`docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md`](../../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
- OpenAPI 3.1 Contract: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) (`operationId: getCurriculumPackById`)
