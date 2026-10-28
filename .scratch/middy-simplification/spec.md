# Spec: Inbound HTTP Simplification with Middy & Role-Based Handlers

Status: ready-for-agent

## Problem Statement

The inbound HTTP adapter layer currently routes requests through `openapi-backend` by loading, reading, and parsing the entire `docs/api/openapi.yaml` specification at runtime using custom class wrappers (`OpenApiHttpApp`, `BaseHttpHandler`). While contract-driven, this introduces notable friction:
1. **Cold Start & Runtime Overhead**: Parsing a large multi-kilobyte OpenAPI document on every serverless initialization creates runtime overhead and complex bundling requirements (`included_files` in `netlify.toml`).
2. **Coupling to Runtime OpenAPI Resolvers**: Debugging request dispatching, security handler evaluation, and path parameter extraction requires understanding `openapi-backend` internal state machines and lifecycle hooks.
3. **Boilerplate Handler Mapping**: Transforming native Netlify and AWS Lambda events into Fetch standard `Request` objects only to have `openapi-backend` transform them back into custom router contexts adds unnecessary abstraction layers.

Developers need a simple, lightweight, idiomatic serverless routing and middleware architecture that parses incoming events directly into clean application query objects, separates responsibilities by consumer role, and removes OpenAPI parsing from the serverless runtime.

## Solution

Replace runtime `openapi-backend` with **Middy (`@middy/core`)** and its ecosystem:
1. **Remove `openapi-backend` from runtime**: Remove `openapi-backend` from dependencies and runtime dispatching. Keep `docs/api/openapi.yaml` strictly as static documentation and client contract.
2. **Role-Based Inbound Handlers**: Group and structure endpoint handlers by consumer role (e.g. public/curriculum pack access, instructor capabilities, and learner/participant game workflows) so each module has a single cohesive responsibility.
3. **Event Adapter & Normalization Middleware**:
   - Use standard Middy middlewares (`@middy/http-header-normalizer`, `@middy/http-cors`).
   - Implement a lightweight authentication middleware that validates API keys and decodes capability tokens into request context.
   - Map domain errors (`PackNotFoundError`, `UnauthorizedTokenError`) to standardized JSON responses through an error-handling middleware.
4. **Preserve Pure Hexagonal Domain & Application Layers**:
   - The Domain (`src/domain/`) and Application (`src/application/`) layers remain 100% pure and unchanged.
   - Outbound persistence (`MongoCurriculumPackRepository`, `MongoConnectionManager`) and runtime composition (`AppRuntime`) remain intact.

## User Stories

1. As an API client sending a `GET /api/v1/packs/diabe-teach` request, I want to receive the curriculum pack in a fast, low-latency response without runtime OpenAPI YAML parsing overhead.
2. As an API client with an anonymous or participant token, I want assessment answer keys (`correctIndex`, `explanation`) to be redacted automatically.
3. As an instructor with a valid bearer token, I want to receive full unredacted assessment instruments.
4. As an API client sending an invalid or malformed bearer token or API key, I want to receive an immediate `401 Unauthorized` with `{ code: "UNAUTHORIZED_TOKEN", message: "..." }`.
5. As an API client requesting a non-existent curriculum pack, I want to receive `404 Not Found` with `{ code: "PACK_NOT_FOUND", message: "..." }`.
6. As a backend developer, I want handlers organized by caller role so that security rules and query mappings are localized rather than scattered across generic routing tables.
7. As a serverless platform engineer, I want the Netlify Function entrypoint to delegate directly to a Middy pipeline that normalizes headers and converts path parameters and authorization headers into clean use-case queries.
8. As a maintainer, I want `npm test`, `npm run lint`, and `npm run typecheck` to execute with zero warnings, zero errors, and clean boundary checks.

## Implementation Decisions

- **Middy Pipeline Architecture**:
  - Adopt `@middy/core` and `@middy/http-router` to define routes declaratively with HTTP method and path patterns.
  - Apply global middleware on the root router:
    - `@middy/http-header-normalizer`: Normalizes all incoming headers to lowercase.
    - `authMiddleware`: Validates `x-api-key` and extracts Bearer JWT tokens into `request.auth` context.
    - `errorMappingMiddleware`: Intercepts `DomainError` instances and produces formatted JSON error responses with appropriate status codes (`401`, `404`, `500`).
- **Role-Based Inbound Handler Modules**:
  - Replace `OpenApiHttpApp` and monolithic handlers with dedicated role-based handler modules in `src/adapters/inbound/http/`:
    - `CurriculumPackHttpHandler`: Handles public and role-projected pack requests.
    - Future role handlers (e.g. `InstructorHttpHandler`, `LearnerHttpHandler`) will attach to the router as game session endpoints are built.
- **Event-to-Query Transformation**:
  - Handlers directly extract `packId` from path parameters and `tokenClaims` from the request context, constructing typed `GetCurriculumPackByIdQuery` objects for the application use case.
- **Package Cleanup**:
  - Uninstall `openapi-backend`. Install `@middy/core`, `@middy/http-router`, and `@middy/http-header-normalizer`.
  - `docs/api/openapi.yaml` is retained purely as static documentation.

## Testing Decisions

- **Testing Seams**:
  - Primary testing seam is the combined Middy handler invoked with simulated Netlify/Lambda events.
  - Test anonymous requests, participant token requests, instructor token requests, and invalid/missing token requests.
  - Test invalid API key rejection when API keys are configured.
  - Test unknown routes returning standard 404 responses.
- **Prior Art**:
  - Adapts existing assertions from `tests/get-pack-by-id.test.ts`.

## Out of Scope

- Modifying Domain models (`CurriculumPack`, `PackId`) or Application use cases (`GetCurriculumPackByIdUseCase`).
- Altering MongoDB schema or Mongoose connection management.
- Writing endpoint handlers for endpoints not yet scheduled for implementation.

## Further Notes

- Architecture Standard: [`AGENTS.md`](../../AGENTS.md) and [`docs/agents/api-architecture.md`](../../docs/agents/api-architecture.md)
- ADR Reference: [ADR-0002](../../docs/adr/0002-hexagonal-ddd-architecture-and-netlify-serverless-deployment.md)
