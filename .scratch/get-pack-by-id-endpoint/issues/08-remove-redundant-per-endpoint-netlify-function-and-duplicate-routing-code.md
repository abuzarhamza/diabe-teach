# 08: Remove Redundant Per-Endpoint Netlify Function & Duplicate Routing / Security Code

**What to build:** Consolidate onto the single `netlify/functions/api.ts` + `createApp(deps)` (`openapi-backend`) entrypoint by deleting the redundant `netlify/functions/get-pack-by-id.ts` file, removing the duplicate URL regex (`GET_PACK_BY_ID_URL_PATTERN`) from `get-pack-by-id.handler.ts`, removing duplicate per-endpoint `x-api-key` validation (`assertValidApiKeyHeader` and `ApiKeyValidationConfig` on `HttpEndpointDefinition` / `GetPackByIdHandlerDependencies`) so `x-api-key` is checked solely at `createApp`'s `openapi-backend` `ApiKeyAuth` gateway, and simplifying `createNetlifyFunctionHandler(deps?)` to wrap `createApp(deps)` directly.

**Blocked by:** 07: `x-api-key` Header Validation (`ApiKeyAuth`) in HTTP Inbound Adapter, `openapi-backend`, and Netlify Runtime Config

**Status:** resolved

- [x] `netlify/functions/get-pack-by-id.ts` is deleted, leaving `netlify/functions/api.ts` as the single Netlify Function entrypoint.
- [x] `src/adapters/inbound/http/get-pack-by-id.handler.ts` contains no URL regex (`GET_PACK_BY_ID_URL_PATTERN`) or `new URL(request.url).pathname` parsing and reads `context?.params?.packId` directly.
- [x] `src/adapters/inbound/http/endpoint-handler.factory.ts` and `src/adapters/inbound/http/http-handler.types.ts` do not duplicate `x-api-key` checks inside `createEndpointHandler` or `GetPackByIdHandlerDependencies`; `x-api-key` is validated once by `openapi-backend`'s `securityHandlers.ApiKeyAuth` in `create-app.ts`.
- [x] `netlify/config/create-netlify-function-handler.ts` directly wraps `createApp(deps)` without requiring a per-endpoint `DrivingHandlerFactory` callback.
- [x] `npm test`, `npm run typecheck`, and `npm run lint:boundaries` pass with 0 violations.
