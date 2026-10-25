# Spec: `GET /api/v1/packs/{packId}` — Hexagonal DDD Single-Endpoint Vertical Slice (with MongoDB)

Status: ready-for-agent

## Problem Statement

Every workflow in the Concept-Chain Educational Game Platform—rendering the 7×7 keyword board, running the 15-minute Trial Orientation with Figure 2 Calibration Examples, administering the 10-question Pretest/Posttest Assessment Instrument, and collecting the 9-item Perception Survey—depends on fetching a **Curriculum Pack** by its `packId` via `GET /api/v1/packs/{packId}`.

However, serving `GET /api/v1/packs/{packId}` in production requires satisfying four competing constraints simultaneously:
1. **Complete Clinical Fidelity**: The built-in `diabe-teach` Curriculum Pack must accurately expose all 49 verbatim Appendix 1 Keyword Cards, 7 Semantic Domains, the Figure 2 reference 7×7 board and Calibration Examples (Valid Chain A [9 cards], Valid Chain B [7 cards], and Invalid Chain C [non-adjacent transition]), 10 Bloom Level 2/3 multiple-choice questions, and 9 Appendix 2 Likert survey items.
2. **Answer-Key Secrecy Across Pretest and Posttest**: Because the *Diabe-teach* RCT protocol administers the exact same 10 multiple-choice questions in the Pretest and Posttest, anonymous callers and learners holding a `participantToken` must never receive `correctIndex` or `explanation` in `GET /api/v1/packs/{packId}`, whereas an instructor holding a valid `instructorToken` must receive the full unredacted assessment key—and a caller passing a malformed or tampered `Authorization` header must receive an immediate `401 UNAUTHORIZED_TOKEN` error rather than a silent downgrade.
3. **Hexagonal DDD Ring Isolation**: The `CurriculumPack` Aggregate Root and `PackId` Value Object in the Domain Ring must remain 100% pure and free of HTTP, OpenAPI, or MongoDB driver concerns, with role-aware redaction handled in the Application Ring and OpenAPI `Response` formatting handled in the HTTP Driving Adapter.
4. **Hybrid Built-In + MongoDB Persistence on Netlify Serverless**: On Netlify Functions v2, requests for the built-in `diabe-teach` pack should resolve in-memory in $O(1)$ without incurring a database network round-trip, while requests for custom-registered `packId`s query the **MongoDB** `curriculum_packs` collection via a warm-cached `MongoClient` Driven Adapter (and return `404 PACK_NOT_FOUND` when absent from both).

## Solution

Implement the end-to-end **`GET /api/v1/packs/{packId}`** vertical slice across all four Hexagonal DDD rings (`Domain`, `Application`, `Driving Adapters`, `Driven Adapters` with **MongoDB**) and the Netlify Functions v2 catch-all Composition Root:

1. **Domain Ring**:
   - Define the `PackId` Value Object and the immutable `CurriculumPack` Aggregate Root (with `BoardConfig`, `SemanticDomain`, `KeywordCard`, `AdjudicationRubric`, `CalibrationExample`, `AssessmentInstrument`, and `PerceptionSurvey` Value Objects).
   - Provide the canonical built-in `DIABE_TEACH_PACK` Aggregate Root populated from the primary RCT sources (`papers/diabe-teach.pdf` and `papers/supplementary_material_1.docx`).
   - Define typed Domain Errors: `PackNotFoundError` and `UnauthorizedTokenError`.
2. **Application Ring**:
   - Define outbound Driven Ports: `CurriculumPackRepositoryPort` (`findById(packId)`) and `CapabilityTokenPort` (`verifyToken(rawBearerToken)`).
   - Implement `GetCurriculumPackByIdUseCase` (inbound Driving Port) and `CurriculumPackProjector` (role-aware DTO mapper that strips `correctIndex` and `explanation` for `"anonymous"` and `"participant"` roles while preserving them for `"instructor"`, without mutating the `CurriculumPack` Aggregate Root).
3. **Driving Adapter Ring (Web-Standard HTTP)**:
   - Implement `createApp({ packRepo, tokenVerifier })` exposing `{ fetch(request: Request): Promise<Response> }`.
   - Route `GET /api/v1/packs/:packId`, parse optional `Authorization: Bearer <token>` headers, invoke `GetCurriculumPackByIdUseCase`, and map outputs to OpenAPI `200 OK` (`{ pack: PublicCurriculumPack }`), `401 Unauthorized` (`UNAUTHORIZED_TOKEN`), or `404 Not Found` (`PACK_NOT_FOUND`).
