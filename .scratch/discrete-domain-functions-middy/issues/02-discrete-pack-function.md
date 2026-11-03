# 02: Discrete Domain Function: `netlify/functions/packs/get-pack-by-id.ts`

**What to build:** Create `netlify/functions/packs/get-pack-by-id.ts` as an independent discrete Netlify Function v2 entrypoint. Configure native Netlify URLPattern routing (`path: "/api/v1/packs/:packId"`), wrap the handler with our Middy middleware stack, extract path parameters and verified auth into `GetCurriculumPackByIdQuery`, and return the projected JSON payload.

**Blocked by:** 01: Install Middy and Implement Reusable Middlewares

**Status:** done

- [x] Create `netlify/functions/packs/get-pack-by-id.ts` with Netlify v2 `config = { path: "/api/v1/packs/:packId" }`
- [x] Connect Middy middlewares (`httpHeaderNormalizer`, `authMiddleware`, `domainErrorMiddleware`)
- [x] Direct transformation from `event.pathParameters.packId` and `event.auth` to use-case query
- [x] Unit & integration tests verifying anonymous, learner, instructor, and invalid token access
