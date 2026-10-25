# 07: `x-api-key` Header Validation (`ApiKeyAuth`) in HTTP Inbound Adapter, `openapi-backend`, and Netlify Runtime Config

**What to build:** Enforce `x-api-key` client authentication in the HTTP Inbound Adapter layer (`src/adapters/inbound/http/`) and `openapi-backend` (`ApiKeyAuth` security scheme in `docs/api/openapi.yaml` + `securityHandlers.ApiKeyAuth` and `unauthorizedHandler` in `create-app.ts` + `validateApiKeyHeader` in `endpoint-handler.factory.ts`), configured via `API_KEY` in `netlify/config/netlify-runtime.config.ts` with fail-closed (`401 UNAUTHORIZED_TOKEN`) behavior in Netlify production while keeping Domain and Application layers free of transport API key concerns.

**Blocked by:** 05: Central OpenAPI YAML Routing (`openapi-backend` + `docs/api/openapi.yaml`) & Request-Transformer Handler Factory, 06: Shared Netlify Deployment Config (`netlify/config/` + `netlify.toml`), Inbound/Outbound Adapter Structure & Dedicated Interface Files

**Status:** resolved

- [x] `docs/api/openapi.yaml` defines `ApiKeyAuth` (`type: apiKey`, `in: header`, `name: x-api-key`) under `components.securitySchemes` and applies it to `/api/v1/packs/{packId}`.
- [x] When `apiKey` is configured in `AppDependencies` / `GetPackByIdHandlerDependencies` (or `requireApiKey: true`), requests missing `x-api-key` or supplying a non-matching `x-api-key` receive `401 Unauthorized` with `{ code: "UNAUTHORIZED_TOKEN", message: "Missing or invalid x-api-key header." }`.
- [x] When a valid `x-api-key` is supplied, the request proceeds to `GetCurriculumPackByIdUseCase` and still honors `Authorization: Bearer <token>` role-aware answer-key redaction (`anonymous`/`participant` redacted, `instructor` unredacted, malformed Bearer token -> `401 UNAUTHORIZED_TOKEN`).
- [x] `loadNetlifyRuntimeEnvConfig` and `buildNetlifyProductionDependencies` in `netlify/config/netlify-runtime.config.ts` read `process.env.API_KEY` and set `requireApiKey: true` so Netlify production fails closed (`401 UNAUTHORIZED_TOKEN`) if `API_KEY` is unset or `x-api-key` does not match.
- [x] `src/domain/` and `src/application/` have zero references to `x-api-key`, and `npm test`, `npm run typecheck`, and `npm run lint:boundaries` pass.
