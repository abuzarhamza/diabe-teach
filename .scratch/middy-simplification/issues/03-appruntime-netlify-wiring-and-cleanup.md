# 03: Netlify Entrypoint, AppRuntime Wiring & openapi-backend Removal

**What to build:** Wire the Middy HTTP router through `AppRuntime` into `netlify/functions/api.ts`. Remove `openapi-backend` from runtime dependencies and remove obsolete class adapters (`OpenApiHttpApp`, `BaseHttpHandler`). Update test suites to verify complete end-to-end functionality.

**Blocked by:** 02: Role-Based Curriculum Pack Handler & Middy Router

**Status:** wontfix (superseded by discrete-domain-functions-middy 01-03, 2026-11-20)

Closed 2026-11-20: superseded by `3c5f131` (one Netlify function per route with the shared middy chain `createApiHandler`; no central `@middy/http-router` or `netlify/functions/api.ts`, and `openapi-backend` is gone).

- [ ] Update `src/app-runtime.ts` and `netlify/functions/api.ts` to expose the Middy router pipeline
- [ ] Uninstall `openapi-backend` from `package.json`
- [ ] Remove obsolete runtime files (`create-app.ts`, `endpoint-handler.factory.ts`, `get-pack-by-id.handler.ts`)
- [ ] Update end-to-end tests to exercise the Middy handler
- [ ] Verify `npm run lint`, `npm run typecheck`, `npm run lint:boundaries`, and `npm test` all pass cleanly