4. **Driven Adapters Ring (MongoDB + In-Memory) & Netlify Composition Root**:
   - Implement `InMemoryCurriculumPackRepository` (pre-loaded with `DIABE_TEACH_PACK` for fast zero-I/O testing).
   - Implement `MongoCurriculumPackRepository` (resolving built-in packs like `diabe-teach` in-memory first, then querying the **MongoDB** `curriculum_packs` collection by `_id: packId.value` and rehydrating the `CurriculumPack` Aggregate Root).
   - Provide a serverless-safe MongoDB connection manager (`getMongoDatabase(uri, dbName)`) that caches the `MongoClient` promise across warm Netlify Functions v2 invocations (`maxPoolSize: 5`).
   - Implement `HmacCapabilityTokenAdapter` (stateless HMAC-SHA256 verification of `CapabilityToken` payloads) and `FakeCapabilityTokenAdapter` (for deterministic tests).
   - Wire the Netlify Functions v2 catch-all handler (`path: "/api/v1/*"`) as a thin Composition Root reading `MONGODB_URI`, `MONGODB_DB_NAME`, and `CAPABILITY_TOKEN_SECRET`, instantiating `MongoCurriculumPackRepository` and `HmacCapabilityTokenAdapter`, and delegating to `createApp(deps).fetch(request)`.

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
11. As a platform engineer running on Netlify Functions v2, I want the MongoDB Driven Adapter to reuse a module-scoped cached `MongoClient` connection across warm serverless invocations with a bounded connection pool, so that serverless executions do not exhaust MongoDB Atlas connection limits.
12. As a domain engineer, I want the `CurriculumPack` Aggregate Root to remain completely immutable when `CurriculumPackProjector` produces a redacted `PublicCurriculumPack` DTO, so that redacting fields for a learner never mutates the cached in-memory `DIABE_TEACH_PACK` instance for subsequent instructor requests.
13. As a developer running `lint:boundaries`, I want `dependency-cruiser` to verify that Domain and Application modules never import the `mongodb` driver package directly.

## Implementation Decisions

- **Hexagonal Ring Responsibilities for `GET /api/v1/packs/{packId}`**:
  - **Domain Ring (`src/domain/`)**:
    - `PackId`: Value Object validating non-empty trimmed slug identifier.
    - `CurriculumPack`: Immutable Aggregate Root holding `id: PackId`, `title`, `version`, `description`, `boardConfig: BoardConfig`, `domains: readonly SemanticDomain[]`, `cards: readonly KeywordCard[]`, `adjudicationRubric: AdjudicationRubric`, `assessmentInstrument: AssessmentInstrument | null`, and `perceptionSurvey: PerceptionSurvey | null`, plus $O(1)$ card lookup helpers (`getCardById`, `resolveCardByLabelOrAlias`).
    - `DIABE_TEACH_PACK`: Built-in `CurriculumPack` instance containing the 49 Appendix 1 keywords, 7 clinical domains, Figure 2 calibration board and chains A/B/C, 10 Bloom Level 2/3 MCQs, and 9 Appendix 2 Likert survey items.
    - `DomainError` hierarchy: base `DomainError` class with `PackNotFoundError` and `UnauthorizedTokenError`.
  - **Application Ring (`src/application/`)**:
    - `CurriculumPackRepositoryPort`: `{ findById(packId: PackId): Promise<CurriculumPack | null> }`.
    - `CapabilityTokenPort`: `{ verifyToken(token: string): Promise<VerifiedCapability | null> }` where `VerifiedCapability` has `{ role: "instructor" | "participant", sessionId: string, participantId?: string }`.
    - `GetCurriculumPackByIdUseCase`:
      1. If a raw `authorizationHeader` is present, parses the `Bearer <token>` format (throwing `UnauthorizedTokenError` if malformed) and verifies the token via `CapabilityTokenPort.verifyToken(token)` (throwing `UnauthorizedTokenError` if `null`).
      2. Resolves caller role as `"anonymous"` (no header), `"participant"`, or `"instructor"`.
      3. Queries `CurriculumPackRepositoryPort.findById(PackId.create(rawPackId))`; throws `PackNotFoundError(rawPackId)` if `null`.
      4. Projects the `CurriculumPack` Aggregate Root via `CurriculumPackProjector.toPublicDto(pack, { includeAnswerKeys: role === "instructor" })` and returns `{ pack }`.
  - **Driving Adapter Ring (`src/adapters/driving/http/`)**:
    - `createApp({ packRepo, tokenVerifier })` matches `GET /api/v1/packs/:packId` (URL-decoding `packId`), delegates to `GetCurriculumPackByIdUseCase`, returns `200 OK` with `Content-Type: application/json`, and maps `UnauthorizedTokenError` $\to$ `401 UNAUTHORIZED_TOKEN` and `PackNotFoundError` $\to$ `404 PACK_NOT_FOUND` (conforming to `#/components/schemas/ApiErrorResponse` in `docs/api/openapi.yaml`).
  - **Driven Adapters Ring (`src/adapters/driven/`)**:
    - `InMemoryCurriculumPackRepository`: Map-backed repository pre-populated with `DIABE_TEACH_PACK`.
    - `MongoCurriculumPackRepository`:
      - Accepts a minimal MongoDB collection interface (`CurriculumPackCollectionLike` with `findOne(filter: { _id: string }): Promise<CurriculumPackDocument | null>`) or lazy `Db` provider so it works with the official `mongodb` Node driver in production and a lightweight collection stub in unit tests.
      - Checks the built-in pack map (`DIABE_TEACH_PACK`) first in $O(1)$; only queries MongoDB collection `curriculum_packs` (`findOne({ _id: packId.value })`) when the requested `packId` is not a built-in pack, mapping the stored BSON/JSON document back into a validated `CurriculumPack` Aggregate Root.
    - `mongoClientSingleton`: Module-scoped cached `MongoClient` helper configured with serverless-friendly timeouts and `maxPoolSize: 5` for Netlify Functions v2 warm container reuse.
    - `HmacCapabilityTokenAdapter` & `FakeCapabilityTokenAdapter`: Implements `CapabilityTokenPort` using Web Crypto / Node HMAC-SHA256 in production and a deterministic token table in tests.
  - **Composition Root (`netlify/functions/api.ts`)**:
    - Reads `MONGODB_URI`, `MONGODB_DB_NAME` (default `"diabe_teach"`), and `CAPABILITY_TOKEN_SECRET`, instantiates `MongoCurriculumPackRepository` and `HmacCapabilityTokenAdapter`, and delegates incoming Web `Request` objects to `createApp(deps).fetch(request)` with `export const config = { path: "/api/v1/*" }`.

