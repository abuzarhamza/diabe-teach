# API Architecture: Hexagonal DDD on Netlify Functions v2

How the backend is built **today**. Read this before designing, implementing or reviewing API routes, domain logic, ports/adapters or deployment.

Checked against the code at commit `b8ef47c` (2026-11-19; the last code change is `bcab708`, api-hardening 01). Source and tests win over this page: if they disagree, trust the code and fix this page.

Decision records: ADR-0001 (subject-agnostic packs), ADR-0002 (hexagonal layers, Netlify, MongoDB), ADR-0004 (fail-closed bearer tokens, JWT), ADR-0005 (npm-first, middy), ADR-0006 (pack lifecycle), ADR-0007 (Instructor Accounts, Account Token, Pack Version pinning), ADR-0008 (Simple 3-layer DDD React + Vite frontend under `web/src/{domain,api,features}`). ADR-0002 and ADR-0004 also describe an `OpenApiHttpApp` router and a single `api.ts` entrypoint that commit `3c5f131` removed; see the "Superseded in part" note at the top of each.

**There is no central router.** There is no `OpenApiHttpApp`, no `openapi-backend`, no `src/adapters/inbound/http/create-app.ts`, no `netlify/functions/api.ts`, no `BaseHttpHandler`, and no SSE stream route. `docs/api/openapi.yaml` is the API contract, but nothing reads it at runtime.

## 1. Layout

```
src/
├── app-runtime.ts            AppRuntime: env config + warm-cached production wiring (composition root)
├── app-runtime.types.ts      RuntimeEnvConfig, ProductionDependencies
├── domain/                   Aggregates, value objects, DomainError subclasses (pure)
│   ├── curriculum-pack/      CurriculumPack, PackId, DIABE_TEACH_PACK
│   ├── game-session/         GameSession, ConceptChain, BoardDealer, RoomCode, SessionId
│   ├── instructor-account/   InstructorAccount, AccountEmail, AccountPasswordPolicy
│   └── errors/               domain-errors.ts (+ .types.ts)
├── application/
│   ├── ports/*.port.ts       Inbound (use-case command/result) and outbound port contracts
│   ├── use-cases/*.use-case.ts
│   ├── services/             SessionPackLoader, GameSessionUpdateRetrier, pack validator
│   └── dtos/                 *.dto.ts contracts + projector classes (role-aware redaction)
├── adapters/
│   ├── inbound/http/
│   │   ├── middy/            createApiHandler (api-handler.ts) + its four middlewares
│   │   ├── lambda-to-v2-wrapper.ts   wrapLambdaHandler(handler, config): Netlify v2 Request <-> Lambda event/result
│   │   ├── request-logger.ts         requestLoggerOf(event): per-invocation child logger (defaults to SilentLogger)
│   │   └── json-object-body.ts       readJsonObjectBody / readOptionalJsonObjectBody
│   └── outbound/             Mongo (mongoose) + in-memory repositories, token adapters,
│                             clock, id/seed generators, argon2 hasher, YAML env loader,
│                             PinoLogger + MongoCredentialStripper
netlify/functions/
├── <route>.ts                One per route: declares `config` (path + method), default-exports wrapLambdaHandler(lambdaHandler, config)
├── packs/<route>.ts          Handler implementations for pack routes
├── sessions/<route>.ts       Handler implementations for session routes
├── accounts/<route>.ts       Handler implementations for account routes
└── health.ts                 GET /api/health (no middleware)
```

### Dependency rule (enforced by `npm run lint:boundaries`, `.dependency-cruiser.cjs`)

- `src/domain/` imports only `src/domain/` (no npm packages, no `node:*`). Time and randomness come in as values or ports.
- `src/application/` imports only `src/application/` and `src/domain/`.
- `src/adapters/inbound/` and `src/adapters/outbound/` never import each other.
- `mongodb` / `mongoose` and `mongo-client-singleton` only inside `src/adapters/outbound/`.
- Nothing under `src/domain|application|adapters` imports `src/app-runtime*`.
- `@netlify/functions` only under `netlify/functions/`, never `src/`.
- No circular imports.

The composition roots are `src/app-runtime.ts`, the handler files under `netlify/functions/`, and test harnesses. They are the only places that wire inbound and outbound adapters together.

