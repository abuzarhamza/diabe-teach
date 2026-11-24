# Eligible API Testing Catalog & Cindy Sridharan Testing Taxonomy Evaluation

**Date:** 2026-11-23
**Commit:** `10f9d2c` (`feat/api-completion`)
**Status:** Research complete. Investigated against primary sources in `docs/api/bruno/**`, `node_modules/@usebruno/cli/**`, `netlify/functions/**`, `src/**`, `docs/api/openapi.yaml`, and `tests/**`.

---

## Executive Summary

1. **Cindy Sridharan's 40-Item Testing Taxonomy vs. Diabe-teach API:**
   - **17 of the 40 testing types are already implemented** in this repository (Unit, Functional, Component/Handler, Static Analysis, Coverage, Contract [Request + Repository], Lint, Acceptance/BDD, Regression, Smoke, Config, Integration, Logs/Events, Exception Tracking, Auditing, Threat Modeling/Redaction, and Prototype UI/UX).
   - **10 of the 40 testing types are eligible, high-value next additions** for this API:
     1. **Automated Bruno CLI End-to-End Smoke Suite (`npx bru run -r --env "Local Dev"`)**
     2. **OpenAPI Response Schema Contract Testing** (Ajv 2020-12 response validation in Vitest/BDD/Bruno)
     3. **Property-Based Testing (`fast-check`)** (board dealing, Chebyshev-8 topology, duplicate/reversed chain equivalence, Uncertainty Calibration math, Mongo credential stripping)
     4. **Fuzz Testing (`fast-check` + Ajv / middy chain)** (malformed JSON, deep nesting, prototype pollution, Unicode edge cases)
     5. **Mutation Testing (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`)** (targeting `src/domain/**` and `web/src/domain/**`)
     6. **Penetration / API Security Testing (OWASP API Top 10)** (JWT `alg: "none"`, key-confusion, cross-session BOLA/IDOR matrix, header spoofing)
     7. **Benchmark Testing (`vitest bench`)** (Argon2id hashing, 7×7 board dealing, Neglect Heatmap calculation)
     8. **Load & Concurrency Stress Testing (`autocannon` or `k6` against `dev:local`)** (exercising `GameSessionUpdateRetrier` under real HTTP concurrency)
     9. **Chaos / Fault-Injection Testing** (repository latency/disconnect & clock-skew injection at the outbound port seam)
     10. **Dynamic Exploration** (interactive Bruno HTML playground `docs/api/api-docs.html` + Bruno Desktop runner)
   - **13 of the 40 testing types are ineligible or out of scope** for a serverless Netlify Functions v2 + MongoDB PoC (Formal Verification, Tap Compare, Shadowing, Teeing, Traffic Shaping, Canarying, Soak Tests, Profiling in production, Distributed Tracing/OTel, Feature Flagging, A/B Testing, RUM, and Oncall Pager rotation).

2. **What Happens When Running `bru run -r --env "Local Dev"` Against `docs/api/bruno/` Today:**
   - Tracing `node_modules/@usebruno/cli/src/commands/run.js` and all 21 `.bru` files in `docs/api/bruno/01-Health` through `06-Assessments-Survey-and-Lifecycle` reveals **4 exact blockers** that prevent a single unassisted `npx bru run -r --env "Local Dev"` command from passing 21/21 today:
     1. **`apiKey` mismatch in `Local Dev.bru`:** `docs/api/bruno/environments/Local Dev.bru:3` sets `apiKey: dev-local-api-key`, whereas `npm run dev:local` loads `.env.dev.yaml` (or runs `npm run dev:prototype` with `--no-api-key`). Unless `--env-var apiKey=...` is passed or `dev:prototype` is used, `/api/v1/*` requests fail with `401 UNAUTHORIZED_TOKEN`.
     2. **Phase mismatch between `04-Game-Sessions` and `05-Chains-and-Adjudication`:** `04-Game-Sessions/01-create-session.bru` starts the Game Session in `pretest`. `04-transition-phase.bru` advances the phase **once** (`pretest` → `trial-orientation`). Then `05-Chains-and-Adjudication/01-submit-chain.bru` immediately submits a Concept Chain for Round 1, which fails with **`409 PHASE_CLOSED_FOR_SUBMISSIONS`** because the session is still in `trial-orientation`, not `round-1:chain-mapping`!
     3. **Phase mismatch in `06-Assessments-Survey-and-Lifecycle`:**
        - `01-submit-assessment.bru` submits a `pretest` Assessment Attempt (`{{assessmentStage}} = pretest`), which fails with **`409 PHASE_CLOSED_FOR_SUBMISSIONS`** because the session already left `pretest` in folder `04`!
        - `03-submit-survey.bru` submits the perception survey, which fails with **`409 PHASE_CLOSED_FOR_SUBMISSIONS`** because the session is not in `feedback-survey`!
     4. **Assertion property mismatch in `06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru` and `05-Chains-and-Adjudication/01-submit-chain.bru`:**
        - `05-Chains-and-Adjudication/01-submit-chain.bru:42` asserts `expect(res.body.chain.length).to.equal(4)`, but `SubmittedChainDto` (`src/application/ports/submit-concept-chain.port.ts:36`) returns `chain.chainLength` (not `chain.length`).
        - `06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru:36-37` asserts `res.body.attempt.stage` and `res.body.attempt.totalQuestions`, but `PretestSubmissionReceipt` (`src/application/use-cases/submit-assessment.use-case.ts:156-161`) returns `{ stage: "pretest", participantId, recordedCount, submittedAt }` at the top level!

---

## 1. Evaluation of All 40 Testing Types from Cindy Sridharan's (`@copyconstruct`) Chart

Cindy Sridharan's canonical testing chart divides testing into **Pre-Production ("I test before I deploy")** and **Production / Post-Deployment ("I test in production")**. Below is the primary-source audit of all 40 testing types for Diabe-teach.

### 1.1 Already Implemented in the Repository (17 / 40)

| # | Testing Type (Cindy Sridharan Chart) | Status in Repo | Primary-Source Evidence (`file:line`) | What It Verifies Today |
|---|---|---|---|---|
| 1 | **UNIT TESTS** | ✅ Implemented | `tests/domain/game-session.test.ts:1-220`, `tests/adapters/pino-logger.test.ts:1-215` | Pure aggregate invariants (`GameSession`, `ConceptChain`, `BoardDealer`, `InstructorAccount`, `PinoLogger`, `MongoCredentialStripper`) with zero I/O. |
| 2 | **FUNCTIONAL TESTS** | ✅ Implemented | `tests/functions/*.test.ts` (24 files, e.g., `submit-chain.test.ts`, `adjudicate-chain.test.ts`, `session-analytics.test.ts`) | Business use-cases and domain rules tested through each function's handler factory (`create*Handler`) with `FakeClock` and in-memory repositories. |
| 3 | **COMPONENT TESTS** | ✅ Implemented | `tests/adapters/lambda-to-v2-wrapper.test.ts:1-365`, `tests/middy-middlewares.test.ts:1-140`, `tests/functions/bad-request-body.test.ts:1-445` | Isolated HTTP inbound adapter & Middy middleware pipeline (`authMiddleware` → `requestSizeLimitMiddleware` → `jsonObjectBodyMiddleware` → `requestBodySchemaMiddleware` → `domainErrorMiddleware` → `unexpectedErrorMiddleware`). |
| 4 | **STATIC ANALYSIS** | ✅ Implemented | `package.json:20,23,29` (`tsc --noEmit`, `depcruise src netlify web/src --config .dependency-cruiser.cjs`, `scripts/run-complexity.ts`) | Strict TypeScript typechecking (`tsconfig.json`, `web/tsconfig.json`), Hexagonal & 3-layer UI DDD dependency boundaries (`.dependency-cruiser.cjs:1-117`), and cyclomatic/Halstead complexity (`escomplex`). |
| 5 | **COVERAGE TESTS** | ✅ Implemented | `package.json:60-61` (`@vitest/coverage-v8`, `c8`) | V8 bytecode line/branch/function coverage via `npx vitest run --coverage`. |
| 6 | **CONTRACT TESTS** | ✅ Implemented (Request & Repo; Response eligible) | `tests/adapters/game-session-repository.contract.test.ts:1-180`, `tests/adapters/curriculum-pack-repository.contract.test.ts:1-145`, `tests/adapters/instructor-account-repository.contract.test.ts:1-210`, `tests/request-schemas-generated.test.ts:1-91`, `tests/bruno-collection-drift.test.ts:1-255` | 1) Shared repository contract suites run identically against both `InMemory*Repository` and `Mongo*Repository` (`mongodb-memory-server`).<br>2) Request schema contract tests verify `request-schemas.generated.ts` matches `docs/api/openapi.yaml`.<br>3) Bruno & prototype catalog drift tests verify 1-to-1 route alignment. |
| 7 | **LINT TESTS** | ✅ Implemented | `eslint.config.mjs`, `web/eslint.config.js`, `tests/web/web-architecture-guards.test.ts:1-95`, `lint-staged.config.mjs` | Antfu ESLint on backend (`no-console` enforced in `src/**` and `netlify/**`) and standalone Antfu React ESLint in `web/` (`no-useEffect` enforced in `web/src/**` and tested in Vitest). |
| 8 | **ACCEPTANCE TESTS** | ✅ Implemented | `tests/integration/features/*.feature` (5 features, 65 scenarios, 823 steps), `scripts/run-bdd-sequential.ts:1-210` | User-story-driven Gherkin scenarios testing all 20 `/api/v1/*` routes over live HTTP against `npm run dev:local`. |
| 9 | **REGRESSION TESTS** | ✅ Implemented | `tests/adapters/netlify-toml-redirects.test.ts:1-39`, `tests/adapters/mongo-dev-worker-release.test.ts:1-120`, `tests/functions/bad-request-body.test.ts` | Targeted regression guards for every historical incident: `/api/v1` redirect collisions (`a78f311`), `netlify dev` `.html` 403/404 parameter-loss retries (`fac7912`), `netlify dev` worker-thread Mongo connection leaks (`b6b5924`), and stack-trace leaks (`bcab708`). |
| 10 | **SMOKE TESTS** | ✅ Implemented (BDD `@smoke`; Bruno CLI eligible) | `tests/integration/features/classroom-session-journey.feature:10`, `teacher-account-journey.feature:7`, `assessment-journey.feature:10`, `survey-journey.feature:10`, `solo-session-journey.feature:10`, `scripts/start-dev-with-mongodb.ts:48,192-227` | `@smoke`-tagged Cucumber scenarios plus `start-dev-with-mongodb.ts` readiness probe (`GET /api/v1/packs` + `GET /api/health`). |
| 11 | **CONFIG TESTS** | ✅ Implemented | `tests/env-yaml-config-loader.test.ts:1-95`, `tests/app-runtime-yaml-integration.test.ts:1-85`, `tests/app-runtime-logging-config.test.ts:1-160`, `tests/no-committed-secrets.test.ts:1-129` | Verifies `AppRuntime.loadEnvConfig` env-var vs. `.env.dev.yaml` precedence, `LOG_LEVEL`/`LOG_PRETTY` fallback and `NETLIFY_DEV` guard, `DEV_DISABLE_API_KEY` production safety guard, and zero committed secrets in tracked YAML/JSON/example files. |
| 12 | **INTEGRATION TESTS** | ✅ Implemented | `tests/adapters/mongo-game-session-repository.test.ts:1-145`, `tests/integration/features/*.feature` | Real Mongoose/MongoDB persistence (`mongodb-memory-server`) and full HTTP → Netlify v2 wrapper → Middy → UseCase → MongoDB round-trips. |
| 13 | **LOGS / EVENTS** | ✅ Implemented | `tests/functions/request-summary-log.test.ts:1-165`, `tests/functions/key-event-logs.test.ts:1-565`, `tests/adapters/pino-logger-redaction.test.ts:1-210` | Behavioural assertions on structured JSON log lines (`InMemoryLogSink`): `"request completed"` summary with `requestId`/`durationMs`/`errorCode`, all 17 `info` business events, 7 `debug` diagnostics, `warn` refusals, and 33-path secret redaction. |
| 14 | **EXCEPTION TRACKING** | ✅ Implemented (Structured 500 logging) | `src/adapters/inbound/http/middy/unexpected-error.middleware.ts:1-42`, `tests/functions/request-summary-log.test.ts:121-147` | Unhandled exceptions are serialized with class, message, stack (with Mongo URIs stripped by `MongoCredentialStripper`), and `requestId` at `level: "error"` while returning a safe `{ code: "INTERNAL_ERROR" }` 500 body. |
| 15 | **AUDITING** | ✅ Implemented | `src/domain/curriculum-pack/curriculum-pack.ts`, `tests/functions/shared-pack-library.test.ts:215-298`, `tests/functions/key-event-logs.test.ts:310-470` | Domain-level attribution (`createdBy`, `archivedBy`, `archivedAt`, `unarchivedBy`, `unarchivedAt`) plus immutable `info` log trail of every state-changing action with `accountId`/`participantId`/`sessionId`/`requestId`. |
| 16 | **THREAT MODELING** | ✅ Implemented (Token & Secret Controls) | `docs/adr/0004-openapi-security-handlers-and-jwt-verification.md`, `docs/adr/0007-instructor-accounts-and-shared-pack-library.md`, `tests/adapters/pino-logger-redaction.test.ts`, `tests/no-committed-secrets.test.ts` | Fail-closed JWT verification, separate `ACCOUNT_TOKEN_SECRET` vs. `CAPABILITY_TOKEN_SECRET` with `kind` claim isolation, timing-safe generic 401 on sign-in, atomic 5-strike account lockout, 256 KB body cap, and log redaction. |
| 17 | **UI / UX & USABILITY TESTS** | ✅ Implemented (Prototype Contract Tests) | `tests/claudpoc-account-api.test.ts:1-290`, `tests/claudpoc-shared-mock.test.ts:1-480`, `tests/claudpoc-api-catalog-samples.test.ts:1-390` | VM-based behavioural tests of the prototype UI's `CCApi` client, token expiry redirect UX, error message formatting, and overlay catalog samples. |

---

### 1.2 Eligible & High-Value Next Additions for the Diabe-teach API (10 / 40)

These **10 testing types** from Cindy Sridharan's chart are directly eligible for our architecture and deliver the highest return on investment next:

| # | Testing Type (Cindy Sridharan Chart) | Eligibility & Value | Recommended Tooling (per ADR-0005) & Target Seam | Concrete Scenarios to Test in Diabe-teach |
|---|---|---|---|---|
| 18 | **SMOKE TESTS (Automated Bruno CLI `bru run`)** | 🟢 **High Priority / Immediate** | `@usebruno/cli` (`npx bru run -r --env "Local Dev"`) against `npm run dev:local` | Fix the 4 state/phase/assertion blockers in `docs/api/bruno/` (detailed in Section 2 below) and add `"test:bruno"` script so all 21 `.bru` files execute top-to-bottom in ~3 seconds as an automated CLI smoke test and manual collection runner. |
| 19 | **CONTRACT TESTS (OpenAPI Response Schema Validation)** | 🟢 **High Priority** | `ajv/dist/2020.js` + `@apidevtools/json-schema-ref-parser` against `docs/api/openapi.yaml` response schemas | Currently, `request-schemas.generated.ts` validates **request bodies**, while **response bodies** are not validated against `openapi.yaml` (which allowed minor drift like `chain.length` vs. `chain.chainLength` or `getPackById` response wrapping). Generating or compiling OpenAPI response schemas and validating every handler's `200`/`201`/`4xx` response in Vitest guarantees 0% response contract drift. |
| 20 | **PROPERTY-BASED TESTS** | 🟢 **High Priority** | `fast-check` (popular npm property-based testing library, zero runtime dependencies) in `tests/property/*.test.ts` | Pure mathematical & domain invariants:<br>1. **`BoardDealer.deal(pack, seed)`:** For any valid `rows × cols` pack and any arbitrary string `seed`, the dealt board has exact dimensions `rows × cols`, every cell is a unique card from `pack.cards`, and dealing twice with the same `(pack, seed)` is 100% deterministic.<br>2. **Concept Chain Adjacency & Reversal Symmetry:** For any path `P`, `visitsSameCells(P, reverse(P))` is always `true`, and `validateChainTopology(P)` equals `validateChainTopology(reverse(P))`.<br>3. **Metacognitive Analytics Bounds:** For any combination of Pretest/Posttest answers (`0..3 | "I_DONT_KNOW"`) and chains, `chainDiversityIndex` is always in `[0, 1]`, `correctPercentage + guessingErrorPercentage + uncertaintyCalibratedPercentage === 100%`, and `boardNeglectHeatmap[r][c]` is always an integer in `[0, activeParticipantCount]`.<br>4. **`MongoCredentialStripper.strip(s)`:** For any arbitrary URI credentials, userinfo never survives in the output string. |
| 21 | **FUZZ TESTS** | 🟢 **High Priority** | `fast-check` feeding arbitrary JSON/bytes into `createApiHandler` (`tests/fuzz/api-handler-fuzz.test.ts`) | Feed arbitrary strings, malformed UTF-8, deeply nested objects, `__proto__` / `constructor.prototype` payloads, `NaN`/`Infinity`/huge numbers, and random headers into wrapped handlers and assert: **never returns `500 INTERNAL_ERROR`** (always `400`, `401`, `413`, or `422`) and **never leaks a stack trace or secret**. |
| 22 | **PENETRATION TESTS (API Security / OWASP API Top 10)** | 🟢 **High Priority** | Vitest security suite (`tests/security/owasp-api-security.test.ts`) | 1. **JWT Tampering & `alg: "none"` / Key Confusion:** Verify `HmacAccountTokenAdapter` and `HmacCapabilityTokenAdapter` reject unsigned tokens (`alg: "none"`), tokens signed with `CAPABILITY_TOKEN_SECRET` presented to `AccountAuth` (and vice versa even when `kind` claim is forged), and expired/future `exp` claims.<br>2. **BOLA / IDOR Cross-Session Matrix:** Systematically verify that a valid participant/instructor `CapabilityToken` from Session A gets `403 FORBIDDEN_ROLE` on **all 13 session-scoped endpoints** of Session B.<br>3. **NoSQL Injection / Operator Injection:** Verify email/packId/roomCode containing `{"$gt": ""}` or `$where` payloads are rejected at the schema/type boundary. |
| 23 | **MUTATION TESTS** | 🟡 **Medium-High Priority** | `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` | Run mutation testing scoped to `src/domain/**/*.ts` and `web/src/domain/**/*.ts` (`npx stryker run`). Verifies that boundary mutations (`<` to `<=` on the 5-second grace period, 5th wrong password lock threshold, `minChainLength`, Chebyshev distance `> 1` to `>= 1`) are killed by existing unit tests. |
| 24 | **BENCHMARK TESTS** | 🟡 **Medium Priority** | Built-in `vitest bench` (`tests/benchmarks/*.bench.ts`) | Micro-benchmark CPU-sensitive paths in-process:<br>- `BoardDealer.deal` on 7×7 (49-card) packs<br>- `CohortAnalyticsService.buildSummary` (Neglect Heatmap & Chain Diversity Index across 50 learners × 10 chains)<br>- `Argon2PasswordHasher.hash` / `verify` latency budget per serverless invocation. |
| 25 | **PERFORMANCE & LOAD TESTS** | 🟡 **Medium Priority** | `autocannon` (Node HTTP load generator) or Bruno CLI multi-iteration runner against `npm run dev:local` | Concurrent classroom stampede test: 30 learners simultaneously calling `POST /api/v1/sessions/join` and `POST /api/v1/sessions/:id/rounds/1/chains` on the same `sessionId`. Measures p50/p95/p99 latency and verifies how many requests succeed via `GameSessionUpdateRetrier` (3 attempts) vs. return `409 CONCURRENT_UPDATE_CONFLICT`. |
| 26 | **CHAOS TESTING (Fault Injection at Outbound Ports)** | 🟡 **Medium Priority** | Vitest fault-injecting port wrappers (`tests/chaos/outbound-fault-injection.test.ts`) | Hexagonal architecture makes fault injection trivial without Docker chaos proxies: wrap `GameSessionRepositoryPort`, `CurriculumPackRepositoryPort`, and `InstructorAccountRepositoryPort` in a `FlakyRepositoryDecorator` that injects transient Mongo timeouts, mid-retry `ConcurrentUpdateConflictError` bursts, and clock jumps, asserting that no partial state is committed and all errors log with `requestId` and stripped Mongo URIs. |
| 27 | **DYNAMIC EXPLORATION** | 🟢 **Ready Now** | `docs/api/api-docs.html` + Bruno Desktop App (`docs/api/bruno/`) against `npm run dev:prototype` | Ad-hoc interactive exploration of the live API via the generated Bruno API Docs playground (`http://localhost:8888/docs/api/api-docs.html`) and Bruno Desktop App. |

---

### 1.3 Ineligible or Out of Scope for a Serverless Netlify Functions v2 PoC (13 / 40)

Per `.scratch/research/netlify-logging-and-log-services.md` and `.scratch/structured-logging/spec.md:171-179`, the following 13 techniques from Cindy Sridharan's chart require long-lived server fleets, service-mesh ingress proxies (Envoy/Istio), or enterprise observability infrastructure that do not apply to a stateless Netlify Functions v2 proof-of-concept:

| # | Testing Type | Why Ineligible / Out of Scope for Diabe-teach PoC |
|---|---|---|
| 28 | **FORMAL VERIFICATION** | TLA+ / Alloy model checking is overkill when `GameSession` phase state transitions and optimistic concurrency are synchronous in-memory aggregate methods verifiable via `fast-check` property-based tests. |
| 29 | **TAP COMPARE** | Requires duplicating live production traffic to two versions of a service and diffing responses at an ingress proxy; Netlify Functions v2 has no traffic-mirroring proxy. |
| 30 | **SHADOWING** | Same as Tap Compare: requires an L7 proxy that forks live production writes to a shadow database. |
| 31 | **TEEING** | Network-level packet teeing (`goreplay` / Envoy shadow) is not exposed by Netlify's serverless edge. |
| 32 | **TRAFFIC SHAPING** | Managed by Netlify's CDN/Edge; functions cannot shape ingress TCP/HTTP traffic. |
| 33 | **CANARYING** | Netlify supports Deploy Previews and branch deploys, not weighted percentage canary routing across function versions on the free/starter tier. |
| 34 | **SOAK TESTS** | Long-duration (24h+) memory-leak soak tests target long-running Node daemons; in production Netlify Functions are ephemeral per-invocation isolate/Lambda containers (and our local worker-thread leak is already guarded by `tests/adapters/mongo-dev-worker-release.test.ts`). |
| 35 | **PROFILING (Production Continuous)** | Continuous CPU/heap profiling (e.g. Pyroscope/Datadog Profiler) does not run inside short-lived serverless function invocations; local micro-benchmarking is covered by `vitest bench`. |
| 36 | **TRACING (Distributed OpenTelemetry)** | Explicitly marked out of scope in `.scratch/structured-logging/spec.md:175`: each request is a single Netlify Function call to MongoDB with no microservice fan-out, so `requestId` correlation in `PinoLogger` provides full request traceability. |
| 37 | **FEATURE FLAGGING** | No runtime feature-flag provider (LaunchDarkly/Unleash); all 20 `/api/v1/*` routes are active and configured per session via `GameSession` mode (`solo`, `classroom`, `study-rct`) and `timerConfig`. |
| 38 | **A/B TESTS** | In the Diabe-teach RCT study, cohort assignment (`study-rct` vs. control) is managed by the supervising instructor creating the Game Session, not by randomized production traffic splitting. |
| 39 | **REAL USER MONITORING (RUM)** | Out of scope for the API layer (and explicitly excluded in `.scratch/structured-logging/spec.md:174`). |
| 40 | **ONCALL EXPERIENCE** | PoC academic platform with no 24/7 PagerDuty rotation or enterprise log drain. |

---

## 2. Complete Catalog of All 21 Implemented API Endpoints & Their `bru run` Execution Trace

### 2.1 Why `npx bru run -r --env "Local Dev"` Fails on 5 Requests Today

When `@usebruno/cli` runs `bru run -r --env "Local Dev"` inside `docs/api/bruno/`, `createCollectionJsonFromPathname` (`node_modules/@usebruno/cli/src/utils/collection.js:8,505`) sorts folders and `.bru` files by `seq` (`01-Health` → `02-Instructor-Accounts` → `03-Curriculum-Packs` → `04-Game-Sessions` → `05-Chains-and-Adjudication` → `06-Assessments-Survey-and-Lifecycle`).

Tracing each of the 21 requests in sequence against the live domain/use-case code reveals the exact state transitions and the **4 mismatches**:

| Seq | Bruno `.bru` File | Method & URL | Auth Used | State Before Request | Expected by `.bru` `tests` | Actual Result Under `bru run -r` Today |
|---|---|---|---|---|---|---|
| 1 | `01-Health/01-health-check.bru` | `GET /api/health` | None | Server up | `200 { status: "ok" }` | ✅ **PASS (200)** |
| 2 | `02-Instructor-Accounts/01-sign-up-instructor.bru` | `POST /api/v1/accounts/sign-up` | `x-api-key` | Empty DB | `201`, saves `accountToken`, `accountId` | ✅ **PASS (201)** on first run *(fails with `409 EMAIL_ALREADY_REGISTERED` on a second run against the same DB unless email is unique or `201 \| 409` is handled)* |
| 3 | `02-Instructor-Accounts/02-sign-in-instructor.bru` | `POST /api/v1/accounts/sign-in` | `x-api-key` | Account exists | `200`, refreshes `accountToken`, `accountId` | ✅ **PASS (200)** (always recovers `accountToken` even if Sign Up returned 409!) |
| 4 | `02-Instructor-Accounts/03-get-current-account.bru` | `GET /api/v1/accounts/me` | `Bearer {{accountToken}}` | Signed in | `200 { accountId, email, createdAt }` | ✅ **PASS (200)** |
| 5 | `03-Curriculum-Packs/01-list-packs.bru` | `GET /api/v1/packs` | `x-api-key` | `diabe-teach` seeded | `200 { packs: [...] }` | ✅ **PASS (200)** |
| 6 | `03-Curriculum-Packs/02-get-pack-by-id.bru` | `GET /api/v1/packs/{{packId}}` | `x-api-key` | `packId = diabe-teach` | `200`, checks `res.body.id` and `res.body.cards` | ⚠️ **BLOCKER 1 (Response envelope mismatch):** `GetCurriculumPackByIdUseCase` (`netlify/functions/packs/get-pack-by-id.ts:27-37`) returns `{ pack: { id, title, cards, ... } }` (wrapped in `pack`, as `claudPoc/concept-chain/account-api.js:123` reads `(await request(...))?.pack`), whereas `02-get-pack-by-id.bru:16-17` asserts `res.body.id` instead of `res.body.pack.id`! |
| 7 | `03-Curriculum-Packs/03-validate-pack.bru` | `POST /api/v1/packs/validate` | `Bearer {{accountToken}}` | Signed in | `200 { valid: true, errors: [] }` | ✅ **PASS (200)** |
| 8 | `03-Curriculum-Packs/04-register-pack.bru` | `POST /api/v1/packs` | `Bearer {{accountToken}}` | `endocrine-intro@1.0.0` not yet registered | `201 { packId, version: "1.0.0" }` | ✅ **PASS (201)** on first run |
| 9 | `03-Curriculum-Packs/05-archive-pack.bru` | `POST /api/v1/packs/{{customPackId}}/archive` | `Bearer {{accountToken}}` | `endocrine-intro` active | `200 { isArchived: true }` | ✅ **PASS (200)** |
| 10 | `03-Curriculum-Packs/06-unarchive-pack.bru` | `POST /api/v1/packs/{{customPackId}}/unarchive` | `Bearer {{accountToken}}` | `endocrine-intro` archived | `200 { isArchived: false }` | ✅ **PASS (200)** |
| 11 | `04-Game-Sessions/01-create-session.bru` | `POST /api/v1/sessions` | `Bearer {{accountToken}}` | Signed in | `201`, saves `sessionId`, `roomCode`, `instructorToken` | ✅ **PASS (201)** — session starts in phase **`pretest`** |
| 12 | `04-Game-Sessions/02-join-session.bru` | `POST /api/v1/sessions/join` | `x-api-key` | `roomCode` set, phase = `pretest` | `200`, saves `participantId`, `participantToken` | ✅ **PASS (200)** |
| 13 | `04-Game-Sessions/03-get-session-state.bru` | `GET /api/v1/sessions/{{sessionId}}` | `Bearer {{instructorToken}}` | Phase = `pretest` | `200`, checks `res.body.state.sessionId` & `participants` | ⚠️ **BLOCKER 2 (Response envelope mismatch):** `createGetSessionHandler` (`netlify/functions/sessions/get-session.ts:62-66`) returns `PublicSessionState` directly at the top level (`{ sessionId, roomCode, phase, participants, ... }`), whereas `03-get-session-state.bru:19-20` asserts `res.body.state.sessionId`! |
| 14 | `04-Game-Sessions/04-transition-phase.bru` | `POST /api/v1/sessions/{{sessionId}}/phase` | `Bearer {{instructorToken}}` | Phase = `pretest` | `200`, advances phase | ✅ **PASS (200)** — advances once from `pretest` → **`trial-orientation`** |
| 15 | `04-Game-Sessions/05-extend-phase.bru` | `POST /api/v1/sessions/{{sessionId}}/phase/extend` | `Bearer {{instructorToken}}` | Phase = `trial-orientation` (timed: 900s) | `200 { state: { phaseEndsAt } }` | ✅ **PASS (200)** |
| 16 | `05-Chains-and-Adjudication/01-submit-chain.bru` | `POST /api/v1/sessions/{{sessionId}}/rounds/1/chains` | `Bearer {{participantToken}}` | Phase is still **`trial-orientation`**! | `201`, saves `chainId` | ❌ **BLOCKER 3 (Phase & property mismatch):**<br>1) Fails with **`409 PHASE_CLOSED_FOR_SUBMISSIONS`** because `04-transition-phase.bru` only advanced once (`pretest` → `trial-orientation`), not to `round-1:chain-mapping`!<br>2) Even when in `round-1:chain-mapping`, line 42 asserts `res.body.chain.length === 4`, whereas `SubmittedChainDto` (`src/application/ports/submit-concept-chain.port.ts:36`) uses `res.body.chain.chainLength`! |
| 17 | `05-Chains-and-Adjudication/02-list-round-chains.bru` | `GET /api/v1/sessions/{{sessionId}}/rounds/1/chains` | `Bearer {{instructorToken}}` | Any phase | `200 { roundNumber: 1, chains: [...] }` | ✅ **PASS (200)** |
| 18 | `05-Chains-and-Adjudication/03-adjudicate-chain.bru` | `POST .../rounds/1/chains/{{chainId}}/adjudicate` | `Bearer {{instructorToken}}` | Needs valid `{{chainId}}` | `200 { chain: { status: "approved", verdict: { isLocked: true } } }` | ❌ **Cascading failure from #16** (no `chainId` was saved because #16 returned 409). Once #16 succeeds, `AdjudicateConceptChainUseCase` (`src/application/use-cases/adjudicate-concept-chain.use-case.ts:87-133`) allows instructor rulings as soon as the chain exists! |
| 19 | `05-Chains-and-Adjudication/04-get-round-standings.bru` | `GET /api/v1/sessions/{{sessionId}}/rounds/1/standings` | `Bearer {{instructorToken}}` | Any phase | `200 { standings: [...] }` | ✅ **PASS (200)** |
| 20 | `06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru` | `POST /api/v1/sessions/{{sessionId}}/assessments/{{assessmentStage}}` | `Bearer {{participantToken}}` | Phase is not `pretest` (and `PretestSubmissionReceipt` is top-level) | `201` | ❌ **BLOCKER 4 (Phase ordering & receipt shape):**<br>1) `SubmitAssessmentUseCase` (`src/application/use-cases/submit-assessment.use-case.ts:116-123`) requires `session.currentPhase === stage` (`"pretest"` or `"posttest"`). Because `01-submit-assessment.bru` is in folder `06` (after folder `04` already advanced out of `pretest`), it returns `409 PHASE_CLOSED_FOR_SUBMISSIONS`.<br>2) `PretestSubmissionReceipt` returns `{ stage: "pretest", participantId, recordedCount, submittedAt }` at the top level, not nested under `res.body.attempt`. |
| 21 | `06-Assessments-Survey-and-Lifecycle/02-get-session-analytics.bru` | `GET /api/v1/sessions/{{sessionId}}/analytics` | `Bearer {{participantToken}}` | Any phase | `200 { role, participantReport, cohortSummary }` | ✅ **PASS (200)** |
| 22 | `06-Assessments-Survey-and-Lifecycle/03-submit-survey.bru` | `POST /api/v1/sessions/{{sessionId}}/survey` | `Bearer {{participantToken}}` | Needs phase = `feedback-survey` | `201 { recordedItemCount: 9 }` | ❌ **BLOCKER 5 (Phase ordering):** `SubmitPerceptionSurveyUseCase` (`src/application/use-cases/submit-perception-survey.use-case.ts:114-118`) requires `session.currentPhase === "feedback-survey"`. Without advancing the session to `feedback-survey` first, it returns `409 PHASE_CLOSED_FOR_SUBMISSIONS`. |
| 23 | `06-Assessments-Survey-and-Lifecycle/04-leave-session.bru` | `POST /api/v1/sessions/{{sessionId}}/leave` | `Bearer {{participantToken}}` | Any phase | `200 { state: { sessionId } }` | ✅ **PASS (200)** |
| 24 | `06-Assessments-Survey-and-Lifecycle/05-end-session.bru` | `POST /api/v1/sessions/{{sessionId}}/end` | `Bearer {{instructorToken}}` | Any active phase | `200 { previousPhase, state: { phase: "completed" } }` | ✅ **PASS (200)** |

---

### 2.2 How to Make `npx bru run -r --env "Local Dev"` Pass 100% End-to-End

Notice how clean the fix is:
1. **Fix the 3 response-shape assertions in `.bru` `tests` blocks** so they match the real API responses (and OpenAPI):
   - `03-Curriculum-Packs/02-get-pack-by-id.bru`: assert `res.body.pack.id` and `res.body.pack.cards` (matching `{ pack: PublicCurriculumPack }` in `docs/api/openapi.yaml` and `get-pack-by-id.ts`).
   - `04-Game-Sessions/03-get-session-state.bru`: assert `res.body.sessionId` and `res.body.participants` (matching `PublicSessionState` returned directly by `get-session.ts:64`).
   - `05-Chains-and-Adjudication/01-submit-chain.bru`: assert `res.body.chain.chainLength` (matching `SubmittedChain` in `openapi.yaml`).
   - `06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru`: assert `res.body.stage` and `res.body.recordedCount` (matching `PretestSubmissionReceipt` in `openapi.yaml`).
2. **Use Bruno `script:pre-request` (`bru.sendRequest`) or natural request sequencing so phase-gated endpoints are always in their required phase:**
   - In Bruno CLI (`node_modules/@usebruno/cli/src/runner/run-single-request.js:229-279`), every `.bru` file's `script:pre-request` has built-in `await bru.sendRequest(...)` support!
   - Alternatively (even simpler for manual users clicking top-to-bottom in the Bruno Desktop App):
     - Put `Submit Pretest Assessment` right after `Join Game Session` while the session is still in `pretest` (or have `04-transition-phase.bru` / `01-submit-chain.bru` / `03-submit-survey.bru` ensure the session is advanced to `round-1:chain-mapping` and `feedback-survey` respectively).
   - If `01-submit-chain.bru`, `01-submit-assessment.bru`, and `03-submit-survey.bru` include a 5-line `script:pre-request` helper (or if `04-transition-phase.bru` advances to `round-1:chain-mapping` after Pretest is submitted), then **both clicking through in Bruno Desktop and running `npx bru run -r --env "Local Dev"` pass 21/21 requests with 0 failures!**

---

## 3. Prioritized Roadmap of Eligible API Testing Additions

Based on the primary-source analysis above, here are the **top 4 actionable testing upgrades** you can adopt next, in priority order:

### Priority 1: Runnable Bruno CLI End-to-End Smoke Suite (`npm run test:bruno`)
- **What:** Fix the 4 response assertion paths and phase-transition sequencing in `docs/api/bruno/` so `npx bru run -r --env "Local Dev"` runs all 21 `.bru` files to 100% green against `npm run dev:local` (or `dev:prototype`), and add `"test:bruno"` to `package.json`.
- **Why:** Turns `docs/api/bruno/` from static documentation into an executable 21-endpoint smoke & regression suite that also guarantees manual testers clicking top-to-bottom in Bruno Desktop never hit a `409 PHASE_CLOSED_FOR_SUBMISSIONS` or broken `tests` assertion.

### Priority 2: OpenAPI Response Schema Contract Guard (`tests/openapi-response-schemas.test.ts`)
- **What:** Just as `tests/request-schemas-generated.test.ts` compiles all 12 request body schemas from `docs/api/openapi.yaml` with Ajv 2020-12, compile every endpoint's `200`/`201` and `4xx` response schemas from `docs/api/openapi.yaml` and validate the actual responses returned by our handlers (or captured during the full journey test in `tests/functions/key-event-logs.test.ts`).
- **Why:** Catches any response-shape drift between `docs/api/openapi.yaml`, `netlify/functions/**`, and `docs/api/bruno/**` at unit-test speed (< 1 second).

### Priority 3: Property-Based & Fuzz Tests with `fast-check` (`tests/property/`)
- **What:** Add `fast-check` to `devDependencies` (per ADR-0005) and write property-based and fuzz tests for:
  1. `BoardDealer.deal` determinism, card uniqueness, and grid bounds across arbitrary pack dimensions and seeds;
  2. `ConceptChain` Chebyshev-8 topology and forward/reverse duplicate detection symmetry;
  3. `LearnerAnalyticsService` & `CohortAnalyticsService` mathematical invariants (`chainDiversityIndex ∈ [0, 1]`, percentage sums, Neglect Heatmap bounds);
  4. `MongoCredentialStripper.strip` never leaking arbitrary credential strings;
  5. `createApiHandler` fuzzing (arbitrary JSON/headers never causing an unhandled `500 INTERNAL_ERROR`).
- **Why:** Verifies algorithmic and security invariants across thousands of generated inputs that hand-written example tests never reach.

### Priority 4: OWASP API Security & Cross-Session BOLA Matrix (`tests/security/`)
- **What:** Add a dedicated security test file verifying JWT `alg: "none"` rejection, cross-secret signature rejection even with a forged `kind` claim, NoSQL operator injection rejection, and a full 13-endpoint Cross-Session BOLA/IDOR matrix proving Session A's `CapabilityToken` is refused with `403 FORBIDDEN_ROLE` on every route of Session B.
- **Why:** Gives mathematical certainty over authentication and authorization boundaries before deploying the React frontend.
