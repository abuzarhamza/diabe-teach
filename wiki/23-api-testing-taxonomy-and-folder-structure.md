# 23. API Testing Taxonomy & `tests/` Folder Structure

This page documents how the repository's test suites map to **Cindy Sridharan's (`@copyconstruct`) Testing Taxonomy**, where each test category lives inside the **`tests/`** folder structure so you can find or add any test at a glance, and which npm command runs each category.

Primary research source: [`.scratch/research/eligible-api-testing-catalog.md`](../.scratch/research/eligible-api-testing-catalog.md).

---

## 1. Visual `tests/` Folder Structure (By Testing Category)

Every test category has its own clearly named folder under `tests/` so you can immediately tell what kind of test a file is:

```text
tests/
├── README.md                                  # Quick index of every test folder & command
│
├── domain/                                    # 1. UNIT TESTS (Pure Domain Aggregates & Value Objects)
│   └── game-session.test.ts                   #    Zero I/O, zero HTTP, zero mocks
│
├── adapters/                                  # 2. COMPONENT & REPOSITORY CONTRACT TESTS
│   ├── curriculum-pack-repository.contract.test.ts      # Shared InMemory + Mongo repo contract
│   ├── game-session-repository.contract.test.ts         # Shared InMemory + Mongo snapshot round-trip
│   ├── instructor-account-repository.contract.test.ts   # Shared InMemory + Mongo atomic lockout contract
│   ├── mongo-game-session-repository.test.ts            # Real Mongoose/mongodb-memory-server integration
│   ├── mongo-dev-worker-release.test.ts                 # Regression: netlify dev worker-thread release
│   ├── lambda-to-v2-wrapper.test.ts                     # Component: Netlify v2 URL & .html retry wrapper
│   ├── netlify-toml-redirects.test.ts                   # Regression: bans /api/v1 redirects in netlify.toml
│   ├── pino-logger.test.ts                              # Component: PinoLogger levels, child fields, pretty guard
│   └── pino-logger-redaction.test.ts                    # Threat Modeling: 33-path secret redaction & Mongo URI stripper
│
├── functions/                                 # 3. FUNCTIONAL, LOGGING & SCHEMA HANDLER TESTS
│   ├── instructor-accounts.test.ts            #    In-process handler seam with FakeClock + in-memory repos
│   ├── register-pack.test.ts
│   ├── validate-pack.test.ts
│   ├── archive-pack.test.ts
│   ├── unarchive-pack.test.ts
│   ├── list-packs.test.ts
│   ├── pack-list-authors.test.ts
│   ├── shared-pack-library.test.ts
│   ├── get-pack-by-id.test.ts
│   ├── get-pack-by-id-comprehensive.test.ts
│   ├── create-session.test.ts
│   ├── join-session.test.ts
│   ├── get-session.test.ts
│   ├── transition-phase.test.ts
│   ├── extend-phase.test.ts
│   ├── end-session.test.ts
│   ├── leave-session.test.ts
│   ├── session-board.test.ts
│   ├── session-pack-version.test.ts
│   ├── session-phase-deadline.test.ts         #    FakeClock 5-second grace window boundary tests
│   ├── session-write-conflict.test.ts         #    Deterministic optimistic-concurrency 3-retry tests
│   ├── submit-chain.test.ts
│   ├── list-round-chains.test.ts
│   ├── adjudicate-chain.test.ts
│   ├── get-standings.test.ts
│   ├── submit-assessment.test.ts
│   ├── submit-survey.test.ts
│   ├── session-analytics.test.ts
│   ├── bad-request-body.test.ts               #    400 malformed JSON, 413 payload >256KB, 500 stack-leak guard
│   ├── request-body-schema.test.ts            #    Combinatorial Ajv 2020-12 request schema matrix
│   ├── request-summary-log.test.ts            #    Logs/Events: per-request "request completed" summary line
│   └── key-event-logs.test.ts                 #    Logs/Events & Auditing: 17 info events, 7 debug diagnostics, secret scan
│
├── contracts/                                 # 4. API CONTRACT & DRIFT TESTS (OpenAPI & Bruno)
│   ├── openapi-response-schemas.test.ts       #    [Ticket 02] Validates all 20 /api/v1/* 2xx & 4xx responses against openapi.yaml
│   ├── request-schemas-generated.test.ts      #    Verifies request-schemas.generated.ts is in sync with openapi.yaml
│   └── bruno-collection-drift.test.ts         #    Verifies docs/api/bruno/*.bru matches all 21 routes & Ajv request schemas
│
├── property/                                  # 5. PROPERTY-BASED TESTS (fast-check mathematical invariants)
│   └── domain-invariants.property.test.ts     #    [Ticket 03] BoardDealer determinism, Chebyshev-8 reversal symmetry, analytics bounds
│
├── fuzz/                                      # 6. FUZZ TESTS (fast-check arbitrary payloads into createApiHandler)
│   └── api-handler-fuzz.test.ts               #    [Ticket 04] Malformed UTF-8, deep JSON, __proto__, NaN -> never 500 or stack leak
│
├── security/                                  # 7. PENETRATION & OWASP API TOP 10 SECURITY TESTS
│   └── owasp-api-security.test.ts             #    [Ticket 05] JWT alg:none, cross-secret key confusion, 13-route BOLA matrix, NoSQL injection
│
├── chaos/                                     # 8. CHAOS / FAULT-INJECTION & CONCURRENCY STAMPEDE TESTS
│   └── outbound-fault-injection.test.ts       #    [Ticket 06] Transient Mongo errors, credential stripping on crash, 25-learner stampede
│
├── benchmarks/                                # 9. PERFORMANCE MICRO-BENCHMARKS (vitest bench)
│   └── domain-and-analytics.bench.ts          #    [Ticket 07] 7x7 BoardDealer, 20 Chebyshev-8 chains, 30-learner Neglect Heatmap & Diversity Index
│
├── web/                                       # 10. FRONTEND ARCHITECTURE & LINT GUARD TESTS
│   └── web-architecture-guards.test.ts        #     Verifies standalone web/eslint.config.js no-useEffect ban & 3-layer DDD rules
│
├── integration/                               # 11. ACCEPTANCE / BDD CUCUMBER HTTP TESTS (against npm run dev:local)
│   ├── features/
│   │   ├── assessment-journey.feature         #     8 scenarios
│   │   ├── classroom-session-journey.feature  #     28 scenarios
│   │   ├── solo-session-journey.feature       #     8 scenarios
│   │   ├── survey-journey.feature             #     6 scenarios
│   │   └── teacher-account-journey.feature    #     15 scenarios
│   ├── step-definitions/
│   └── support/
│
└── support/                                   # Shared test utilities (InMemoryLogSink, vitest-setup, type declarations)
```

