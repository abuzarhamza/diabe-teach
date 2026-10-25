# 10 - Netlify Functions v2 & AWS Lambda Routing Architecture Research

Dated research note (**2026-10-24**) investigating how HTTP routing works across **Netlify Functions v2** and **AWS Lambda** (which powers Netlify Functions under the hood), and how our Hexagonal DDD Driving Adapter should be structured.

---

## 1. How Netlify Functions v2 Runs on AWS Lambda Under the Hood

Netlify Functions execute on **AWS Lambda** microVMs, but Netlify provides two distinct execution and routing generations:

1. **Legacy Netlify Functions v1 (Raw AWS Lambda / API Gateway Event)**:
   - Signature: `export async function handler(event: HandlerEvent, context: HandlerContext)`
   - Incoming requests are passed as an AWS API Gateway proxy payload (`event.httpMethod`, `event.path`, `event.headers`, `event.pathParameters`, `event.queryStringParameters`, `event.body`), and the handler returns `{ statusCode, headers, body }`.
2. **Modern Netlify Functions v2 (Web-Standard `Request` / `Response` + Edge URLPattern Router)**:
   - Signature: `export default async (req: Request, context: Context) => Promise<Response>`
   - Netlify's routing fabric matches incoming requests against the function's exported `config` object (`export const config: Config = { path, method }`) **before** invoking the underlying AWS Lambda container.
   - Netlify normalizes the request into a standard Web Fetch `Request` and injects extracted `URLPattern` path parameters into `context.params` (replacing AWS API Gateway's `event.pathParameters`).

---

## 2. Three Routing Patterns on Netlify Functions v2 & AWS Lambda

### Pattern A: Per-Endpoint Function File with Native `config.path` + `config.method` + `context.params`

Each endpoint (or resource path) has its own function file under `netlify/functions/` that declares its exact `URLPattern` route and HTTP method in `export const config: Config`:

```typescript
// netlify/functions/get-pack-by-id.ts
import type { Config, Context } from "@netlify/functions";

export default async (req: Request, context: Context): Promise<Response> => {
  // Netlify's URLPattern router extracts :packId into context.params.packId
  const packId = context.params.packId;
  // ... delegate to Hexagonal Driving Adapter
};

export const config: Config = {
  path: "/api/v1/packs/:packId",
  method: "GET",
};
```

- **How routing works**:
  - **Path matching & parameter extraction**: Handled natively by Netlify's platform router via the WHATWG `URLPattern` standard (`/api/v1/packs/:packId`). The captured segment is passed in `context.params.packId`.
  - **Method filtering**: Setting `method: "GET"` in `config` causes Netlify's routing layer to reject non-`GET` requests (or route `POST` requests to a different function file) before the function even runs.
  - **Default URL disabled**: Once `config.path` is declared, the function responds *only* at `/api/v1/packs/:packId` and no longer exposes `/.netlify/functions/<name>`.
- **Trade-offs**:
  - **Pros**: Zero custom regex/router boilerplate inside application code; platform-enforced route & method matching; isolated per-endpoint bundles and metrics; maps 1:1 to AWS API Gateway + Lambda per-route integrations (where API Gateway passes `event.pathParameters.packId` and Netlify passes `context.params.packId`).
  - **Cons**: Warm MongoDB connections (`MongoClient`) are cached per Lambda container (so `get-pack-by-id` and `create-session` have separate warm containers rather than sharing one monolithic container).

---

### Pattern B: Single Catch-All Function (`path: "/api/v1/*"`) + Internal Web Router (or Regex)

A single function file (`netlify/functions/api.ts`) declares a wildcard route:

```typescript
export const config: Config = {
  path: "/api/v1/*",
};
```

- **How routing works**:
  - Netlify forwards **every** `/api/v1/*` request to the same AWS Lambda function.
  - Inside the function, an internal router (either a lightweight framework like **Hono** / **itty-router** or custom `URLPattern` / regex matching on `new URL(req.url).pathname`) dispatches to the right handler.
- **Trade-offs**:
  - **Pros**: All 14 endpoints share a single warm Lambda container and a single warm `MongoClient` connection pool; easy to mount all routes in one place.
  - **Cons**: You maintain an internal router in code instead of using Netlify's native `config.path` + `context.params` per endpoint; a single cold start loads dependencies for all endpoints.

---

### Pattern C: Hybrid Hexagonal Driving Adapter Supporting Both `context.params` (Netlify Native) and URL Fallback

In our Hexagonal DDD architecture (`src/adapters/driving/http/`), we can expose a **per-endpoint driving handler** (e.g., `createGetPackByIdHandler(deps)`) alongside (or instead of) a catch-all router:

- When deployed as a dedicated Netlify Function (`netlify/functions/get-pack-by-id.ts` with `config = { path: "/api/v1/packs/:packId", method: "GET" }`), the function reads `context.params.packId` directly from Netlify's `Context` (with fallback to `URLPattern` extraction from `req.url` when called in unit tests without a Netlify `Context`).
- If deployed on raw AWS Lambda + API Gateway v2 (`APIGatewayProxyEventV2`), a 5-line Lambda adapter reads `event.pathParameters.packId` and `event.headers.authorization` and calls the exact same handler or `GetCurriculumPackByIdUseCase`!

---

## Primary Sources Cited

1. **Netlify Docs — Functions Overview & Custom URL Routing (`URLPattern`, `config.path`, `context.params`)**: `https://docs.netlify.com/functions/overview/` and `https://docs.netlify.com/functions/get-started/`
2. **Netlify Docs — Function `Config` Object (`path`, `method`, `excludedPath`)**: `@netlify/functions` v2 specification (`Config`, `Context`).
3. **Netlify Docs — AWS Lambda Compatibility (`@netlify/aws-lambda-compat`)**: `https://docs.netlify.com/functions/lambda-compatibility/`
