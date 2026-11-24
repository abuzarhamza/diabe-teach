# Spec: Comprehensive API testing suite across the organized `tests/` folder structure and runnable Bruno CLI collection

**Status:** ready-for-agent

## Problem Statement

Our primary-source evaluation of Cindy Sridharan's (`@copyconstruct`) 40-item testing taxonomy against the Diabe-teach API (`.scratch/research/eligible-api-testing-catalog.md`) identified:
1. **Four blockers in `docs/api/bruno/`** that prevent `npx bru run -r --env "Local Dev"` from passing all 21 `.bru` requests end-to-end in one automated pass (response property paths in 4 `.bru` `tests` blocks, phase-advance sequencing between `04-Game-Sessions`, `05-Chains-and-Adjudication`, and `06-Assessments-Survey-and-Lifecycle`, and repeat sign-up idempotency).
2. **Six high-value pre-production API testing categories** from Cindy Sridharan's taxonomy that are not yet implemented in `tests/`:
   - **OpenAPI Response Schema Contract Tests** (`tests/contracts/`): Request bodies are validated against `openapi.yaml`, but response bodies are not.
   - **Property-Based Tests** (`tests/property/`): Algorithmic and mathematical invariants (`BoardDealer`, Chebyshev-8 reversal symmetry, analytics bounds, Mongo credential stripping) are only tested with fixed examples, not with `fast-check` generators.
   - **Fuzz Tests** (`tests/fuzz/`): The HTTP wrapper and Middy pipeline are not fuzzed with arbitrary malformed JSON, prototype-pollution keys, or extreme numbers via `fast-check`.
   - **Penetration / OWASP API Top 10 Security Tests** (`tests/security/`): No dedicated security suite tests JWT `alg: "none"`, cross-secret key confusion with forged `kind`, NoSQL operator injection, and the complete 13-route Cross-Session BOLA/IDOR matrix in one place.
   - **Chaos / Fault-Injection & Concurrency Stampede Tests** (`tests/chaos/`): No fault-injection decorator tests transient MongoDB connection drops with credentialed URIs across all repositories alongside a 25-learner concurrent stampede.
   - **Performance Micro-Benchmarks & Mutation Testing** (`tests/benchmarks/` + `stryker.config.mjs`): No `vitest bench` suite or Stryker domain mutation config exists yet.
3. **Discoverability for the developer:** Each testing category needs its own clearly named folder under `tests/` (`tests/contracts/`, `tests/property/`, `tests/fuzz/`, `tests/security/`, `tests/chaos/`, `tests/benchmarks/`), documented in `wiki/23-api-testing-taxonomy-and-folder-structure.md` and `tests/README.md`.

## Solution

Deliver the **7 vertical API testing tickets** (`01` through `07`), placing each test category in its dedicated, easily identifiable folder under `tests/` as documented in `wiki/23-api-testing-taxonomy-and-folder-structure.md` and `tests/README.md`.

## User Stories

1. As a developer looking at `tests/` and `wiki/23-api-testing-taxonomy-and-folder-structure.md`, I want every test category to live in a clearly named folder (`domain/`, `adapters/`, `functions/`, `contracts/`, `property/`, `fuzz/`, `security/`, `chaos/`, `benchmarks/`, `web/`, `integration/`) with a `README.md` in each new folder, so that I can identify and run any test category immediately.
2. As a developer running `npm run test:bruno` against a running local server, I want `@usebruno/cli` (`bru run -r`) to execute all 21 `.bru` files in `docs/api/bruno/` top-to-bottom and pass 100% of requests and assertions.
3. As a developer changing an endpoint or `docs/api/openapi.yaml`, I want `tests/contracts/openapi-response-schemas.test.ts` to validate every `/api/v1/*` route's `200`/`201` and `4xx` response bodies against the compiled OpenAPI response schemas in Ajv 2020-12.
4. As a developer maintaining domain logic, I want `tests/property/domain-invariants.property.test.ts` (`fast-check`) to verify board-dealing determinism, Chebyshev-8 chain reversal symmetry, metacognitive analytics bounds, and Mongo credential stripping across hundreds of generated inputs.
5. As a developer hardening the HTTP pipeline, I want `tests/fuzz/api-handler-fuzz.test.ts` (`fast-check`) to fuzz `wrapLambdaHandler` + `createApiHandler` with arbitrary strings, nested objects, `__proto__` keys, and random headers and prove it never returns an unhandled `500 INTERNAL_ERROR` or leaks a stack trace.
6. As a security reviewer, I want `tests/security/owasp-api-security.test.ts` to verify JWT `alg: "none"` rejection, cross-secret key confusion rejection (even with a forged `kind` claim), NoSQL operator injection rejection, and a complete 13-route Cross-Session BOLA/IDOR matrix.
7. As a reliability engineer, I want `tests/chaos/outbound-fault-injection.test.ts` to inject transient repository failures and simulate a 25-learner concurrent classroom stampede, proving atomic retry/failure behavior and zero leaked Mongo credentials.
8. As a performance-conscious developer, I want `tests/benchmarks/domain-and-analytics.bench.ts` (`npm run bench`) and `stryker.config.mjs` (`npm run test:mutation`) configured and documented so I can benchmark hot paths and measure domain mutation scores on demand.
