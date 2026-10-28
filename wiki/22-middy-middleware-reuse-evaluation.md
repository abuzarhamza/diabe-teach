# Wiki Note 22: Middy Middleware Reuse Evaluation & Standard Packages

**Status**: Accepted & Applied  
**Date**: October 28, 2026  
**Primary Standards**: [`AGENTS.md`](../AGENTS.md), [`docs/adr/0005-npm-first-dependency-policy-and-middy-middleware-selection.md`](../docs/adr/0005-npm-first-dependency-policy-and-middy-middleware-selection.md)  
**Primary Reference**: [Middy Official Middleware Catalog](https://middy.js.org/docs/middlewares/intro)

---

## 1. Context & Motivation

Following our architectural decision to adopt **discrete Netlify Functions v2** (eliminating monolithic internal routers) and enforce the **NPM-First Policy** in [`AGENTS.md`](../AGENTS.md), we conducted a comprehensive review of official Middy middlewares (`@middy/*`) to identify which battle-tested packages can be directly reused rather than developing bespoke middleware logic.

---

## 2. Evaluation of Official Middy Middlewares for Diabe-Teach

We evaluated the official middlewares from [middy.js.org/docs/middlewares/intro](https://middy.js.org/docs/middlewares/intro) against our serverless educational platform requirements:

| Middleware Package | Purpose | Fit for Diabe-Teach | Decision |
| :--- | :--- | :--- | :--- |
| **`@middy/http-header-normalizer`** | Normalizes all incoming HTTP headers to lowercase (e.g. `Authorization` $\to$ `authorization`). | Essential for robust case-insensitive access to `authorization` and `x-api-key`. | **Adopted** (installed & active) |
| **`@middy/http-cors`** | Generates standard CORS headers (`Access-Control-Allow-Origin`, preflight handling) across both successes and error responses. | Essential for frontend single-page web app and mobile clients accessing `/api/v1/*`. | **Recommended for Adoption** |
| **`@middy/http-json-body-parser`** | Parses JSON strings in `event.body` into native JS objects and validates `Content-Type`. | Essential for all future write/mutation endpoints (`POST /api/v1/sessions`, `POST /api/v1/chains/validate`, etc.). | **Recommended for Mutation Endpoints** |
| **`@middy/http-response-serializer`** | Automatically formats and stringifies JavaScript response objects to JSON with proper `Content-Type`. | Allows handlers to return raw objects `{ pack }` without calling `JSON.stringify` manually in every function. | **Recommended for Adoption** |
| **`@middy/http-security-headers`** | Injects OWASP-recommended HTTP security headers (HSTS, X-Content-Type-Options, Frame Options). | Elevates baseline security compliance in clinical educational software. | **Recommended for Adoption** |
| **`@middy/http-error-handler`** | Formats errors with `statusCode` into HTTP responses. | Our domain uses pure `DomainError` hierarchy without HTTP dependencies; custom adapter mapping (`domainErrorMiddleware`) is required to preserve Hexagonal DDD ring purity. | **Keep Lightweight Domain Error Adapter** |
| **`@middy/http-router`** | In-function path and method routing. | Incompatible with user's directive for discrete domain-folder functions (`netlify/functions/<domain>/<action>.ts`). Netlify v2 native URLPattern handles routing. | **Rejected** (decommissioned) |
| **`@middy/do-not-wait-for-empty-event-loop`** | Sets `callbackWaitsForEmptyEventLoop = false` so Lambda exits immediately without waiting for open socket handles. | Highly beneficial for warm cached MongoDB/Mongoose connection pools to prevent Lambda timeouts. | **Recommended for Outbound DB Handlers** |

---

## 3. Standard Serverless Function Middleware Stack

Based on this evaluation, each discrete Netlify Function v2 in `netlify/functions/<domain>/` will compose the following standard Middy pipeline:

```typescript
import middy from "@middy/core";
import httpHeaderNormalizer from "@middy/http-header-normalizer";
import httpCors from "@middy/http-cors";
import httpSecurityHeaders from "@middy/http-security-headers";
import { authMiddleware } from "../../../src/adapters/inbound/http/middy/auth.middleware.js";
import { domainErrorMiddleware } from "../../../src/adapters/inbound/http/middy/domain-error.middleware.js";

export const standardFunctionStack = (handler: any) =>
  middy(handler)
    .use(httpHeaderNormalizer())
    .use(httpSecurityHeaders())
    .use(httpCors())
    .use(authMiddleware())
    .use(domainErrorMiddleware());
```

---

## 4. Key Takeaways

1. **Reusability Over Custom Code**: Header normalization, CORS, JSON body parsing, and security headers must always come from `@middy/*` rather than custom hand-rolled logic.
2. **Boundary Preservation**: Authentication (`authMiddleware`) and domain error translation (`domainErrorMiddleware`) remain thin adapters that connect pure Domain/Application ports to Middy, avoiding vendor lock-in inside the domain core.