*(Note: Top-level config & prototype contract tests `env-yaml-config-loader.test.ts`, `app-runtime-yaml-integration.test.ts`, `app-runtime-logging-config.test.ts`, `no-committed-secrets.test.ts`, `middy-middlewares.test.ts`, and `claudpoc-*.test.ts` also run in the main Vitest pass.)*

---

## 2. Quick Command Matrix by Testing Type

| Testing Category (Cindy Sridharan Chart) | Folder / Location | Command to Run | Needs `dev:local` Server? |
|---|---|---|---|
| **Unit Tests** | `tests/domain/` | `npx vitest run tests/domain` | No |
| **Functional / Handler Tests** | `tests/functions/` | `npx vitest run tests/functions` | No (uses `FakeClock` & in-memory repos) |
| **Component & Repo Contract Tests** | `tests/adapters/` | `npx vitest run tests/adapters` | No (uses `mongodb-memory-server`) |
| **OpenAPI & Bruno Contract Tests** | `tests/contracts/` (and `tests/bruno-collection-drift.test.ts`) | `npx vitest run tests/contracts` | No |
| **Property-Based Tests (`fast-check`)** | `tests/property/` | `npx vitest run tests/property` | No |
| **Fuzz Tests (`fast-check`)** | `tests/fuzz/` | `npx vitest run tests/fuzz` | No |
| **Penetration / OWASP API Security Tests** | `tests/security/` | `npx vitest run tests/security` | No |
| **Chaos / Fault-Injection Tests** | `tests/chaos/` | `npx vitest run tests/chaos` | No |
| **Config & Secret Scanner Tests** | `tests/no-committed-secrets.test.ts`, `tests/*config*.test.ts` | `npx vitest run tests/no-committed-secrets.test.ts` | No |
| **Lint & Architecture Boundary Tests** | `tests/web/`, `.dependency-cruiser.cjs` | `npm run lint && npm run lint:web && npm run lint:boundaries` | No |
| **Benchmark Tests** | `tests/benchmarks/` | `npm run bench` (`npx vitest bench`) | No |
| **Mutation Tests (Stryker)** | `stryker.config.mjs` (`src/domain/**`) | `npm run test:mutation` | No |
| **Bruno CLI Smoke Suite (21 Endpoints)** | `docs/api/bruno/` | `npm run test:bruno` | **Yes** (`npm run dev:local` or `dev:prototype`) |
| **Acceptance / BDD Cucumber Suite (65 Scenarios)** | `tests/integration/features/` | `npm run test:bdd` | **Yes** (`npm run dev:local`) |
| **Dynamic Exploration (Interactive HTML & Desktop)** | `docs/api/api-docs.html`, `docs/api/bruno/` | Open `http://localhost:8888/docs/api/api-docs.html` | **Yes** (`npm run dev:prototype`) |
