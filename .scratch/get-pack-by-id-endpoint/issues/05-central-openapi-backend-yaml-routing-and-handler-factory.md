# 05: Central OpenAPI YAML Routing (`openapi-backend` + `docs/api/openapi.yaml`) & Request-Transformer Handler Factory

**What to build:** Centralize all HTTP routing in `createApp(deps)` (`src/adapters/inbound/http/create-app.ts`) using the official `openapi-backend` framework backed by `docs/api/openapi.yaml` (`operationId: getCurriculumPackById`, `notFound`, and `notImplemented` handlers), and structure `GET /api/v1/packs/{packId}` using the `createEndpointHandler({ transformRequest, execute })` factory pipeline (`transformGetPackByIdRequest` -> `GetCurriculumPackByIdUseCase` -> `Response`).

**Blocked by:** 01: Walking Skeleton — Anonymous `GET /api/v1/packs/{packId}` with Built-in `diabe-teach` Curriculum Pack & `404 PACK_NOT_FOUND`, 02: Role-Aware Assessment Answer-Key Redaction & `CapabilityToken` Verification (`200` Redacted vs. Full Key & `401 UNAUTHORIZED_TOKEN`), 03: Hybrid MongoDB Persistence (`MongoCurriculumPackRepository`) & Netlify Functions v2 Composition Root

**Status:** resolved

- [x] `createApp(deps)` initializes `OpenAPIBackend` (`openapi-backend`) with `docs/api/openapi.yaml` (`quick: true`) and maps `operationId: getCurriculumPackById` to `createGetPackByIdHandler(deps)`.
- [x] `openapi-backend` extracts `{packId}` from `/api/v1/packs/{packId}` into `c.request.params.packId` and forwards it via `RouteContext` to `transformGetPackByIdRequest`.
- [x] Unknown routes trigger `openapi-backend`'s `notFound` handler and unimplemented OpenAPI operations (such as `GET /api/v1/packs` before its vertical slice is registered) trigger `notImplemented`, both returning a valid JSON `ApiErrorResponse` instead of throwing or returning `undefined`.
- [x] `endpoint-handler.factory.ts` centralizes JSON response formatting, Bearer header extraction (`parseBearerTokenHeader`), and `DomainError` $\to$ `ApiErrorResponse` translation.
