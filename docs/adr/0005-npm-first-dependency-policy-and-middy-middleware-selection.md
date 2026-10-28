# 0005. NPM-First Dependency Policy and Official Middy Middleware Selection

Date: 2026-10-28

## Status

Accepted

## Context

During early development of the Concept-Chain / Diabe-Teach educational platform, several utilities (e.g. YAML parsing in `.env.dev.yaml`, HTTP handler pipelines, header normalization) were initially developed as custom bespoke code. 

Bespoke implementations of common software primitives introduce significant maintenance costs, potential security flaws (such as regular expression backtracking / ReDoS), and code clutter. Furthermore, following our simplification to discrete Netlify Functions v2 without monolithic routers, we need a standard policy on which middleware capabilities should be adopted from the official Middy ecosystem (`@middy/*`) versus implemented in-house.

## Decision

1. **Mandatory NPM-First Policy for System Primitives**:
   - Before writing custom parsers, cryptographic handlers, validators, or networking/HTTP primitives from scratch, engineers and agents must evaluate and adopt well-maintained, battle-tested npm packages (e.g. `yaml` for YAML parsing, `jose` for cryptography/tokens, standard `@middy/*` packages for serverless middleware).
   - Custom implementations are only permitted when an existing package violates Hexagonal DDD purity constraints or introduces unacceptable bundle bloat.

2. **Official Middy Middleware Selection**:
   - **`@middy/http-header-normalizer`**: Adopted to ensure lowercase, case-insensitive header access (`authorization`, `x-api-key`).
   - **`@middy/http-cors`**: Adopted for cross-origin resource sharing across web and mobile frontend clients.
   - **`@middy/http-security-headers`**: Adopted to enforce baseline OWASP HTTP security headers.
   - **`@middy/http-json-body-parser`**: Standard middleware for all JSON mutation endpoints (`POST`, `PUT`, `PATCH`).
   - **`@middy/do-not-wait-for-empty-event-loop`**: Standard middleware for handlers connecting to MongoDB to prevent Lambda execution timeouts on warm cached connection pools.
   - **Decommission In-Function Routers**: `@middy/http-router` and `openapi-backend` are rejected in favor of native Netlify Functions v2 discrete URLPattern routing (`netlify/functions/<domain>/<action>.ts`).
   - **Keep Domain-Specific Adapter Middlewares Thin**: `authMiddleware` (bridging `CapabilityTokenPort` and API keys) and `domainErrorMiddleware` (mapping pure `DomainError` instances to HTTP status codes) remain lightweight adapters located in `src/adapters/inbound/http/middy/`.

## Consequences

- **Positive**:
  - Eliminates duplicate boilerplate across endpoint functions.
  - Improves security with battle-tested community code audited by thousands of production deployments.
  - Serverless functions are smaller, focused exclusively on mapping events to application use cases.
  - Prevents AWS Lambda container timeouts on MongoDB connection pool handles.
- **Negative**:
  - Requires maintaining additional `@middy/*` dev/prod dependencies in `package.json`.