## Testing Decisions

- **Primary Testing Seam (`createApp({ packRepo, tokenVerifier }).fetch(request)`)**:
  - Integration and OpenAPI contract tests exercise `GET /api/v1/packs/{packId}` through the Web-Standard `Request` $\to$ `Response` boundary with `InMemoryCurriculumPackRepository` and `FakeCapabilityTokenAdapter`:
    1. `GET /api/v1/packs/diabe-teach` (no `Authorization` header) $\to$ `200 OK`, returns 49 cards, 7 domains, Figure 2 Chains A/B/C, 10 MCQs with `correctIndex` and `explanation` `undefined`, and 9 Likert survey items.
    2. `GET /api/v1/packs/diabe-teach` with `Authorization: Bearer <valid-participant-token>` $\to$ `200 OK`, `correctIndex` and `explanation` omitted.
    3. `GET /api/v1/packs/diabe-teach` with `Authorization: Bearer <valid-instructor-token>` $\to$ `200 OK`, `correctIndex` (`0..3`) and `explanation` present on all 10 MCQs.
    4. Immutability check: calling `GET /api/v1/packs/diabe-teach` as an instructor *after* an anonymous request still returns `correctIndex` and `explanation`, and calling as an anonymous user *after* an instructor request still omits them.
    5. `GET /api/v1/packs/diabe-teach` with `Authorization: Basic abc`, `Authorization: Bearer `, or `Authorization: Bearer invalid-token` $\to$ `401 Unauthorized` with `{ code: "UNAUTHORIZED_TOKEN", message: "..." }`.
    6. `GET /api/v1/packs/non-existent-pack` $\to$ `404 Not Found` with `{ code: "PACK_NOT_FOUND", message: "...", details: { packId: "non-existent-pack" } }`.
- **Secondary Testing Seams**:
  - **Domain Aggregate Tests**: Verify `DIABE_TEACH_PACK` contains all 49 exact Appendix 1 `verbatimLabel` strings, resolves aliases (`"Hyperglycemia"` $\to$ `"hyperglycaemia"`, `"lipodistrophy"` $\to$ `"lipo-hypertrophy"`), and represents Figure 2 Chains A, B, and C accurately.
  - **MongoDB Driven Adapter Contract Tests**: Verify `MongoCurriculumPackRepository` returns `DIABE_TEACH_PACK` with zero MongoDB `findOne` calls, queries `curriculum_packs.findOne({ _id: "cardio-teach" })` and rehydrates the `CurriculumPack` Aggregate Root when `packId !== "diabe-teach"`, and returns `null` when the MongoDB collection returns `null`.
  - **Boundary Lint**: Verify `dependency-cruiser` passes with zero violations across `src/domain/`, `src/application/`, `src/adapters/`, and `netlify/functions/` (ensuring `mongodb` is only imported inside `src/adapters/driven/` and `netlify/functions/`).

## Out of Scope

- All other 13 endpoints in `docs/api/openapi.yaml` (`GET /api/v1/packs` list, `POST /api/v1/packs`, `POST /api/v1/packs/validate`, `/api/v1/sessions/*`, `/chains/*`, `/assessments/*`, `/survey`, `/analytics`) — these will be specified and implemented in subsequent vertical slices.
- Frontend React/Next.js UI components.

## Further Notes

- Architecture Standard: [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md) and [`.scratch/hexagonal-ddd-netlify-api/spec.md`](../hexagonal-ddd-netlify-api/spec.md)
- OpenAPI 3.1 Contract: [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) (`operationId: getCurriculumPackById`) and [`.scratch/openapi-contract/spec.md`](../openapi-contract/spec.md)
- Domain Glossary: [`GLOSSARY.md`](../../GLOSSARY.md)
