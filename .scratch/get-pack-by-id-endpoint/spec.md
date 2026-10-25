# Spec: `GET /api/v1/packs/{packId}` — Hexagonal DDD Single-Endpoint Vertical Slice (Netlify / AWS Lambda Native Routing + MongoDB)

Status: ready-for-agent

## Problem Statement

Every workflow in the Concept-Chain Educational Game Platform—rendering the 7×7 keyword board, running the 15-minute Trial Orientation with Figure 2 Calibration Examples, administering the 10-question Pretest/Posttest Assessment Instrument, and collecting the 9-item Perception Survey—depends on fetching a **Curriculum Pack** by its `packId` via `GET /api/v1/packs/{packId}`.

However, serving `GET /api/v1/packs/{packId}` on **Netlify Functions v2** (and **AWS Lambda** under the hood) requires satisfying five competing constraints simultaneously:
1. **Complete Clinical Fidelity**: The built-in `diabe-teach` Curriculum Pack must accurately expose all 49 verbatim Appendix 1 Keyword Cards, 7 Semantic Domains, the Figure 2 reference 7×7 board and Calibration Examples (Valid Chain A [9 cards], Valid Chain B [7 cards], and Invalid Chain C [non-adjacent transition]), 10 Bloom Level 2/3 multiple-choice questions, and 9 Appendix 2 Likert survey items.
2. **Answer-Key Secrecy Across Pretest and Posttest**: Because the *Diabe-teach* RCT protocol administers the exact same 10 multiple-choice questions in the Pretest and Posttest, anonymous callers and learners holding a `participantToken` must never receive `correctIndex` or `explanation` in `GET /api/v1/packs/{packId}`, whereas an instructor holding a valid `instructorToken` must receive the full unredacted assessment key—and a caller passing a malformed or tampered `Authorization` header must receive an immediate `401 UNAUTHORIZED_TOKEN` error rather than a silent downgrade.
3. **Hexagonal DDD Ring Isolation**: The `CurriculumPack` Aggregate Root and `PackId` Value Object in the Domain Ring must remain 100% pure and free of HTTP, OpenAPI, Netlify, or MongoDB driver concerns, with role-aware redaction handled in the Application Ring and OpenAPI `Response` formatting handled in the HTTP Driving Adapter.
4. **Native Netlify Functions v2 (`Config` + `Context.params`) & AWS Lambda (`pathParameters`) Routing**: Instead of maintaining a custom monolithic catch-all router, the endpoint must deploy as a dedicated Netlify Function (`netlify/functions/get-pack-by-id.ts`) that exports `export const config: Config = { path: "/api/v1/packs/:packId", method: "GET" }` (from `@netlify/functions`), letting Netlify's platform edge router match the URL and method before invoking the underlying AWS Lambda container and passing `context.params.packId` into a portable HTTP Driving Adapter (`(request, context?: { params?: Record<string, string | undefined> }) => Promise<Response>`).
5. **Hybrid Built-In + MongoDB Persistence**: Requests for the built-in `diabe-teach` pack should resolve in-memory in $O(1)$ without incurring a database network round-trip, while requests for custom-registered `packId`s query the **MongoDB** `curriculum_packs` collection via a warm-cached `MongoClient` Driven Adapter (and return `404 PACK_NOT_FOUND` when absent from both).

## Solution

Implement the end-to-end **`GET /api/v1/packs/{packId}`** vertical slice across all four Hexagonal DDD rings (`Domain`, `Application`, `Driving Adapters`, `Driven Adapters` with **MongoDB**) and a dedicated **Netlify Functions v2** per-endpoint Composition Root (`netlify/functions/get-pack-by-id.ts`):

1. **Domain Ring**:
   - Define the `PackId` Value Object and the immutable `CurriculumPack` Aggregate Root (with `BoardConfig`, `SemanticDomain`, `KeywordCard`, `AdjudicationRubric`, `CalibrationExample`, `AssessmentInstrument`, and `PerceptionSurvey` Value Objects).
   - Provide the canonical built-in `DIABE_TEACH_PACK` Aggregate Root populated from the primary RCT sources (`papers/diabe-teach.pdf` and `papers/supplementary_material_1.docx`).
   - Define typed Domain Errors: `PackNotFoundError` and `UnauthorizedTokenError`.
2. **Application Ring**:
   - Define outbound Driven Ports: `CurriculumPackRepositoryPort` (`findById(packId)`) and `CapabilityTokenPort` (`verifyToken(rawBearerToken)`).
   - Implement `GetCurriculumPackByIdUseCase` (inbound Driving Port) and `CurriculumPackProjector` (role-aware DTO mapper that strips `correctIndex` and `explanation` for `"anonymous"` and `"participant"` roles while preserving them for `"instructor"`, without mutating the `CurriculumPack` Aggregate Root).
