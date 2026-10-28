# Spec: Discrete Netlify Functions with Domain Folders & Middy Middleware Pipeline

Status: ready-for-agent

## Problem Statement

Central monolithic routing frameworks (whether `openapi-backend` or centralized `@middy/http-router`) force all API traffic into a single entrypoint function. This creates:
1. **Coupled Deployment Blast Radius**: A change to one endpoint requires redeploying the entire API bundle.
2. **Cold Start Penalty**: Loading routing tables, specifications, and unused endpoint handlers inflates bundle size and increases serverless cold-start latency.
3. **Complex Path Multiplexing**: Dispatching multiple HTTP verbs and paths inside a single catch-all function duplicates work that Netlify's native URLPattern router already performs.

Platform developers want discrete, independent serverless functions organized by domain under `netlify/functions/<domain>/<action>.ts` (e.g. `netlify/functions/packs/get-pack-by-id.ts`), each deployable on its own, with zero internal routing tables and a lightweight Middy middleware pipeline.

## Solution

Decompose the API into independent, domain-organized Netlify Functions:
1. **Domain Function Directory Structure**:
   - Organize functions by domain under `netlify/functions/<domain>/`:
     - `netlify/functions/packs/get-pack-by-id.ts`
     - Future functions: `netlify/functions/sessions/create-session.ts`, `netlify/functions/sessions/join-session.ts`, etc.
   - Configure native Netlify v2 route mapping on each function using `export const config = { path: "/api/v1/packs/:packId" }`.
2. **No Monolithic Router**:
   - Eliminate `@middy/http-router` and `openapi-backend`.
   - Each function is a standalone Middy pipeline handling exactly one operation.
3. **Middy Event Adapter & Middleware Pipeline**:
   - Create a reusable, lightweight Middy stack for serverless functions:
     - `@middy/http-header-normalizer`: Normalizes incoming request headers.
     - `authMiddleware`: Extracts API keys and capability tokens, verifying signatures and attaching claims.
     - `errorMiddleware`: Catches domain errors (`PackNotFoundError`, `UnauthorizedTokenError`) and returns clean standard JSON responses with status codes.
   - Each handler simply transforms `event.pathParameters` / `event.queryStringParameters` / `event.body` directly into its application use-case query and returns `{ statusCode: 200, body: JSON.stringify(result) }`.
4. **Hexagonal Domain & Outbound Persistence Remain Pure**:
   - Domain aggregate roots, application use cases, MongoDB repository, and connection management remain completely unchanged.

## User Stories

1. As a platform developer, I want each serverless endpoint to live in its own file under `netlify/functions/<domain>/<action>.ts`, so that each function can be developed, tested, and deployed independently without a shared routing table.
2. As a client requesting `GET /api/v1/packs/diabe-teach`, I want `netlify/functions/packs/get-pack-by-id.ts` to execute and return the curriculum pack with optimal latency.
3. As an anonymous user or learner, I want assessment questions to be redacted (`correctIndex` and `explanation` omitted).
4. As an instructor with a valid bearer token, I want full unredacted assessment instruments.
5. As an API client with an invalid bearer token, I want `authMiddleware` or `errorMiddleware` to return `401 Unauthorized` with `{ code: "UNAUTHORIZED_TOKEN", message: "..." }`.
6. As an API client requesting an unknown pack ID, I want `get-pack-by-id.ts` to return `404 Not Found` with `{ code: "PACK_NOT_FOUND", message: "..." }`.
7. As a security reviewer, I want `authMiddleware` to enforce API keys and JWT verification without duplicating authentication code across individual endpoint files.
8. As a maintainer, I want all tests, typechecks, and boundary linter checks to pass with 0 errors.

## Implementation Decisions

- **Folder Structure**:
  - `netlify/functions/packs/get-pack-by-id.ts`:
    - Exports `default handler` wrapped with Middy.
    - Exports `config = { path: "/api/v1/packs/:packId", method: "GET" }`.
- **Middy Middleware Utilities (`src/adapters/inbound/http/middy/`)**:
  - `authMiddleware.ts`: Validates `x-api-key` and parses Bearer JWTs via `CapabilityTokenPort`.
  - `domainErrorMiddleware.ts`: Intercepts `DomainError` instances and serializes `{ code, message }` responses with corresponding HTTP status codes.
- **Decommissioning Monolithic Routing**:
  - Delete `openapi-backend` from `package.json`.
  - Delete monolithic `netlify/functions/api.ts`.
  - Delete obsolete `src/adapters/inbound/http/create-app.ts` and `src/adapters/inbound/http/endpoint-handler.factory.ts`.
- **Runtime Composition**:
  - Update `AppRuntime` to build shared production dependencies (`MongoCurriculumPackRepository`, `HmacCapabilityTokenAdapter`) accessed cleanly by the domain functions.

## Testing Decisions

- **Testing Seams**:
  - Test individual function handlers directly with simulated Netlify/Lambda events.
  - Test `netlify/functions/packs/get-pack-by-id.ts` with anonymous, participant, instructor, and invalid tokens.
  - Test middleware behavior in isolation.
- **Prior Art**:
  - Migrate assertions from `tests/get-pack-by-id.test.ts` into discrete function tests.

## Out of Scope

- Implementing endpoints for other domains (sessions, analytics) until their respective tickets are scheduled.
- Altering MongoDB schema or domain business rules.

## Further Notes

- Evaluated in ADR-0002.
- Adheres to Netlify Functions v2 native URLPattern routing.
