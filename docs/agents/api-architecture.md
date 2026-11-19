# API Architecture: Hexagonal DDD on Netlify Functions v2

How the backend is built **today**. Read this before designing, implementing or reviewing API routes, domain logic, ports/adapters or deployment.

Checked against the code at commit `b8ef47c` (2026-11-19; the last code change is `bcab708`, api-hardening 01). Source and tests win over this page: if they disagree, trust the code and fix this page.

Decision records: ADR-0001 (subject-agnostic packs), ADR-0002 (hexagonal layers, Netlify, MongoDB), ADR-0004 (fail-closed bearer tokens, JWT), ADR-0005 (npm-first, middy), ADR-0006 (pack lifecycle), ADR-0007 (Instructor Accounts, Account Token, Pack Version pinning). ADR-0002 and ADR-0004 also describe an `OpenApiHttpApp` router and a single `api.ts` entrypoint that commit `3c5f131` removed; see the "Superseded in part" note at the top of each.

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
└── adapters/
    ├── inbound/http/
    │   ├── middy/            createApiHandler (api-handler.ts) + its four middlewares
    │   ├── lambda-to-v2-wrapper.ts   wrapLambdaHandler: Netlify v2 Request <-> Lambda event/result
    │   └── json-object-body.ts       readJsonObjectBody / readOptionalJsonObjectBody
    └── outbound/             Mongo (mongoose) + in-memory repositories, token adapters,
                              clock, id/seed generators, argon2 hasher, YAML env loader
netlify/functions/
├── <route>.ts                One per route: re-exports the handler, declares `config` (path + method)
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
- **Outbound ports** (`src/application/ports/`): `CurriculumPackRepositoryPort`, `GameSessionRepositoryPort`, `InstructorAccountRepositoryPort`, `CapabilityTokenPort` / `CapabilityTokenSignerPort`, `AccountTokenSignerPort` / `AccountTokenVerifierPort`, `PasswordHasherPort`, `ClockPort`, `IdGeneratorPort`, `SeededRandomPort` / `BoardSeedGeneratorPort`. There is no narrative-adjudicator or event-publisher port.
- **Role-aware projection**: `curriculum-pack-projector.ts` and `public-session-state-projector.ts` strip answers (`correctIndex`, `explanation`) and private state unless the caller's token allows it. Never mutate the aggregate to hide fields.
- **Pack Version pinning** (ADR-0007): sessions store `packVersion`; `SessionPackLoader` loads the pinned version and falls back to the latest one for old sessions.

## 3. HTTP: one Netlify function per route, one shared middy chain

### Routing

- Every route has its own Netlify Functions v2 file at `netlify/functions/<route>.ts`. It re-exports `default`, `lambdaHandler` and `create<Route>Handler` from `packs/`, `sessions/` or `accounts/`, and declares `export const config: Config = { path, method }`.
- **Pack routes** (`/api/v1/packs`, `/packs/validate`, `/packs/:packId`, `/packs/:packId/archive`, `/packs/:packId/unarchive`) route only by their own `config.path` + `method`. `netlify.toml` has no pack redirects; they were removed in teacher-login ticket 05 (`8a1e968`) because a forced redirect sent every method to one function. An undocumented path such as `/api/v1/packs/register` gets 405.
- **Session routes** (`/api/v1/sessions...`) still also have forced `[[redirects]]` in `netlify.toml` to `/.netlify/functions/<name>`, even though each session function declares its own `config.path` + `method`. The **account routes** (`/api/v1/accounts/sign-up|sign-in|me`) are in the same state. A forced redirect matches every method, so do not add a second method on a redirected path until those redirects are removed (environment backlog, 2026-11-19).
- `docs/api/openapi.yaml` is the contract that clients and the `claudPoc` drift tests check against. Keep it in step by hand when you add or change a route.

### Handler shape

Each implementation file (`netlify/functions/<area>/<route>.ts`) follows the same pattern:

1. `create<Route>Handler(dependencies?)` merges `AppRuntime.getProductionDependencies()` with the overrides (or uses the overrides as they are), and builds the use case from those ports.
2. A `rawHandler(event: AuthenticatedEvent)` reads `event.pathParameters`, `event.queryStringParameters`, the already-parsed `event.body`, and `event.auth` (Capability Token) or `event.account` (Account Token). It calls the use case and returns an `APIGatewayProxyResult`.
3. It returns `createApiHandler(rawHandler, authOptions)`.
4. The file ends with `export const lambdaHandler = create<Route>Handler();` and `export default wrapLambdaHandler(lambdaHandler);`. `wrapLambdaHandler` turns the Netlify v2 `Request` + `context.params` into a Lambda-style event and turns the result back into a `Response`.

### `createApiHandler` (`src/adapters/inbound/http/middy/api-handler.ts`)

Every `/api/v1` route uses this one middy chain. `before` steps run in this order; `onError` steps run in reverse:

1. **`authMiddleware`** (`auth.middleware.ts`): checks `x-api-key` with a timing-safe compare when `apiKey` / `requireApiKey` is set. Then it checks the bearer token for the route's `bearerScheme`:
   - `BearerAuth` (the default) takes a **Capability Token** and sets `event.auth`;
   - `AccountAuth` takes an **Account Token** and sets `event.account`;
   - `none` (sign-up, sign-in) ignores the `Authorization` header.

   A token that is present but malformed, invalid, expired or of the wrong kind is a 401 (fail closed). With `tokenRequired: true`, a missing token is a 401 **before the body is read**.
