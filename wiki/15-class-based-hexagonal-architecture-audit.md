# 15 — Class-Based Hexagonal Architecture Audit: Replacing Procedural Functions with Cohesive Classes

## Research Question

> *"All code is written in a function manner that is making it hard to read so many functions. Can we make it into classes so it becomes easy to read? Also `runtime.config.ts` is hidden."*

---

## 1. Full Codebase Audit: Which Files Are Already Classes vs. Procedural Functions?

We audited all 19 TypeScript files across `src/` and `netlify/`:

### A. Rings That Are Already Clean Classes (`src/domain/`, `src/application/`, and most of `src/adapters/outbound/`)

| File | Current Construct | Status |
| :--- | :--- | :--- |
| [`src/domain/curriculum-pack/pack-id.ts`](../src/domain/curriculum-pack/pack-id.ts) | `export class PackId` | Already a class ( note: has 2 module-level helper functions in `curriculum-pack.ts` that should be private static methods on `CurriculumPack` ) |
| [`src/domain/curriculum-pack/curriculum-pack.ts`](../src/domain/curriculum-pack/curriculum-pack.ts) | `export class CurriculumPack` | Class, with 2 loose top-level functions (`normalizeLookupKey`, `deepFreeze`) that can move inside `CurriculumPack` as `static #normalizeLookupKey` and `static #deepFreeze` |
| [`src/domain/errors/domain-errors.ts`](../src/domain/errors/domain-errors.ts) | `DomainError`, `PackNotFoundError`, `UnauthorizedTokenError` | Already classes |
| [`src/application/use-cases/get-curriculum-pack-by-id.use-case.ts`](../src/application/use-cases/get-curriculum-pack-by-id.use-case.ts) | `export class GetCurriculumPackByIdUseCase` | Already a class |
| [`src/application/dtos/curriculum-pack-projector.ts`](../src/application/dtos/curriculum-pack-projector.ts) | `export class CurriculumPackProjector` | Already a class |
| [`src/adapters/outbound/mongo-curriculum-pack-repository.ts`](../src/adapters/outbound/mongo-curriculum-pack-repository.ts) | `export class MongoCurriculumPackRepository` | Already a class |
| [`src/adapters/outbound/in-memory-curriculum-pack-repository.ts`](../src/adapters/outbound/in-memory-curriculum-pack-repository.ts) | `export class InMemoryCurriculumPackRepository` | Already a class |
| [`src/adapters/outbound/hmac-capability-token-adapter.ts`](../src/adapters/outbound/hmac-capability-token-adapter.ts) | `export class HmacCapabilityTokenAdapter` | Already a class |
| [`src/adapters/outbound/fake-capability-token-adapter.ts`](../src/adapters/outbound/fake-capability-token-adapter.ts) | `export class FakeCapabilityTokenAdapter` | Already a class |

---

### B. The 5 Procedural / Multi-Function Files Causing Readability Friction

Every single file in **`src/config/`** and **`src/adapters/inbound/http/`** (plus `mongo-client-singleton.ts` in `src/adapters/outbound/`) is currently written as loose functions and closures rather than classes:

| File | Current Loose Functions & Module-Global State | Why It Hurts Readability |
| :--- | :--- | :--- |
| 1. [`src/config/runtime.config.ts`](../src/config/runtime.config.ts) | `let cachedProductionDependencies` + 5 functions: `loadRuntimeEnvConfig()`, `buildProductionDependencies()`, `getProductionDependencies()`, `createServerlessHttpHandler()`, `defineServerlessRouteConfig()` | Hides mutable singleton state (`cachedProductionDependencies`) at module scope; forces the reader to trace 5 separate functions to see how the app boots; and `src/config/runtime.config.ts` is tucked inside a subfolder instead of a clear class. |
| 2. [`src/adapters/inbound/http/create-app.ts`](../src/adapters/inbound/http/create-app.ts) | `createApp(deps)` factory function returning an anonymous `{ fetch(request, context) }` closure | Mixes OpenAPI initialization, security handler callbacks, route registration, and request dispatching inside one 75-line closure instead of an `OpenApiHttpApp` class with named methods. |
| 3. [`src/adapters/inbound/http/get-pack-by-id.handler.ts`](../src/adapters/inbound/http/get-pack-by-id.handler.ts) | 3 functions: `resolvePackIdFromContext()`, `transformGetPackByIdRequest()`, `createGetPackByIdHandler()` | Uses higher-order function composition (`createEndpointHandler({ transformRequest, execute })`) instead of an intuitive `GetPackByIdHttpHandler` class. |
| 4. [`src/adapters/inbound/http/endpoint-handler.factory.ts`](../src/adapters/inbound/http/endpoint-handler.factory.ts) | 5 functions: `jsonResponse()`, `verifyApiKeyHeader()`, `parseBearerTokenHeader()`, `mapDomainErrorToResponse()`, `createEndpointHandler()` | A grab-bag of 5 unrelated free functions (JSON formatting, `x-api-key` crypto check, Bearer regex parsing, DomainError status mapping, and closure wrapping). |
| 5. [`src/adapters/outbound/mongo-client-singleton.ts`](../src/adapters/outbound/mongo-client-singleton.ts) | `const cachedClientsByUri = new Map()` + `getMongoDatabase(uri, dbName)` | Uses module-scoped global Map state instead of an encapsulated `MongoDatabaseClient` / `MongoConnectionManager` class. |

---

## 2. Primary Source Grounding: Why Classes Improve Readability in Hexagonal DDD