### Classes and contract files

- Domain aggregates/value objects, use cases, projectors, application services and outbound adapters are classes (`CurriculumPack`, `GameSession`, `InstructorAccount`, `*UseCase`, `Mongo*Repository`, `InMemory*Repository`, `Hmac*TokenAdapter`, `AppRuntime`, ...).
- The HTTP side is **not** class-based: route handlers are factory functions (`create<Route>Handler(deps?)`) and middlewares are functions returning middy `MiddlewareObj`s.
- Keep `interface`/`type` contracts in their own files in domain, application and outbound: `*.types.ts`, `application/ports/*.port.ts`, `application/dtos/*.dto.ts`, `adapters/outbound/*.types.ts`. Known exceptions: middleware option types live in the middleware file (`auth.middleware.ts`), and some handlers declare their `*HandlerDependencies` interface inline.

## 2. Domain and application

- **Aggregates**: `GameSession` (participants, rounds, chains, verdicts, assessments, survey, phase state machine, pinned `packVersion`), `CurriculumPack` (identified by `PackId` + `version`; system/archived flags, `createdBy`), `InstructorAccount` (email, password hash, sign-in lock).
- Domain code returns values or throws `DomainError` subclasses (`src/domain/errors/domain-errors.ts`), never HTTP status codes.
- **Outbound ports** (`src/application/ports/`): `CurriculumPackRepositoryPort`, `GameSessionRepositoryPort`, `InstructorAccountRepositoryPort`, `CapabilityTokenPort` / `CapabilityTokenSignerPort`, `AccountTokenSignerPort` / `AccountTokenVerifierPort`, `PasswordHasherPort`, `ClockPort`, `WriteConflictBackoffPort`, `IdGeneratorPort`, `SeededRandomPort` / `BoardSeedGeneratorPort`, `LoggerPort`. There is no narrative-adjudicator or event-publisher port.
- **Role-aware projection**: `curriculum-pack-projector.ts` and `public-session-state-projector.ts` strip answers (`correctIndex`, `explanation`) and private state unless the caller's token allows it. Never mutate the aggregate to hide fields.
- **Pack Version pinning** (ADR-0007): sessions store `packVersion`; `SessionPackLoader` loads the pinned version and falls back to the latest one for old sessions.

## 3. HTTP: one Netlify function per route, one shared middy chain

### Routing

- Every route has its own Netlify Functions v2 file at `netlify/functions/<route>.ts`. It re-exports `lambdaHandler` and `create<Route>Handler` from `packs/`, `sessions/` or `accounts/`, declares `export const config: Config = { path, method }` once, and ends with `export default wrapLambdaHandler(lambdaHandler, config);`.
- **Route parameters** come from one place: `wrapLambdaHandler` matches the request URL against `config.path` with `path-to-regexp` and fills `event.pathParameters`; `context.params` is only a cross-check and fallback. This matters because `netlify dev` retries any 403 or 404 response as `<path>.html`, `<path>.htm`, `<path>/index.html` and `<path>/index.htm`, and the retry reaches the same function with empty or suffixed `context.params` (api-hardening 03). The wrapper strips those suffixes from `/api/` paths, so a retry gets the same parameters and the same answer.
- **No route depends on a `netlify.toml` redirect.** Every `/api/v1` route (packs, sessions, accounts) routes only by its own `config.path` + `method`. A forced `[[redirects]]` entry matches every method and sends all of them to one function, so it broke shared paths twice: the pack redirects were removed in teacher-login ticket 05 (`8a1e968`), the chains-path one in list-round-chains ticket 01 (`def5537`), and the remaining session and account redirects in api-completion ticket 10. `tests/adapters/netlify-toml-redirects.test.ts` fails if an `/api/v1` redirect is added back, and checks that no two route files declare the same method + path. Literal segments and parameters coexist (`POST /api/v1/sessions/join` vs `GET /api/v1/sessions/:sessionId`), and so do two methods on one path (`GET`/`POST /api/v1/packs`, `GET`/`POST .../rounds/:roundNumber/chains`). An undocumented path or method, such as `/api/v1/packs/register`, gets 404 or 405 from Netlify.
- `docs/api/openapi.yaml` is the contract that clients and the `claudPoc` drift tests check against. Keep it in step by hand when you add or change a route.

