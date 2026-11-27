# `tests/` Folder Structure & API Testing Guide

Every test category in this repository is organized into its own dedicated directory under `tests/` (mapped to Cindy Sridharan's `@copyconstruct` testing taxonomy).

For the full taxonomy evaluation and command reference, see **[`wiki/23-api-testing-taxonomy-and-folder-structure.md`](../wiki/23-api-testing-taxonomy-and-folder-structure.md)** and **[`.scratch/research/eligible-api-testing-catalog.md`](../.scratch/research/eligible-api-testing-catalog.md)**.

| Folder | Testing Category | What Lives Here | Command |
|---|---|---|---|
| `tests/domain/` | **1. Unit Tests** | Pure domain aggregates & value objects (`GameSession`, `ConceptChain`, `BoardDealer`, `InstructorAccount`) | `npx vitest run tests/domain` |
| `tests/adapters/` | **2. Component & Repo Contract Tests** | Shared `InMemory` + `Mongo` repository contract suites, Netlify v2 wrapper, `PinoLogger`, 33-path redaction | `npx vitest run tests/adapters` |
| `tests/functions/` | **3. Functional & Handler Tests** | All 20 `/api/v1/*` route handlers with `FakeClock`, optimistic concurrency retries, Ajv request schemas, and structured log assertions | `npx vitest run tests/functions` |
| `tests/contracts/` | **4. OpenAPI & Bruno Contract Tests** | OpenAPI response schema validation (`openapi-response-schemas.test.ts`), generated request schema sync, Bruno `.bru` drift guard | `npx vitest run tests/contracts` |
| `tests/property/` | **5. Property-Based Tests (`fast-check`)** | Mathematical invariants (`BoardDealer` determinism, Chebyshev-8 reversal symmetry, analytics bounds, Mongo credential stripping) | `npx vitest run tests/property` |
| `tests/fuzz/` | **6. Fuzz Tests (`fast-check`)** | Fuzzed JSON, malformed UTF-8, deep nesting, `__proto__`, and fuzzed headers into `createApiHandler` (never 500 or stack leak) | `npx vitest run tests/fuzz` |
| `tests/security/` | **7. Penetration & OWASP API Top 10** | JWT `alg: "none"`, cross-secret key confusion, 13-route Cross-Session BOLA/IDOR matrix, NoSQL operator injection | `npx vitest run tests/security` |
| `tests/chaos/` | **8. Chaos / Fault-Injection Tests** | Outbound repository fault injection (transient Mongo drops, credentialed error stripping) & 25-learner concurrency stampede | `npx vitest run tests/chaos` |
| `tests/benchmarks/` | **9. Benchmark Tests (`vitest bench`)** | CPU micro-benchmarks for 7×7 board dealing, 20 Chebyshev-8 Concept Chains, and the 30-learner Board Neglect Heatmap & Chain Diversity Index; `stryker.config.mjs` mutates `src/domain/**` (`npm run test:mutation`) | `npm run bench` |
| `tests/web/` | **10. Frontend Architecture Guards** | Verifies standalone `web/eslint.config.js` `no-useEffect` ban and 3-layer Simple DDD boundary rules | `npx vitest run tests/web` |
| `tests/integration/` | **11. Acceptance / BDD Cucumber HTTP Suite** | 5 Gherkin `.feature` files (65 scenarios, 823 steps) run sequentially over live HTTP against `npm run dev:local` | `npm run test:bdd` |
| `docs/api/bruno/` | **12. Bruno CLI Smoke & Manual Suite** | 21 `.bru` files across 6 folders (`01-Health` through `06-Assessments-Survey-and-Lifecycle`) | `npm run test:bruno` |
