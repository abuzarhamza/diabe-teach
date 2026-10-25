# 04: Native Per-Endpoint Netlify Functions v2 Routing (`config.path` + `context.params`) & AWS Lambda Portability

**What to build:** Replace the monolithic catch-all `netlify/functions/api.ts` function with a dedicated per-endpoint Netlify Function (`netlify/functions/get-pack-by-id.ts`) typed with `@netlify/functions` `Config` (`{ path: "/api/v1/packs/:packId", method: "GET" }`) and `Context` (`context.params.packId`), backed by a vendor-agnostic HTTP Driving Adapter handler (`createGetPackByIdHandler(deps)`) that reads `context.params.packId` natively for both Netlify Functions v2 and AWS Lambda (`pathParameters`) with URL fallback for plain `Request` tests.

**Blocked by:** 01: Walking Skeleton — Anonymous `GET /api/v1/packs/{packId}` with Built-in `diabe-teach` Curriculum Pack & `404 PACK_NOT_FOUND`, 02: Role-Aware Assessment Answer-Key Redaction & `CapabilityToken` Verification (`200` Redacted vs. Full Key & `401 UNAUTHORIZED_TOKEN`), 03: Hybrid MongoDB Persistence (`MongoCurriculumPackRepository`) & Netlify Functions v2 Composition Root

**Status:** resolved

- [x] `@netlify/functions` is installed in `package.json`, and `.dependency-cruiser.cjs` enforces that `@netlify/functions` is only imported inside `netlify/functions/**` (never inside `src/**`).
- [x] `src/adapters/driving/http/get-pack-by-id.handler.ts` exports `createGetPackByIdHandler(deps)` accepting `(request: Request, context?: { params?: Readonly<Record<string, string | undefined>> }) => Promise<Response>`, resolving `packId` from `context?.params?.packId` first (for Netlify `context.params` and AWS Lambda `pathParameters`) with fallback to URL path extraction.
- [x] `netlify/functions/get-pack-by-id.ts` exports `export const config: Config = { path: "/api/v1/packs/:packId", method: "GET" }` and default handler `(req: Request, context: Context) => Promise<Response>`, removing the obsolete catch-all `netlify/functions/api.ts`.
- [x] Tests verify that invoking `createGetPackByIdHandler(deps)` and `netlify/functions/get-pack-by-id.ts` with `context = { params: { packId: "diabe-teach" } }` (even when `request.url` is an internal Lambda invocation URL) returns `200 OK` with the `diabe-teach` pack, and `npm test`, `npm run typecheck`, and `npm run lint:boundaries` pass.