### Handler shape

Each implementation file (`netlify/functions/<area>/<route>.ts`) follows the same pattern:

1. `create<Route>Handler(dependencies?)` merges `AppRuntime.getProductionDependencies()` with the overrides (or uses the overrides as they are), and builds the use case from those ports.
2. A `rawHandler(event: AuthenticatedEvent)` reads `event.pathParameters`, `event.queryStringParameters`, the already-parsed `event.body`, and `event.auth` (Capability Token) or `event.account` (Account Token). It calls the use case and returns an `APIGatewayProxyResult`.
3. It returns `createApiHandler(rawHandler, authOptions)`.
4. The file ends with `export const lambdaHandler = create<Route>Handler();`. The route file (`netlify/functions/<route>.ts`) wraps it with `wrapLambdaHandler(lambdaHandler, config)`, which turns the Netlify v2 `Request` into a Lambda-style event (route parameters matched from the URL against `config.path`) and turns the result back into a `Response`.

### `createApiHandler` (`src/adapters/inbound/http/middy/api-handler.ts`)

Every `/api/v1` route uses this one middy chain. `before` steps run in this order; `onError` steps run in reverse:

1. **`authMiddleware`** (`auth.middleware.ts`): checks `x-api-key` with a timing-safe compare when `apiKey` / `requireApiKey` is set. Then it checks the bearer token for the route's `bearerScheme`:
   - `BearerAuth` (the default) takes a **Capability Token** and sets `event.auth`;
   - `AccountAuth` takes an **Account Token** and sets `event.account`;
   - `none` (sign-up, sign-in) ignores the `Authorization` header.

   A token that is present but malformed, invalid, expired or of the wrong kind is a 401 (fail closed). With `tokenRequired: true`, a missing token is a 401 **before the body is read**.
2. **`requestSizeLimitMiddleware`** (`request-size-limit.middleware.ts`): a raw body over 256 KB (`MAX_REQUEST_BODY_BYTES`, counted in bytes, not characters) is a 413 `PAYLOAD_TOO_LARGE`, before anything parses it. Auth runs first, so a caller without a required token still gets 401.
3. **`jsonObjectBodyMiddleware`**: `@middy/http-json-body-parser`, then "must be a JSON object". Malformed JSON, a missing JSON content type, or an array/string/number/null body is a 400 `INVALID_REQUEST_BODY`. An empty body is left as `undefined`.
4. **`domainErrorMiddleware`** (onError): maps each `DomainError` subclass to its status (400/401/403/404/409/413/422/423) with body `{ code, message, details? }` (`ApiErrorResponse`). **When you add a new `DomainError`, add it here**, or it falls through to 500.
5. **`unexpectedErrorMiddleware`** (onError, last): any other error is a 500 `{ code: "INTERNAL_ERROR", message: "An unexpected error occurred." }`. The stack is only logged, never sent.

### Two token kinds (ADR-0007)

- **Capability Token**: per Game Session (`role`, `sessionId`, `participantId`). Issued by create/join session. Used for everything inside a running game.
- **Account Token**: an Instructor Account, valid 12 hours. Issued by sign-up/sign-in. Needed to start a classroom or study Game Session and for every pack write (validate, register, archive, unarchive).
- Both are HS256 JWTs signed with `jose` (`HmacCapabilityTokenAdapter`, `HmacAccountTokenAdapter`). They use separate secrets (`CAPABILITY_TOKEN_SECRET`, `ACCOUNT_TOKEN_SECRET`) and carry a `kind` claim (`src/adapters/outbound/token-kinds.ts`), so one kind is never accepted as the other. Without a secret, `AppRuntime` falls back to in-memory fake token adapters (local development only).

## 4. Composition root and persistence

- `AppRuntime` (`src/app-runtime.ts`) is a static class:
  - `loadEnvConfig` reads env vars, falling back to `.env.dev.yaml` through `EnvYamlConfigLoader`: `MONGODB_URI`, `MONGODB_DB_NAME`, `CAPABILITY_TOKEN_SECRET`, `ACCOUNT_TOKEN_SECRET`, `API_KEY`, `LOG_LEVEL` (`logging.level`), `LOG_PRETTY` (`logging.pretty`);
  - `buildProductionDependencies` wires the Mongo repositories, token adapters, clock, write-conflict backoff (`TimerWriteConflictBackoff`), seed/random, argon2 hasher, id generator and `PinoLogger` (`buildLogger`);
  - `getProductionDependencies` caches that wiring per warm container;
  - `setProductionDependencies` lets tests swap it.