3. **Driving Adapter Ring (Portable Web-Standard + `context.params` / Lambda `pathParameters`)**:
   - Implement `createGetPackByIdHandler({ packRepo, tokenVerifier })` returning `(request: Request, context?: { params?: Record<string, string | undefined> }) => Promise<Response>` (and keep `createApp(deps)` delegating to it).
   - Extract `packId` directly from `context?.params?.packId` (populated natively by Netlify Functions v2 `URLPattern` routing or AWS Lambda `event.pathParameters`), falling back to URL path extraction when `context` is omitted in plain `Request` unit tests.
   - Parse optional `Authorization: Bearer <token>` headers, invoke `GetCurriculumPackByIdUseCase`, and map outputs to OpenAPI `200 OK` (`{ pack: PublicCurriculumPack }`), `401 Unauthorized` (`UNAUTHORIZED_TOKEN`), or `404 Not Found` (`PACK_NOT_FOUND`).
4. **Driven Adapters Ring (MongoDB + In-Memory) & Per-Endpoint Netlify Composition Root**:
   - Implement `InMemoryCurriculumPackRepository` (pre-loaded with `DIABE_TEACH_PACK` for fast zero-I/O testing).
   - Implement `MongoCurriculumPackRepository` (resolving built-in packs like `diabe-teach` in-memory first, then querying the **MongoDB** `curriculum_packs` collection by `_id: packId.value` and rehydrating the `CurriculumPack` Aggregate Root).
   - Provide a serverless-safe MongoDB connection manager (`getMongoDatabase(uri, dbName)`) that caches the `MongoClient` promise across warm Netlify / Lambda invocations (`maxPoolSize: 5`).
   - Implement `HmacCapabilityTokenAdapter` (stateless HMAC-SHA256 verification of `CapabilityToken` payloads) and `FakeCapabilityTokenAdapter` (for deterministic tests).
   - Wire the dedicated Netlify Function (`netlify/functions/get-pack-by-id.ts`) typed with `@netlify/functions` `Config` (`{ path: "/api/v1/packs/:packId", method: "GET" }`) and `Context` (`context.params.packId`), delegating `(request, context)` to `createGetPackByIdHandler(deps)`.

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
11. As a platform engineer deploying to Netlify Functions v2, I want `netlify/functions/get-pack-by-id.ts` to export `config: Config = { path: "/api/v1/packs/:packId", method: "GET" }` so Netlify's platform edge router matches the route and HTTP method natively and passes `context.params.packId` into the handler without preventing sibling routes like `POST /api/v1/packs/validate`.
12. As a platform engineer deploying to either Netlify Functions v2 (`context.params.packId`) or AWS Lambda (`event.pathParameters.packId`), I want `createGetPackByIdHandler(deps)` in the HTTP Driving Adapter to read `context.params.packId` directly without coupling `src/adapters/driving/` to `@netlify/functions`.
13. As a domain engineer, I want the `CurriculumPack` Aggregate Root to remain completely immutable when `CurriculumPackProjector` produces a redacted `PublicCurriculumPack` DTO, so that redacting fields for a learner never mutates the cached in-memory `DIABE_TEACH_PACK` instance for subsequent instructor requests.
14. As a developer running `lint:boundaries`, I want `dependency-cruiser` to verify that Domain and Application modules never import `mongodb` or `@netlify/functions`, and that `@netlify/functions` is imported only in `netlify/functions/`.
15. As a code reviewer, I want every module in the `GET /api/v1/packs/{packId}` vertical slice to separate interface/type definitions (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from class and factory implementations (`*.ts`, `*.use-case.ts`, `*.handler.ts`, `*.factory.ts`), eliminating "god modules" that mix contracts and runtime classes in the same file.

## Implementation Decisions

- **No God Modules — Dedicated Interface/Contract Files Across All Four Rings**:
  - **Domain Ring**: Separate all Value Object and Aggregate property interfaces (`AdjacencyRule`, `BoardConfig`, `SemanticDomain`, `KeywordCard`, `GridCoord`, `CalibrationExample`, `AdjudicationRubric`, `AssessmentQuestion`, `AssessmentInstrument`, `PerceptionSurveyItem`, `PerceptionSurvey`, `CurriculumPackProps`) into `curriculum-pack.types.ts`, leaving `curriculum-pack.ts` with only the `CurriculumPack` Aggregate Root class.
  - **Application Ring**:
    - Separate DTO interfaces (`PublicAssessmentQuestionDto`, `PublicCurriculumPackDto`, `CurriculumPackProjectionOptions`) into `curriculum-pack.dto.ts`, leaving `curriculum-pack-projector.ts` with only the `CurriculumPackProjector` class.
    - Separate inbound Driving Port contracts (`GetCurriculumPackByIdQuery`, `GetCurriculumPackByIdResult`, `GetCurriculumPackByIdDependencies`, `GetCurriculumPackByIdUseCasePort`) into `get-curriculum-pack-by-id.port.ts`, leaving `get-curriculum-pack-by-id.use-case.ts` with only the `GetCurriculumPackByIdUseCase` class.
  - **Driven Adapter Ring**: Separate MongoDB collection/document contracts (`CurriculumPackDocument`, `CurriculumPackCollectionLike`, `MongoCurriculumPackRepositoryOptions`) into `mongo-curriculum-pack-repository.types.ts`, leaving `mongo-curriculum-pack-repository.ts` with only the `MongoCurriculumPackRepository` class.
  - **Driving Adapter Ring**: Separate HTTP handler and pipeline contracts (`RouteContext`, `HttpRequestInput`, `EndpointHttpHandler`, `HttpEndpointDefinition`, `GetPackByIdHandlerDependencies`, `AppDependencies`, `HttpApp`) into `http-handler.types.ts`, leaving `endpoint-handler.factory.ts`, `get-pack-by-id.handler.ts`, and `create-app.ts` with only pure functions and factory implementations.
- **Per-Endpoint Netlify Function (`netlify/functions/get-pack-by-id.ts`) & Shared Netlify Config (`netlify/config/`)**:
  - Centralizes Netlify runtime environment parsing, cached production Driven Adapter wiring (`getNetlifyProductionDependencies`), and route config definition (`defineNetlifyRouteConfig`) in `netlify/config/netlify-runtime.config.ts` (with contracts in `netlify/config/netlify-runtime.types.ts`).
  - Provides a shared `createNetlifyFunctionHandler(createDrivingHandler, deps?)` wrapper in `netlify/config/create-netlify-function-handler.ts` that bridges Netlify's `(request: Request, context: Context)` signature to `endpointHandler(request, { params: context?.params })`.
  - Keeps `netlify/functions/get-pack-by-id.ts` as a declarative 2-statement Composition Root (`export default createNetlifyFunctionHandler(createGetPackByIdHandler)` and `export const config = defineNetlifyRouteConfig({ path: "/api/v1/packs/:packId", method: "GET" })`).
- **Portable HTTP Driving Adapter (`src/adapters/driving/http/get-pack-by-id.handler.ts`)**:
  - Defines a vendor-agnostic `RouteContext` interface `{ readonly params?: Readonly<Record<string, string | undefined>> }` compatible with both Netlify's `Context` (`context.params`) and AWS Lambda API Gateway v2 (`{ params: event.pathParameters }`).
  - `createGetPackByIdHandler(deps)` extracts `rawPackId` from `context?.params?.packId` first (decoding URI components) and falls back to matching `/api/v1/packs/:packId` from `new URL(request.url).pathname` when `context?.params?.packId` is not provided.
- **Boundary Enforcement (`.dependency-cruiser.cjs`)**:
  - Adds a rule `netlify-sdk-isolated-to-composition-root` ensuring `@netlify/functions` is only imported inside `netlify/functions/**` and never inside `src/domain/**`, `src/application/**`, or `src/adapters/**`.

## Testing Decisions

- **Primary Testing Seam (`createGetPackByIdHandler(deps)` & `createApp(deps)`)**:
  - Verify `createGetPackByIdHandler(deps)(request, { params: { packId: "diabe-teach" } })` resolves `packId` directly from `context.params.packId` (simulating Netlify Functions v2 `Context` and AWS Lambda `pathParameters`), even if `request.url` is an internal Lambda/function invocation URL.
  - Verify `netlify/functions/get-pack-by-id.ts` exports `config = { path: "/api/v1/packs/:packId", method: "GET" }` and serves `200 OK` when invoked with a Netlify `Context` containing `params: { packId: "diabe-teach" }`.
  - Retain all 12 existing contract and unit tests for `200` redacted/unredacted responses, `401 UNAUTHORIZED_TOKEN`, `404 PACK_NOT_FOUND`, and MongoDB hybrid lookup.

## Out of Scope

- Other endpoint function files under `netlify/functions/` (`list-packs.ts`, `validate-pack.ts`, `register-pack.ts`, `create-session.ts`, etc.), which will each get their own `netlify/functions/<endpoint>.ts` file when their vertical slices are implemented.

## Further Notes

- Routing Research Note: [`wiki/10-netlify-and-lambda-routing-research.md`](../../wiki/10-netlify-and-lambda-routing-research.md)
- Architecture Standard: [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md) and [`docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md`](../../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
- OpenAPI 3.1 Contract: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) (`operationId: getCurriculumPackById`)