2. **`jsonObjectBodyMiddleware`**: `@middy/http-json-body-parser`, then "must be a JSON object". Malformed JSON, a missing JSON content type, or an array/string/number/null body is a 400 `INVALID_REQUEST_BODY`. An empty body is left as `undefined`.
3. **`domainErrorMiddleware`** (onError): maps each `DomainError` subclass to its status (400/401/403/404/409/422/423) with body `{ code, message, details? }` (`ApiErrorResponse`). **When you add a new `DomainError`, add it here**, or it falls through to 500.
4. **`unexpectedErrorMiddleware`** (onError, last): any other error is a 500 `{ code: "INTERNAL_ERROR", message: "An unexpected error occurred." }`. The stack is only logged, never sent.

### Two token kinds (ADR-0007)

- **Capability Token**: per Game Session (`role`, `sessionId`, `participantId`). Issued by create/join session. Used for everything inside a running game.
- **Account Token**: an Instructor Account, valid 12 hours. Issued by sign-up/sign-in. Needed to start a classroom or study Game Session and for every pack write (validate, register, archive, unarchive).
- Both are HS256 JWTs signed with `jose` (`HmacCapabilityTokenAdapter`, `HmacAccountTokenAdapter`). They use separate secrets (`CAPABILITY_TOKEN_SECRET`, `ACCOUNT_TOKEN_SECRET`) and carry a `kind` claim (`src/adapters/outbound/token-kinds.ts`), so one kind is never accepted as the other. Without a secret, `AppRuntime` falls back to in-memory fake token adapters (local development only).

## 4. Composition root and persistence

- `AppRuntime` (`src/app-runtime.ts`) is a static class:
  - `loadEnvConfig` reads env vars, falling back to `.env.dev.yaml` through `EnvYamlConfigLoader`: `MONGODB_URI`, `MONGODB_DB_NAME`, `CAPABILITY_TOKEN_SECRET`, `ACCOUNT_TOKEN_SECRET`, `API_KEY`;
  - `buildProductionDependencies` wires the Mongo repositories, token adapters, clock, seed/random, argon2 hasher and id generator;
  - `getProductionDependencies` caches that wiring per warm container;
  - `setProductionDependencies` lets tests swap it.
- Many `ProductionDependencies` fields are optional, and handlers force them with `!`. A missing dependency therefore fails at runtime, not at compile time (environment backlog, 2026-11-19).
- MongoDB goes through mongoose (`*.schema.ts`), with `MongoConnectionManager` in `mongo-client-singleton.ts` caching the connection.
- Game Sessions use optimistic concurrency: a `version` field, and a conditional update on `{ _id, version }` that stores `version + 1`. A conflict throws `ConcurrentUpdateConflictError`, which `GameSessionUpdateRetrier` retries a bounded number of times.
- Pack versions are stored under `_id` `<packId>@<version>`; the latest version is picked with `semver`.
- `netlify.toml`: functions directory `netlify/functions`, esbuild, `external_node_modules = ["mongoose", "mongodb", "@node-rs/argon2"]`; `[dev]` port 8888.

## 5. How to add a route

1. **Domain**: add the behaviour to the aggregate. Add any new error as a `DomainError` subclass in `domain-errors.ts`.
2. **Application**: add the command/result contract in `src/application/ports/<name>.port.ts`, and the use case class in `src/application/use-cases/<name>.use-case.ts`. It depends only on ports.
3. **Outbound**: if the use case needs a new port method, implement it in **both** the Mongo and the in-memory adapter, and extend the matching repository contract suite in `tests/adapters/`.
4. **Handler**: create `netlify/functions/<area>/<route>.ts` following the handler shape above. Choose `bearerScheme` (`BearerAuth` / `AccountAuth` / `none`) and set `tokenRequired: true` if the route must refuse anonymous callers.
5. **Entrypoint**: create `netlify/functions/<route>.ts` that re-exports `default`, `lambdaHandler` and `create<Route>Handler` and declares `config = { path, method }`. **Do not add a `netlify.toml` redirect.** If the path is already behind a session/account redirect, remove that redirect first.
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

- `npm run dev:local`: Netlify dev with an in-memory MongoDB. **Wait for the line `DEV READY http://localhost:8888`** before sending requests or running BDD; port 8888 can answer 404 before the functions have loaded.
- `npm run test:bdd`: runs the features one at a time, each in its own cucumber process, against the running dev server. It waits up to 60s for the server. Run a single feature with `npm run test:bdd -- tests/integration/features/<name>.feature`. `npm run test:bdd:mongodb` is the same with `BDD_USE_MONGODB=true`.
- `npm run dev:prototype`: the same server with the x-api-key check off (`DEV_DISABLE_API_KEY=true`, honoured by `AppRuntime.loadEnvConfig` only when `NETLIFY_DEV=true`). It serves the Concept Chain prototype from the repo root on the same origin: http://localhost:8888/claudPoc/concept-chain/login.html. Its pages call the account and pack routes and never hold the API key. Don't run BDD against it; stop it with `npm run dev:local:stop`.
- `npm run dev:local:stop`: stops the whole dev process tree and checks that port 8888 is free. Always run it when you are done; `pkill -f "netlify dev"` leaves processes behind.
- `npx vitest run --no-file-parallelism`: unit, handler and contract tests, one file at a time (parallel runs have exhausted memory on dev machines).
- `npm run typecheck`, `npm run lint` (baseline 96 errors as of `484cbab`), `npm run lint:boundaries` (baseline 6).