- Many `ProductionDependencies` fields are optional, and handlers force them with `!`. A missing dependency therefore fails at runtime, not at compile time (environment backlog, 2026-11-19).
- MongoDB goes through mongoose (`*.schema.ts`), with `MongoConnectionManager` in `mongo-client-singleton.ts` caching the connection.
- Game Sessions use optimistic concurrency: a `version` field, and a conditional update on `{ _id, version }` that stores `version + 1`. A conflict throws `ConcurrentUpdateConflictError`, which `GameSessionUpdateRetrier` retries up to `MAX_ATTEMPTS` (10) attempts in total, waiting an exponential, fully jittered backoff (base 20 ms, cap 500 ms) through `WriteConflictBackoffPort` before each retry. Handlers built with test dependencies and no backoff retry at once; tests inject `FakeWriteConflictBackoff`.
- Pack versions are stored under `_id` `<packId>@<version>`; the latest version is picked with `semver`.
- `netlify.toml`: functions directory `netlify/functions`, esbuild, `external_node_modules = ["mongoose", "mongodb", "@node-rs/argon2"]`; `[dev]` port 8888.

## 5. How to add a route

1. **Domain**: add the behaviour to the aggregate. Add any new error as a `DomainError` subclass in `domain-errors.ts`.
2. **Application**: add the command/result contract in `src/application/ports/<name>.port.ts`, and the use case class in `src/application/use-cases/<name>.use-case.ts`. It depends only on ports.
3. **Outbound**: if the use case needs a new port method, implement it in **both** the Mongo and the in-memory adapter, and extend the matching repository contract suite in `tests/adapters/`.
4. **Handler**: create `netlify/functions/<area>/<route>.ts` following the handler shape above. Choose `bearerScheme` (`BearerAuth` / `AccountAuth` / `none`) and set `tokenRequired: true` if the route must refuse anonymous callers.
5. **Entrypoint**: create `netlify/functions/<route>.ts` that re-exports `lambdaHandler` and `create<Route>Handler`, declares `config = { path, method }`, and ends with `export default wrapLambdaHandler(lambdaHandler, config);` (a test checks every route file does this). **Do not add a `netlify.toml` redirect** (a test refuses any `/api/v1` redirect).
6. **Errors**: map any new `DomainError` in `domainErrorMiddleware`.
7. **Contract**: add the operation, schemas and error codes to `docs/api/openapi.yaml`.
8. **Wiring**: if you add a new adapter, wire it in `AppRuntime.buildProductionDependencies` (and its type in `app-runtime.types.ts`).
9. **Tests**: write handler tests and, if the feature is user-visible, a BDD scenario (see below). Run `npx eslint --fix` on the files you changed.

## 6. Test seams

- **Handler tests** (`tests/functions/*.test.ts`, vitest): import `create<Route>Handler` from `netlify/functions/<area>/<route>.js`, pass in-memory repositories and token adapters, and call `handler(event, {})` with a Lambda-style event (`pathParameters`, `headers`, `body` as a string). They need no network and no Netlify CLI. `tests/functions/support/signed-in-teacher.ts` gives you an Account Token. `tests/middy-middlewares.test.ts` and `tests/functions/bad-request-body.test.ts` cover the shared chain.
- **Repository contract suites** (`tests/adapters/*.contract.test.ts`): one suite runs against both the in-memory and the Mongo adapter (in-memory MongoDB via `tests/integration/support/mongo-test-server.ts`). They cover curriculum packs, game sessions and instructor accounts.
- **Domain tests** (`tests/domain/`): pure aggregate behaviour.
- **BDD** (`tests/integration/features/*.feature`, cucumber): real HTTP against a running dev server (`http://localhost:8888`, or `NETLIFY_DEV_URL`).

## 7. Commands

