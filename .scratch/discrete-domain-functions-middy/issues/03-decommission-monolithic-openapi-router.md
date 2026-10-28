# 03: Decommission Monolithic openapi-backend & Cleanup Obsolete Classes

**What to build:** Remove `openapi-backend` from `package.json`. Delete monolithic router files (`netlify/functions/api.ts`, `create-app.ts`, `endpoint-handler.factory.ts`, `get-pack-by-id.handler.ts`). Update `AppRuntime` to serve dependencies directly to domain functions. Verify the entire project with tests, linting, typechecking, and boundary rules.

**Blocked by:** 02: Discrete Domain Function: `netlify/functions/packs/get-pack-by-id.ts`

**Status:** done

- [x] Uninstall `openapi-backend` from `package.json`
- [x] Remove monolithic `netlify/functions/api.ts` and obsolete class adapters
- [x] Update `AppRuntime` composition root
- [x] Migrate test suite to discrete domain function tests
- [x] Verify `npm run lint`, `npm run typecheck`, `npm run lint:boundaries`, and `npm test` are 100% green
