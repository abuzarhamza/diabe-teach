# 13 - Single-Entrypoint (`openapi-backend` + `createApp`) Dead & Redundant Code Audit

Dated research and codebase audit (**2026-10-25**) identifying every file, function, regular expression, and type definition that became redundant once **`netlify/functions/api.ts` + `createApp(deps)`** (backed by **`openapi-backend`** reading [`docs/api/openapi.yaml`](../docs/api/openapi.yaml)) was established as the **single HTTP entrypoint**.

---

## 1. Executive Summary: What `openapi-backend` + `createApp` Already Does Centrally

When a request arrives at the single entrypoint (`netlify/functions/api.ts` $\to$ `createApp(deps).fetch(request, context)`):

1. **Route & Method Matching**: `openapi-backend` matches the HTTP method and path against [`docs/api/openapi.yaml`](../docs/api/openapi.yaml) (e.g., `GET /api/v1/packs/{packId}` $\to$ `operationId: getCurriculumPackById`, or `notFound` / `notImplemented`).
2. **Path Parameter Extraction**: `openapi-backend` parses `{packId}` from the URL and populates `c.request.params.packId`, passing it into `context.params.packId`.
3. **Global `x-api-key` Security Gate**: `openapi-backend` executes `securityHandlers.ApiKeyAuth` (`verifyApiKeyHeader`) and returns `401 UNAUTHORIZED_TOKEN` via `handlers.unauthorizedHandler` before invoking any operation handler.

Because those three responsibilities are handled centrally in `createApp(deps)`, any code that duplicates per-endpoint Netlify functions, URL regex matching, or per-endpoint `x-api-key` checks is dead/redundant weight.

---

## 2. File-by-File Audit of Redundant Code

### 2.1 Entire File to Delete: `netlify/functions/get-pack-by-id.ts`

- **Location**: `netlify/functions/get-pack-by-id.ts` (lines 1–10)
- **Why it is redundant**:
  - `netlify/functions/api.ts` already handles `/api/v1/*` and dispatches `GET /api/v1/packs/{packId}` through `createApp(deps)` (`openapi-backend`).
  - Keeping `netlify/functions/get-pack-by-id.ts` creates a second competing Netlify Function bundle for a route already served by `netlify/functions/api.ts` and bypasses `openapi-backend`'s central router.
- **Action**: Delete `netlify/functions/get-pack-by-id.ts` so `netlify/functions/api.ts` is the sole Netlify Function entrypoint.

---

### 2.2 Redundant URL Regex & Fallback in `src/adapters/inbound/http/get-pack-by-id.handler.ts`

- **Location**: `src/adapters/inbound/http/get-pack-by-id.handler.ts` (lines 15–33 and 58–59)
  - `const GET_PACK_BY_ID_URL_PATTERN = /^\/api\/v1\/packs\/([^/]+)\/?$/;`
  - `const url = new URL(request.url); const match = GET_PACK_BY_ID_URL_PATTERN.exec(url.pathname);`
  - `apiKey: deps.apiKey, requireApiKey: deps.requireApiKey` passed into `createEndpointHandler`.
- **Why it is redundant**:
  - `openapi-backend` in `createApp(deps)` already matches `/api/v1/packs/{packId}` from `docs/api/openapi.yaml` and passes `{ params: { packId } }` in `context.params`.
  - Maintaining a custom regex (`GET_PACK_BY_ID_URL_PATTERN`) inside `get-pack-by-id.handler.ts` duplicates the path template already defined in `docs/api/openapi.yaml`.
  - `transformGetPackByIdRequest` only needs `decodeURIComponent(context?.params?.packId ?? "")`.

---

### 2.3 Duplicate `x-api-key` Enforcement in `src/adapters/inbound/http/endpoint-handler.factory.ts` & `http-handler.types.ts`

- **Location**:
  - `src/adapters/inbound/http/endpoint-handler.factory.ts` (lines 54–61 `assertValidApiKeyHeader` and line 104 `assertValidApiKeyHeader(request, definition)`)
  - `src/adapters/inbound/http/http-handler.types.ts` (`HttpEndpointDefinition extends ApiKeyValidationConfig` and `GetPackByIdHandlerDependencies extends ApiKeyValidationConfig`, lines 23–35)
- **Why it is redundant**:
  - `openapi-backend`'s `securityHandlers.ApiKeyAuth` + `unauthorizedHandler` in `create-app.ts` (lines 24–28, 41–48) already validates `x-api-key` centrally for every endpoint declared with `ApiKeyAuth` in `docs/api/openapi.yaml`.
  - Re-validating `x-api-key` inside `createEndpointHandler` runs the exact same check twice on every request and forces every individual endpoint handler's dependency interface (`GetPackByIdHandlerDependencies`) to carry `apiKey` / `requireApiKey`.
- **Action**:
  - Keep `verifyApiKeyHeader` and `INVALID_API_KEY_MESSAGE` for `createApp(deps)` (`securityHandlers.ApiKeyAuth`), and remove `assertValidApiKeyHeader` from `createEndpointHandler` and `ApiKeyValidationConfig` from `HttpEndpointDefinition` / `GetPackByIdHandlerDependencies`.

---

### 2.4 Simplifying `netlify/config/create-netlify-function-handler.ts` & `netlify/config/netlify-runtime.types.ts`

- **Location**:
  - `netlify/config/create-netlify-function-handler.ts` (lines 14–28)
  - `netlify/config/netlify-runtime.types.ts` (`DrivingHandlerFactory`, lines 32–34)
- **Why it can be simplified**:
  - Previously, `createNetlifyFunctionHandler(createDrivingHandler, deps)` accepted a per-endpoint handler factory because multiple files existed under `netlify/functions/`.
  - With a single `netlify/functions/api.ts` entrypoint that always delegates to `createApp(deps)`, `createNetlifyFunctionHandler(deps?)` can directly instantiate `createApp(deps)` and forward `(request, { params: context?.params })`.

---

### 2.5 Redundant Per-Endpoint Netlify Tests in `tests/get-pack-by-id.test.ts`

- **Location**: `tests/get-pack-by-id.test.ts` (lines 14–16 and lines 564–602)
- **Why it is redundant**:
  - Imports and tests the deleted `netlify/functions/get-pack-by-id.ts` file instead of testing the single `netlify/functions/api.ts` entrypoint and `createApp(deps)`.

---

## 3. Summary Table: Before vs. After Cleanup

| Component | Before (Hybrid Per-Endpoint + Central) | After (Pure Single Entrypoint via `openapi-backend`) |
| :--- | :--- | :--- |
| **`netlify/functions/`** | 2 files (`api.ts` + `get-pack-by-id.ts`) | **1 file (`netlify/functions/api.ts`)** |
| **Route Matching & `:packId` Extraction** | Duplicated in `openapi.yaml` AND `GET_PACK_BY_ID_URL_PATTERN` regex in `get-pack-by-id.handler.ts` | **Single source in `docs/api/openapi.yaml` (`openapi-backend` populates `context.params.packId`)** |
| **`x-api-key` Check** | Duplicated in `create-app.ts` (`securityHandlers.ApiKeyAuth`) AND `createEndpointHandler` (`assertValidApiKeyHeader`) | **Single check in `create-app.ts` (`securityHandlers.ApiKeyAuth`)** |
| **`createNetlifyFunctionHandler`** | Higher-order factory taking `DrivingHandlerFactory` for N function files | **Direct `createNetlifyFunctionHandler(deps?)` wrapping `createApp(deps)`** |