- `npm run dev:local`: Netlify dev with an in-memory MongoDB. **Wait for the line `DEV READY http://localhost:8888`** before sending requests or running BDD; port 8888 can answer 404 before the functions have loaded. Everything the server and functions print also goes to `.netlify/dev-local.log` (emptied at each start). Every route passes `AppRuntime.invocationOptions` to `wrapLambdaHandler`: under `netlify dev` each invocation runs in a worker thread that netlify-cli never terminates, so the Mongo connections are closed after each invocation to let it exit (otherwise every request leaked a thread and its connections until the server stalled).
- `npm run test:bdd`: runs the features one at a time, each in its own cucumber process, against the running dev server. It waits up to 60s for the server, checks `GET /api/health` before each feature (stopping the run if it fails), and kills a feature that runs past 5 minutes (`BDD_FEATURE_TIMEOUT_MS`), pointing at `.netlify/dev-local.log`. Run a single feature with `npm run test:bdd -- tests/integration/features/<name>.feature`. `npm run test:bdd:mongodb` is the same with `BDD_USE_MONGODB=true`.
- `npm run dev:prototype`: the same server with the x-api-key check off (`DEV_DISABLE_API_KEY=true`, honoured by `AppRuntime.loadEnvConfig` only when `NETLIFY_DEV=true`). It serves the Concept Chain prototype from the repo root on the same origin: http://localhost:8888/claudPoc/concept-chain/login.html. Its pages call the account and pack routes and never hold the API key. Don't run BDD against it; stop it with `npm run dev:local:stop`.
- `npm run dev:local:stop`: stops the whole dev process tree and checks that port 8888 is free. Always run it when you are done; `pkill -f "netlify dev"` leaves processes behind.
- `npx vitest run --no-file-parallelism`: unit, handler and contract tests, one file at a time (parallel runs have exhausted memory on dev machines).
- `npm run typecheck`, `npm run lint` (baseline ≤ 29 errors; ESLint `no-console` is an error in `src/**` and `netlify/**`), `npm run lint:boundaries` (baseline ≤ 6).

## 8. Logging

See `.scratch/structured-logging/spec.md` and the research note `.scratch/research/netlify-logging-and-log-services.md`.

### Port and adapters

- **`LoggerPort`** (`src/application/ports/logger.port.ts`): outbound port with `debug`, `info`, `warn` and `error` taking `(fields: LogFields, msg: string)`, plus `child(fields)` returning a logger that attaches those fields to every line. Domain code (`src/domain/`) never imports a logger; application use cases and services depend only on `LoggerPort`.
- **`PinoLogger`** (`src/adapters/outbound/pino-logger.ts`): production adapter backed by `pino`, writing one JSON object per line synchronously to stdout (`pino.destination({ dest: 1, sync: true })`), with no worker-thread transports. Every line carries `level` (as a string label: `"debug"`, `"info"`, `"warn"`, `"error"`), `time`, `msg`, and `service: "diabe-teach-api"` (`pid` and `hostname` are omitted). Under `NETLIFY_DEV=true` with pretty mode enabled, it loads `pino-pretty` dynamically via `createRequire` as an in-process synchronous stream (`pretty({ sync: true, colorize })`) and falls back to JSON if `pino-pretty` is absent.
- **`SilentLogger`** (`src/application/services/silent-logger.ts`): no-op implementation used as the default in `wrapLambdaHandler`, middlewares, use cases and application services so existing unit and handler tests require no logger setup.
- **`requestLoggerOf(event)`** (`src/adapters/inbound/http/request-logger.ts`): reads the per-invocation child logger from `event.logger` (falling back to `SilentLogger` when a handler is called directly in tests) so route handlers can pass it into use cases and services.

### Request correlation and summary line