1. **Alistair Cockburn (*Hexagonal Architecture*) & Vaughn Vernon (*Implementing Domain-Driven Design*, Ch. 4 & 14)**:
   - In Ports & Adapters, every **Port** is a TypeScript `interface` (`*Port`, `HttpApp`) and every **Adapter** is a concrete **`class`** implementing that interface (`class OpenApiHttpApp implements HttpApp`, `class GetPackByIdHttpHandler`, `class MongoCurriculumPackRepository implements CurriculumPackRepositoryPort`).
   - When Domain, Application, and Outbound Adapters are classes (`CurriculumPack`, `GetCurriculumPackByIdUseCase`, `MongoCurriculumPackRepository`), writing Inbound HTTP Adapters and Configuration as loose factory functions creates a **paradigm mismatch** mid-request.
2. **Template Method Pattern for Inbound HTTP Handlers (GoF / Clean Architecture)**:
   - Instead of passing callbacks into a higher-order function `createEndpointHandler({ transformRequest, execute })`, an abstract **`BaseHttpHandler<TQuery, TResult>`** class defines the `public async handle(request, context): Promise<Response>` template method and lets each endpoint class (`export class GetPackByIdHttpHandler extends BaseHttpHandler<GetCurriculumPackByIdQuery, GetCurriculumPackByIdResult>`) implement `public transformRequest(...)` and `protected execute(...)` as clean class methods.
3. **Mark Seemann (*Dependency Injection Principles, Practices, and Patterns*) — Object-Oriented Composition Root**:
   - Replacing the 5 loose functions in `runtime.config.ts` with a single **`ApplicationRuntime`** (or **`RuntimeConfig`**) class encapsulates environment parsing, cached dependency assembly, and serverless handler creation in one cohesive class with explicit methods (`RuntimeConfig.fromEnv()`, `runtime.createDependencies()`, `runtime.handleRequest(request, context)`).

---

## 3. Proposed Class-Based Design Across Every Layer

| Current Procedural File | Proposed Class Name | Responsibility & Public Methods |
| :--- | :--- | :--- |
| `src/config/runtime.config.ts` | **`RuntimeConfig`** (or moved to a top-level visible location if desired) | Encapsulates env config and dependency wiring:<br>• `RuntimeConfig.fromEnv(env?)`<br>• `buildDependencies()` / `getDependencies()`<br>• `createHttpHandler()` / `defineRouteConfig(route)` |
| `src/adapters/inbound/http/create-app.ts` | **`OpenApiHttpApp implements HttpApp`** | Wraps `OpenAPIBackend` in a clean class:<br>• `constructor(deps: AppDependencies)`<br>• `public async fetch(request: Request, context?: RouteContext): Promise<Response>` |
| `src/adapters/inbound/http/endpoint-handler.factory.ts` | **`BaseHttpHandler<TQuery, TResult>`** (abstract base class) + **`HttpSecurityAndResponse`** (or static methods on `BaseHttpHandler`) | Replaces the 5 loose functions with:<br>• `public async handle(request, context): Promise<Response>`<br>• `public abstract transformRequest(input): TQuery`<br>• `protected abstract execute(query): Promise<TResult>`<br>• `BaseHttpHandler.verifyApiKeyHeader(...)`, `BaseHttpHandler.parseBearerTokenHeader(...)`, `BaseHttpHandler.jsonResponse(...)`, `BaseHttpHandler.mapDomainErrorToResponse(...)` |
| `src/adapters/inbound/http/get-pack-by-id.handler.ts` | **`GetPackByIdHttpHandler extends BaseHttpHandler<GetCurriculumPackByIdQuery, GetCurriculumPackByIdResult>`** | Clean endpoint controller class:<br>• `constructor(deps: GetPackByIdHandlerDependencies)`<br>• `public transformRequest(input: HttpRequestInput): GetCurriculumPackByIdQuery`<br>• `protected execute(query: GetCurriculumPackByIdQuery): Promise<GetCurriculumPackByIdResult>` |
| `src/adapters/outbound/mongo-client-singleton.ts` | **`MongoConnectionManager`** | Encapsulates the MongoClient connection pool cache:<br>• `public static getDatabase(uri: string, dbName?: string): Promise<Db>` |
| `src/domain/curriculum-pack/curriculum-pack.ts` | **`CurriculumPack`** | Moves loose top-level `normalizeLookupKey` and `deepFreeze` functions into `static #normalizeLookupKey` and `static #deepFreeze` inside `CurriculumPack`. |

---

## 4. Before vs. After Code Readability Comparison

### Before (5 loose functions in `runtime.config.ts` + closure factories in `get-pack-by-id.handler.ts`):
```ts
// Loose functions scattered across files:
export function transformGetPackByIdRequest({ request, context }: HttpRequestInput) { ... }
export function createGetPackByIdHandler(deps: GetPackByIdHandlerDependencies) {
  const useCase = new GetCurriculumPackByIdUseCase(deps);
  return createEndpointHandler({
    transformRequest: transformGetPackByIdRequest,
    execute: (query) => useCase.execute(query),
  });
}
```

### After (Every module in the codebase is a clean, predictable `class`):
```ts
export class GetPackByIdHttpHandler extends BaseHttpHandler<
  GetCurriculumPackByIdQuery,
  GetCurriculumPackByIdResult
> {
  readonly #useCase: GetCurriculumPackByIdUseCase;

  public constructor(deps: GetPackByIdHandlerDependencies) {
    super();
    this.#useCase = new GetCurriculumPackByIdUseCase(deps);
  }

  public transformRequest({
    request,
    context,
  }: HttpRequestInput): GetCurriculumPackByIdQuery {
    return {
      packId: this.#resolvePackIdFromContext(context),
      bearerToken: BaseHttpHandler.parseBearerTokenHeader(
        request.headers.get("authorization"),
      ),
    };
  }

  protected async execute(
    query: GetCurriculumPackByIdQuery,
  ): Promise<GetCurriculumPackByIdResult> {
    return this.#useCase.execute(query);
  }
}
```
