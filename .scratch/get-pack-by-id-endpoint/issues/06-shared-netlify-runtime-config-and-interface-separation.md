# 06: Shared Netlify Deployment Config (`netlify/config/` + `netlify.toml`), Inbound/Outbound Adapter Structure & Dedicated Interface Files

**What to build:** Organize adapters into `src/adapters/inbound/` and `src/adapters/outbound/`, separate all TypeScript interfaces/contracts (`*.types.ts`, `*.port.ts`, `*.dto.ts`) from class and factory implementations across all four Hexagonal rings, and extract shared Netlify runtime configuration (`netlify/config/netlify-runtime.types.ts`, `netlify/config/netlify-runtime.config.ts`, `netlify/config/create-netlify-function-handler.ts`, `netlify/functions/api.ts`, and `netlify.toml`).

**Blocked by:** 05: Central OpenAPI YAML Routing (`openapi-backend` + `docs/api/openapi.yaml`) & Request-Transformer Handler Factory

**Status:** resolved

- [x] All interfaces, ports, DTOs, and configuration contracts live in dedicated contract files (`curriculum-pack.types.ts`, `curriculum-pack.dto.ts`, `get-curriculum-pack-by-id.port.ts`, `http-handler.types.ts`, `mongo-curriculum-pack-repository.types.ts`, `netlify-runtime.types.ts`) with zero god modules mixing interfaces and classes.
- [x] `netlify/config/netlify-runtime.config.ts` provides `loadNetlifyRuntimeEnvConfig`, `buildNetlifyProductionDependencies`, `getNetlifyProductionDependencies`, and `defineNetlifyRouteConfig`.
- [x] `netlify/config/create-netlify-function-handler.ts` provides `createNetlifyFunctionHandler` bridging Netlify's `(request: Request, context: Context)` to Inbound HTTP handlers, used by `netlify/functions/api.ts` (`/api/v1/*`) and `netlify/functions/get-pack-by-id.ts`.
- [x] `netlify.toml` configures `directory = "netlify/functions"`, `node_bundler = "esbuild"`, and `included_files = ["docs/api/openapi.yaml"]`.
- [x] `npm test`, `npm run typecheck`, and `npm run lint:boundaries` pass with 0 violations.