- `wrapLambdaHandler(handler, config, AppRuntime.invocationOptions)` creates one child logger per invocation with `{ requestId: context.requestId, route: config.path, method: request.method }` and attaches it to `event.logger`. Every log line written during the request carries those three fields.
- When the invocation finishes, `wrapLambdaHandler` logs one `"request completed"` summary line with `{ status, durationMs }` and, when `domainErrorMiddleware` mapped a `DomainError`, `{ errorCode }`.
- Status `>= 500` logs `"request completed"` at `error` (alongside `unexpectedErrorMiddleware`'s `"unhandled error in API handler"` line with `{ err }` class, message and stack); `2xx` and `4xx` responses log `"request completed"` at `info` because a `4xx` is an expected domain/auth refusal, not a server incident.

### Environment variables and defaults

| Variable | YAML key (`.env.dev.yaml`) | Allowed values | Defaults | Notes |
|---|---|---|---|---|
| `LOG_LEVEL` | `logging.level` | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent` | Deployed: `info`<br>`netlify dev` (`NETLIFY_DEV=true`): `debug`<br>Vitest (`tests/support/vitest-setup.ts`) & BDD runner (`scripts/run-bdd-sequential.ts`): `silent` | Env var wins over `.env.dev.yaml`. Any unknown value falls back to `info` and writes one `warn` line (`"LOG_LEVEL is not a known level; using info"` with `{ invalidLogLevel, logLevel: "info" }`). `netlify.toml` sets no `LOG_LEVEL`, keeping the deployed default at `info`. |
| `LOG_PRETTY` | `logging.pretty` | `true`, `false` | `netlify dev` (`NETLIFY_DEV=true`): `true`<br>Everywhere else: `false` | Guarded by `NETLIFY_DEV === "true"` (same pattern as `DEV_DISABLE_API_KEY`). Outside `netlify dev`, `LOG_PRETTY` and `logging.pretty` are ignored so deployed functions always emit single-line JSON. Use `LOG_PRETTY=false npm run dev:local` to emit raw JSON locally, or `LOG_LEVEL=silent npm run dev:local` for quiet server logs during BDD runs. |

### Never-log rule and redaction safety net

- **Call-site rule:** log identifiers (`sessionId`, `packId`, `accountId`, `participantId`, `chainId`, `roundNumber`) and outcomes (`status`, `errorCode`, `durationMs`, `mode`, `from`, `to`, `approved`, `decision`) only. **Never** pass `event`, `headers`, request or response `body`, whole domain objects, Capability Tokens, Account Tokens, `Authorization` headers, passwords, password hashes, teacher emails, learner display names, chain narratives, or MongoDB connection strings.
- **Pino `redact` backstop:** `PinoLogger` configures `redact: { paths: REDACT_PATHS, remove: true }` across 11 sensitive key names (`authorization`, `token`, `accountToken`, `instructorToken`, `participantToken`, `password`, `passwordHash`, `email`, `body`, `mongodbUri`, `uri`) at depths 0, 1 and 2 (`key`, `*.key`, `*.*.key` — 33 paths total, including `headers.authorization` and `req.headers.authorization`). This is a safety net for accidental nesting up to two objects deep, not permission to log raw objects.
- **MongoDB credential stripping:** `MongoCredentialStripper.strip(text)` (`src/adapters/outbound/mongo-credential-stripper.ts`) replaces `mongodb(+srv)://<userinfo>@` with `mongodb(+srv)://<redacted>@` in error messages and stacks inside `PinoLogger`'s `err` serializer before any error is written.

### Event catalogue (Ticket 06)

Every line below is emitted through the request's child logger, so it also carries `service`, `requestId`, `route` and `method`:

**`info` — business events and request summary**

| Area | `msg` | Fields |
|---|---|---|
| HTTP wrapper | `"request completed"` | `status`, `durationMs`, optional `errorCode` (`5xx` logs at `error`) |
| Accounts | `"instructor signed up"` | `accountId` |
| Accounts | `"instructor signed in"` | `accountId` |
| Accounts | `"sign-in wrong password"` | `accountId`, `failedCount` |
| Accounts | `"instructor account locked"` | `accountId`, `lockedUntil` |
| Packs | `"pack registered"` | `packId`, `version`, `accountId` |
| Packs | `"pack archived"` / `"pack unarchived"` | `packId`, `accountId` |
| Sessions | `"session created"` | `sessionId`, `mode`, `packId`, `packVersion` |
| Sessions | `"learner joined"` / `"learner left"` | `sessionId`, `participantId` |
| Sessions | `"session phase changed"` | `sessionId`, `from`, `to` |
| Sessions | `"session phase extended"` | `sessionId`, `phase`, `newEndsAt` |
| Sessions | `"session ended"` | `sessionId`, `fromPhase` |
| Chains | `"chain submitted"` | `sessionId`, `roundNumber`, `chainId`, `length` |
| Chains | `"chain peer vote"` | `sessionId`, `chainId`, `decision` |
| Chains | `"chain instructor ruling"` | `sessionId`, `chainId`, `approved` |
| Assessments | `"assessment submitted"` | `sessionId`, `participantId`, `stage` |
| Survey | `"survey submitted"` | `sessionId`, `participantId` |

**`debug` — diagnostics (on in `netlify dev`, off by default when deployed)**

| Area | `msg` | Fields |
|---|---|---|
| Board deal | `"board dealt"` | `sessionId`, `roundNumber`, `seed`, `rows`, `cols` |
| Concurrency | `"session write conflict; retrying"` | `sessionId`, `attempt`, `delayMs` |
| Pack loader | `"session pack loaded"` | `packId`, `packVersion`, `fellBackToLatest` |
| Pack validator | `"pack validated"` | `packId`, `errorCount` |
| Request schema | `"request body rejected"` | `field`, `reason` |
| Chain visibility | `"chain visibility applied"` | `sessionId`, `roundNumber`, `viewer`, `count` |
| Mongo lifecycle | `"mongo connection opened"` / `"mongo connection reused"` / `"mongo connection closed"` | `dbName` (never the URI) |

**`warn` — recoverable anomalies and suspicious refusals**

| Area | `msg` | Fields |
|---|---|---|
| Auth middleware | `"bearer token refused"` | `scheme`, `claimedKind` (cross-kind token attempt) |
| Accounts | `"sign-in refused: account locked"` | `accountId`, `lockedUntil` |
| URL vs params | `"route parameters from URL and context.params disagree; using the URL"` | `pathname` |
| Config | `"LOG_LEVEL is not a known level; using info"` | `invalidLogLevel`, `logLevel` |

### Querying JSON logs with `netlify logs` and `jq`

Locally with `LOG_PRETTY=false npm run dev:local` (reading `.netlify/dev-local.log`) or against a deployed site with `netlify logs --json`:

```bash
# Follow all lines for one request ID
netlify logs --json | jq -c 'select(.requestId == "01M7Y2KMQKYKSZEDNWNZEE0P5Z")'

# Filter refused requests by domain errorCode
netlify logs --json | jq -c 'select(.errorCode == "PACK_IS_SYSTEM_PACK")'

# Filter by log level (warn and error only)
netlify logs --json | jq -c 'select(.level == "warn" or .level == "error")'
```

## 9. Manual Testing & Interactive API Documentation (Bruno)

A Git-tracked **Bruno** collection lives under `docs/api/bruno/` (with standalone interactive HTML documentation generated at `docs/api/api-docs.html`):

- **Collection structure (`docs/api/bruno/`):**
  - `bruno.json` and `collection.bru` (sets shared `x-api-key: {{apiKey}}` and `Accept: application/json` headers and overview docs).
  - `environments/Local Dev.bru` (`baseUrl: http://localhost:8888`, `apiKey: dev-local-api-key`) and `environments/Netlify Production.bru` (`baseUrl: https://diabe-teach.netlify.app` with sensitive keys in `vars:secret`).
  - Numbered domain folders `01-Health` through `06-Assessments-Survey-and-Lifecycle` covering all 21 implemented endpoints (`GET /api/health` + all 20 `/api/v1/*` routes).
  - `script:post-response` hooks automatically save `accountToken`, `accountId`, `sessionId`, `roomCode`, `instructorToken`, `participantId`, `participantToken`, and `chainId` into environment variables so requests chain top-to-bottom without copy-pasting.
- **Generating standalone HTML documentation:**
  ```bash
  npm run generate:api-docs
  ```
  Runs `bru docs generate --all-envs --output docs/api/api-docs.html` (`scripts/generate-bruno-api-docs.ts`) to produce the single-file interactive Bruno API Docs playground.
- **Drift & schema guard (`tests/bruno-collection-drift.test.ts`):**
  - Parses every `.bru` file via `@usebruno/lang`, asserts a 1-to-1 match with `netlify/functions/*.ts` and `docs/api/openapi.yaml`, validates every JSON request body against `src/adapters/inbound/http/request-schemas.generated.ts`, and checks that `docs/api/api-docs.html` is up to date. When adding or changing a route, update `docs/api/bruno/` and re-run `npm run generate:api-docs`.


