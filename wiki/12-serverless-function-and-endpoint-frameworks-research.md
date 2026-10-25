# 12 - Existing Serverless & YAML Routing Frameworks Research

Dated research note (**2026-10-25**) comparing **existing, battle-tested open-source frameworks** for centralizing API routing and function handlers (including YAML-driven routing) across **Netlify Functions** and **AWS Lambda**.

---

## 1. Existing Frameworks That Centralize Routing in YAML or One Router File

### Option 1: `openapi-backend` (Routes Directly from Existing `docs/api/openapi.yaml`)

- **NPM Package**: [`openapi-backend`](https://www.npmjs.com/package/openapi-backend) ([GitHub: `openapistack/openapi-backend`](https://github.com/openapistack/openapi-backend))
- **How It Works**:
  - Uses your **existing** OpenAPI YAML file ([`docs/api/openapi.yaml`](../docs/api/openapi.yaml)) as the **single YAML routing config**.
  - Every route is already defined in `docs/api/openapi.yaml` with an `operationId` (e.g., `operationId: getCurriculumPackById` under `/packs/{packId}`).
  - You call `api.register({ getCurriculumPackById: ... })` in one place, and `openapi-backend` handles URL matching, `{packId}` path parameter extraction (`c.request.params.packId`), and request validation automatically.
  - Works inside **Netlify Functions**, **AWS Lambda**, and standard Node/Fetch servers.

```typescript
import OpenAPIBackend from "openapi-backend";

const api = new OpenAPIBackend({
  definition: "./docs/api/openapi.yaml",
  quick: true, // optimized for serverless cold starts
});

api.register({
  getCurriculumPackById: async (c, req: Request) =>
    getPackByIdHandler(req, { params: c.request.params }),
});
```

---

### Option 2: Serverless Framework (`serverless` + `serverless.yml`)

- **NPM Package**: [`serverless`](https://www.npmjs.com/package/serverless) + [`serverless-offline`](https://www.npmjs.com/package/serverless-offline) ([Official Docs](https://www.serverless.com/framework/docs/providers/aws/events/http-api))
- **How It Works**:
  - Defines all functions, handlers, and HTTP routes in a root **`serverless.yml`** file:
    ```yaml
    service: diabe-teach-api
    provider:
      name: aws
      runtime: nodejs20.x
    functions:
      getCurriculumPackById:
        handler: src/handlers.getPackById
        events:
          - httpApi:
              method: GET
              path: /api/v1/packs/{packId}
    ```
- **Platform Note**:
  - `serverless.yml` deploys directly to **AWS Lambda + API Gateway** (and runs locally via `serverless-offline`).
  - Netlify's build platform does **not** parse `serverless.yml`; Netlify uses `netlify.toml` (with `[[redirects]]` or `export const config`).

---

### Option 3: `hono` (Single Central Router for Netlify Functions & AWS Lambda)

- **NPM Package**: [`hono`](https://www.npmjs.com/package/hono) + [`@hono/zod-openapi`](https://www.npmjs.com/package/@hono/zod-openapi) ([Official Netlify Docs](https://hono.dev/docs/getting-started/netlify), [AWS Lambda Docs](https://hono.dev/docs/getting-started/aws-lambda))
- **How It Works**:
  - Industry-standard, ultra-lightweight router built on Web-Standard `Request` / `Response` with official adapters for both **Netlify** (`hono/netlify`) and **AWS Lambda** (`hono/aws-lambda`).
  - All routes are registered in **one central file** (`app.get("/api/v1/packs/:packId", ...)`), and one single Netlify Function (`netlify/functions/api.ts`) handles `/api/v1/*`.

---

### Option 4: `@middy/core` + `@middy/http-router` (Official AWS Lambda / Netlify v1 Router)

- **NPM Package**: [`@middy/core`](https://www.npmjs.com/package/@middy/core) + [`@middy/http-router`](https://www.npmjs.com/package/@middy/http-router) ([Official Docs](https://middy.js.org/docs/routers/http-router))
- **How It Works**:
  - Centralizes all `{ method, path, handler }` route definitions in one array and dispatches AWS Lambda / Netlify v1 `event` payloads (`event.httpMethod`, `event.path`, `event.pathParameters`).

---

## 2. Comparison Matrix

| Existing Framework | Single YAML Route File? | Works on Netlify Functions? | Works on AWS Lambda? | Key Advantage |
| :--- | :--- | :--- | :--- | :--- |
| **`openapi-backend`** | **Yes (`docs/api/openapi.yaml`)** | **Yes** | **Yes** | Routes directly from your existing `openapi.yaml` via `operationId` (`getCurriculumPackById`) — zero duplicate route definitions. |
| **Serverless Framework (`serverless.yml`)** | **Yes (`serverless.yml`)** | No (AWS / `serverless-offline` only) | **Yes (Native)** | Industry standard for AWS Lambda + API Gateway YAML configuration. |
| **`hono`** | No (Central TS file) | **Yes (`hono/netlify`)** | **Yes (`hono/aws-lambda`)** | Official Web-Standard `Request`/`Response` router for both Netlify and AWS Lambda. |
| **`@middy/http-router`** | No (Central TS array) | Yes (Lambda v1 event) | **Yes (Native)** | Popular AWS Lambda middleware + central route table. |
