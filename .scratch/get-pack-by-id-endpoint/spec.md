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
7. **Common Netlify Runtime Config & Hybrid Built-In + MongoDB Persistence**: Shared Netlify environment parsing, cached production Outbound Adapter wiring (`MongoCurriculumPackRepository` + `HmacCapabilityTokenAdapter`), and handler wrapping (`createNetlifyFunctionHandler`) must live in a common `netlify/config/` layer used by the Netlify Functions v2 entrypoint (`netlify/functions/api.ts`) and configured via `netlify.toml`.

## Solution

Implement the end-to-end **`GET /api/v1/packs/{packId}`** vertical slice across all four Hexagonal DDD rings (`Domain`, `Application`, `Inbound Adapters`, `Outbound Adapters` with **MongoDB**), centrally routed by **`openapi-backend`** from `docs/api/openapi.yaml` and deployed via a shared **Netlify Functions v2** configuration (`netlify/config/` + `netlify/functions/api.ts` + `netlify.toml`):

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
4. **Outbound Adapters Ring (`src/adapters/outbound/`) & Shared Netlify Deployment Config (`netlify/config/`, `netlify/functions/api.ts`, `netlify.toml`)**:
   - Separate MongoDB repository contracts (`CurriculumPackDocument`, `CurriculumPackCollectionLike`, `MongoCurriculumPackRepositoryOptions`) into `mongo-curriculum-pack-repository.types.ts`.
   - Implement `InMemoryCurriculumPackRepository`, `MongoCurriculumPackRepository`, `getMongoDatabase`, `HmacCapabilityTokenAdapter`, and `FakeCapabilityTokenAdapter`.
   - Implement shared Netlify runtime configuration (`netlify-runtime.types.ts`, `netlify-runtime.config.ts`) and common Netlify handler wrapper (`create-netlify-function-handler.ts`), wired into `netlify/functions/api.ts` and `netlify.toml` (`included_files = ["docs/api/openapi.yaml"]`).

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
13. As a platform engineer deploying to Netlify Functions v2, I want a shared Netlify runtime configuration (`netlify/config/`) and `netlify.toml` (`included_files = ["docs/api/openapi.yaml"]`) that wires production Outbound Adapters into `netlify/functions/api.ts` via `createNetlifyFunctionHandler`.
14. As a code reviewer, I want every module in the codebase to separate interface/contract definitions (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from class and factory implementations (`*.ts`, `*.use-case.ts`, `*.handler.ts`, `*.factory.ts`), and use intuitive `src/adapters/inbound/` and `src/adapters/outbound/` directories.
15. As a developer running `lint:boundaries`, I want `dependency-cruiser` to verify that Domain and Application modules never import `mongodb`, `openapi-backend`, or `@netlify/functions`, and that Inbound and Outbound Adapters never import each other directly.

## Implementation Decisions

- **Central YAML Routing via `openapi-backend` (`src/adapters/inbound/http/create-app.ts`)**:
  - Uses `OpenAPIBackend` from `openapi-backend` pointed at `docs/api/openapi.yaml` with `quick: true` and `validate: false` (since domain/application validation produces canonical `DomainError` codes).
  - Maps `operationId: getCurriculumPackById` to `createGetPackByIdHandler(deps)`, forwarding extracted path parameters (`c.request.params.packId`) via `RouteContext`.
  - Registers `notFound` and `notImplemented` handlers so both unknown URLs and not-yet-implemented OpenAPI operations return structured JSON `Response` objects.
- **Request Transformer + Endpoint Handler Factory Pipeline (`src/adapters/inbound/http/`)**:
  - `endpoint-handler.factory.ts` provides `createEndpointHandler({ transformRequest, execute, successStatus })`, centralizing JSON serialization and `DomainError` $\to$ `ApiErrorResponse` translation.
  - `get-pack-by-id.handler.ts` exports the pure `transformGetPackByIdRequest` transformer and `createGetPackByIdHandler` factory.
- **No God Modules — Dedicated Interface/Contract Files Across All Rings**:
  - Domain contracts in `curriculum-pack.types.ts`; Application contracts in `get-curriculum-pack-by-id.port.ts`, `curriculum-pack-repository.port.ts`, `capability-token.port.ts`, and `curriculum-pack.dto.ts`; Inbound HTTP contracts in `http-handler.types.ts`; Outbound MongoDB contracts in `mongo-curriculum-pack-repository.types.ts`; Netlify runtime contracts in `netlify-runtime.types.ts`.
- **Common Netlify Runtime Config & Handler Wrapper (`netlify/config/` & `netlify.toml`)**:
  - `netlify-runtime.config.ts` provides `loadNetlifyRuntimeEnvConfig`, `buildNetlifyProductionDependencies`, `getNetlifyProductionDependencies`, and `defineNetlifyRouteConfig`.
  - `create-netlify-function-handler.ts` provides `createNetlifyFunctionHandler` to adapt any Inbound HTTP handler to Netlify's `(request: Request, context: Context)` signature.
  - `netlify.toml` configures `directory = "netlify/functions"`, `node_bundler = "esbuild"`, and `included_files = ["docs/api/openapi.yaml"]`.

## Testing Decisions

- **Primary Testing Seam (`createApp(deps)` & `netlify/functions/api.ts`)**:
  - Exercise `createApp(deps).fetch(request)` through `openapi-backend` (`docs/api/openapi.yaml` $\to$ `operationId: getCurriculumPackById` $\to$ `transformGetPackByIdRequest` $\to$ `GetCurriculumPackByIdUseCase` $\to$ `CurriculumPackProjector`).
  - Exercise `createGetPackByIdHandler(deps)(request, { params: { packId: "diabe-teach" } })` directly with `context.params`.
  - Exercise `netlify/functions/api.ts` and `createNetlifyFunctionHandler` with `loadNetlifyRuntimeEnvConfig` and `defineNetlifyRouteConfig`.
  - Verify `404` / `501` responses when calling unknown routes or unimplemented OpenAPI operations in `docs/api/openapi.yaml`.

## Out of Scope

- Implementing the remaining 13 `operationId` handlers in `docs/api/openapi.yaml` (`listCurriculumPacks`, `validateCurriculumPack`, `registerCurriculumPack`, `createGameSession`, etc.), which will each be registered in `createApp(deps)` as their vertical slices are built.

## Further Notes

- Framework Research Note: [`wiki/12-serverless-function-and-endpoint-frameworks-research.md`](../../wiki/12-serverless-function-and-endpoint-frameworks-research.md)
- Handler Factory Pattern Note: [`wiki/11-simple-factory-and-transformer-handler-pattern.md`](../../wiki/11-simple-factory-and-transformer-handler-pattern.md)
- Architecture Standard: [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md) and [`docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md`](../../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
- OpenAPI 3.1 Contract: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) (`operationId: getCurriculumPackById`)
