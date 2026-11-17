# Effect Library Evaluation for diabe-teach

**Date:** 2026-11-03
**Author:** Research Agent
**Status:** Evaluation Complete

---

## Executive Summary

**Recommendation: Do Not Adopt Effect at This Time**

While Effect offers powerful abstractions for typed errors, dependency injection, and composable pipelines, the current codebase patterns are well-established, reasonably simple, and working effectively. The benefits of Effect do not outweigh the costs of adoption for this project's scope and team context.

Key factors:
- Current DomainError hierarchy is explicit and maintainable
- Middy middleware provides adequate HTTP pipeline composition
- AppRuntime/ProductionDependencies pattern is lightweight and testable
- Effect's learning curve and bundle size are non-trivial tradeoffs
- The codebase is not suffering from the complexity problems Effect solves best

---

## 1. Current Codebase Patterns Analysis

### 1.1 Error Handling

**Location:** `/src/domain/errors/domain-errors.ts`

The codebase uses a class hierarchy with an abstract `DomainError` base class:

```typescript
// Current Pattern
export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public readonly details?: Readonly<Record<string, unknown>>;

  protected constructor(
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class PackNotFoundError extends DomainError {
  public readonly code = "PACK_NOT_FOUND" as const;

  public constructor(packId: string) {
    super(`Curriculum Pack '${packId}' was not found.`, { packId });
  }
}
```

**Middleware Error Mapping** (`/src/adapters/inbound/http/middy/domain-error.middleware.ts`):

```typescript
// Current Pattern - explicit instanceof checks for HTTP status mapping
if (error instanceof DomainError) {
  let statusCode = 500;
  if (error instanceof UnauthorizedTokenError) {
    statusCode = 401;
  }
  else if (error instanceof PackNotFoundError || ...) {
    statusCode = 404;
  }
  // ... more mappings
}
```

**Strengths:**
- Errors are explicit classes with typed `code` properties
- The `details` field provides structured context
- `instanceof` checks are clear and debuggable
- HTTP status mapping is centralized

**Weaknesses:**
- Error types are not tracked in function signatures
- Caller must remember which errors a use case can throw
- Long `instanceof` chains in middleware

### 1.2 Dependency Injection

**Location:** `/src/app-runtime.ts`, `/src/app-runtime.types.ts`

The codebase uses a simple factory pattern with explicit dependency interfaces:

```typescript
// Current Pattern
export interface ProductionDependencies {
  readonly packRepo: CurriculumPackRepositoryPort;
  readonly sessionRepo?: GameSessionRepositoryPort;
  readonly tokenSigner?: CapabilityTokenSignerPort;
  readonly tokenVerifier?: CapabilityTokenPort;
  readonly apiKey?: string;
  readonly requireApiKey?: boolean;
}

export class AppRuntime {
  static #cachedProductionDependencies: ProductionDependencies | null = null;

  public static buildProductionDependencies(
    env: NodeJS.ProcessEnv = process.env,
  ): ProductionDependencies {
    const config = AppRuntime.loadEnvConfig(env);
    const tokenAdapter = HmacCapabilityTokenAdapter.fromSecret(
      config.capabilityTokenSecret,
    ) ?? new FakeCapabilityTokenAdapter();

    return {
      packRepo: MongoCurriculumPackRepository.fromConfig(config),
      sessionRepo: new InMemoryGameSessionRepository(),
      tokenSigner: tokenAdapter,
      tokenVerifier: tokenAdapter,
      apiKey: config.apiKey,
      requireApiKey: Boolean(config.apiKey),
    };
  }
}
```

**Handler Factory Pattern** (`/netlify/functions/sessions/create-session.ts`):

```typescript
// Current Pattern - handlers accept optional dependencies for testing
export function createCreateSessionHandler(
  dependencies?: CreateSessionHandlerDependencies,
) {
  const deps = dependencies ?? AppRuntime.getProductionDependencies();
  const useCase = new CreateGameSessionUseCase({
    packRepo: deps.packRepo,
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenSigner,
  });
  // ...
}
```

**Strengths:**
- Simple and explicit - no magic
- Easy to understand and test
- Dependencies are typed interfaces (ports)
- Test doubles are trivially injected

**Weaknesses:**
- Manual wiring in each handler factory
- No automatic dependency graph resolution
- Repeated boilerplate across handlers

### 1.3 Async Operations / Use Cases

**Location:** `/src/application/use-cases/*.use-case.ts`

Use cases are classes implementing port interfaces with async `execute` methods:

```typescript
// Current Pattern
export class CreateGameSessionUseCase implements CreateGameSessionUseCasePort {
  readonly #packRepo: CurriculumPackRepositoryPort;
  readonly #sessionRepo: GameSessionRepositoryPort;
  readonly #tokenSigner: CapabilityTokenSignerPort;

  public constructor(deps: CreateGameSessionDependencies) {
    this.#packRepo = deps.packRepo;
    this.#sessionRepo = deps.sessionRepo;
    this.#tokenSigner = deps.tokenSigner;
  }

  public async execute(
    command: CreateGameSessionCommand,
  ): Promise<CreateGameSessionResult> {
    const packId = PackId.create(command.packId);
    const pack = await this.#packRepo.findById(packId);

    if (!pack) {
      throw new PackNotFoundError(command.packId);
    }
    // ... rest of business logic
  }
}
```

**Strengths:**
- Clear separation of concerns
- Standard async/await patterns
- Business logic is isolated and testable

**Weaknesses:**
- Errors thrown but not typed in signatures
- No built-in retry, timeout, or resource management
- Composition requires manual orchestration

### 1.4 HTTP Middleware

**Location:** `/src/adapters/inbound/http/middy/*.middleware.ts`

The codebase uses Middy (a popular AWS Lambda middleware framework):

```typescript
// Current Pattern
return middy(rawHandler)
  .use(
    authMiddleware({
      tokenVerifier: deps.tokenVerifier,
      apiKey: deps.apiKey,
      requireApiKey: deps.requireApiKey,
    }),
  )
  .use(domainErrorMiddleware());
```

**Strengths:**
- Well-established pattern in AWS Lambda ecosystem
- Composable middleware chain
- Good community support

**Weaknesses:**
- Middleware state passed via mutation (`request.event.auth = verified`)
- Error handling is separate from success path
- Limited type safety across middleware chain

---

## 2. Effect Library Capabilities

### 2.1 The Effect Type

Effect uses a three-parameter type `Effect<Success, Error, Requirements>` that makes all three concerns explicit in the type signature:

```typescript
// Effect Pattern
import { Effect } from "effect";

const getPackById = (
  packId: string
): Effect.Effect<CurriculumPack, PackNotFoundError, PackRepository> =>
  Effect.gen(function* () {
    const repo = yield* PackRepository;
    const pack = yield* repo.findById(packId);
    if (!pack) {
      return yield* Effect.fail(new PackNotFoundError(packId));
    }
    return pack;
  });
```

**Key insight:** The error type `PackNotFoundError` is now part of the function signature, enforced by the compiler.

### 2.2 Typed Error Handling with Tags

Effect errors use a `_tag` field for pattern matching:

```typescript
// Effect Pattern
class PackNotFoundError {
  readonly _tag = "PackNotFoundError";
  constructor(readonly packId: string) {}
}

class SessionNotFoundError {
  readonly _tag = "SessionNotFoundError";
  constructor(readonly sessionId: string) {}
}

// Type-safe error handling
const handleErrors = pipe(
  someEffect,
  Effect.catchTag("PackNotFoundError", (e) =>
    Effect.succeed({ status: 404, body: { code: e._tag, packId: e.packId } })
  ),
  Effect.catchTag("SessionNotFoundError", (e) =>
    Effect.succeed({ status: 404, body: { code: e._tag } })
  )
);
```

### 2.3 Dependency Injection with Layers and Services

Effect provides a built-in DI system using `Context.Tag` and `Layer`:

```typescript
// Effect Pattern - Service Definition
import { Context, Effect, Layer } from "effect";

class PackRepository extends Context.Tag("PackRepository")<
  PackRepository,
  {
    readonly findById: (id: string) => Effect.Effect<CurriculumPack | null>;
    readonly findAll: () => Effect.Effect<readonly CurriculumPack[]>;
  }
>() {}

// Layer implementation
const MongoPackRepositoryLive = Layer.succeed(
  PackRepository,
  {
    findById: (id) => Effect.promise(() => mongoCollection.findOne({ id })),
    findAll: () => Effect.promise(() => mongoCollection.find().toArray()),
  }
);

// Test implementation
const InMemoryPackRepositoryTest = Layer.succeed(
  PackRepository,
  {
    findById: (id) => Effect.succeed(testPacks.find(p => p.id === id) ?? null),
    findAll: () => Effect.succeed(testPacks),
  }
);

// Usage - dependencies are satisfied by providing layers
const program = Effect.gen(function* () {
  const repo = yield* PackRepository;
  return yield* repo.findAll();
});

// Production
Effect.runPromise(program.pipe(Effect.provide(MongoPackRepositoryLive)));

// Testing
Effect.runPromise(program.pipe(Effect.provide(InMemoryPackRepositoryTest)));
```

### 2.4 Composable Pipelines

Effect uses `pipe` and generator syntax for composition:

```typescript
// Effect Pattern - Pipeline composition
const createSession = Effect.gen(function* () {
  const packRepo = yield* PackRepository;
  const sessionRepo = yield* SessionRepository;
  const tokenSigner = yield* TokenSigner;

  const pack = yield* packRepo.findById(command.packId);
  if (!pack) {
    return yield* Effect.fail(new PackNotFoundError(command.packId));
  }

  const session = GameSession.create({ ... });
  yield* sessionRepo.create(session);

  const token = yield* tokenSigner.sign({ ... });
  return { session, token };
});
```

---

## 3. Comparison: Current Patterns vs Effect Alternatives

### 3.1 Error Handling

| Aspect | Current Pattern | Effect Pattern |
|--------|-----------------|----------------|
| Error declaration | Class extends `DomainError` | Plain class with `_tag` field |
| Error tracking | Runtime only (throw/catch) | Compile-time via type parameter |
| Error recovery | try/catch or middleware | `Effect.catchTag`, `Effect.catchAll` |
| Exhaustiveness | No compiler check | Compiler enforces handling |

**Current Code:**
```typescript
// Caller has no idea what errors can occur
public async execute(command: CreateGameSessionCommand): Promise<CreateGameSessionResult> {
  const pack = await this.#packRepo.findById(packId);
  if (!pack) {
    throw new PackNotFoundError(command.packId);  // Not in signature!
  }
}
```

**Effect Alternative:**
```typescript
// Errors are explicit in the return type
const execute = (
  command: CreateGameSessionCommand
): Effect.Effect<CreateGameSessionResult, PackNotFoundError, PackRepository> =>
  Effect.gen(function* () {
    const repo = yield* PackRepository;
    const pack = yield* repo.findById(command.packId);
    if (!pack) {
      return yield* Effect.fail(new PackNotFoundError(command.packId));
    }
    // ...
  });
```

### 3.2 Dependency Injection

| Aspect | Current Pattern | Effect Pattern |
|--------|-----------------|----------------|
| Definition | Interface (Port) | `Context.Tag` |
| Wiring | Manual in factory | Automatic via `Layer.provide` |
| Composition | Explicit object construction | `Layer.merge`, `Layer.provide` |
| Testing | Pass mock in constructor | Provide test Layer |

**Current Code:**
```typescript
// Manual wiring in every handler
export function createCreateSessionHandler(dependencies?: CreateSessionHandlerDependencies) {
  const deps = dependencies ?? AppRuntime.getProductionDependencies();
  const useCase = new CreateGameSessionUseCase({
    packRepo: deps.packRepo,
    sessionRepo: deps.sessionRepo,
    tokenSigner: deps.tokenSigner,
  });
  // ...
}
```

**Effect Alternative:**
```typescript
// Define services as tags
class PackRepository extends Context.Tag("PackRepository")<PackRepository, CurriculumPackRepositoryPort>() {}
class SessionRepository extends Context.Tag("SessionRepository")<SessionRepository, GameSessionRepositoryPort>() {}
class TokenSigner extends Context.Tag("TokenSigner")<TokenSigner, CapabilityTokenSignerPort>() {}

// Compose layers
const ProductionLayer = Layer.mergeAll(
  MongoPackRepositoryLive,
  InMemorySessionRepositoryLive,
  HmacTokenSignerLive
);

const TestLayer = Layer.mergeAll(
  InMemoryPackRepositoryTest,
  InMemorySessionRepositoryTest,
  FakeTokenSignerTest
);

// Handler automatically gets dependencies
const handler = createSessionEffect.pipe(Effect.provide(ProductionLayer));
```

### 3.3 HTTP Middleware

| Aspect | Current Pattern | Effect Pattern |
|--------|-----------------|----------------|
| Framework | Middy | @effect/platform HttpMiddleware |
| Composition | `.use()` chaining | `pipe` and `Effect.flatMap` |
| Error handling | Separate `onError` hook | Unified in Effect type |
| Type safety | Limited across chain | Full type propagation |

**Current Code:**
```typescript
return middy(rawHandler)
  .use(authMiddleware({ tokenVerifier, apiKey, requireApiKey }))
  .use(domainErrorMiddleware());
```

**Effect Alternative:**
```typescript
const handler = pipe(
  HttpRouter.makeRoute("POST", "/api/v1/sessions"),
  HttpRouter.use(authMiddleware),
  HttpRouter.handle(createSessionEffect),
  Effect.catchTags({
    PackNotFoundError: (e) => HttpResponse.json({ code: e._tag }, { status: 404 }),
    UnauthorizedTokenError: (e) => HttpResponse.json({ code: e._tag }, { status: 401 }),
  })
);
```

---

## 4. Pros and Cons Analysis

### 4.1 Advantages of Adopting Effect

| Benefit | Description |
|---------|-------------|
| **Type-safe errors** | Errors appear in function signatures; compiler enforces handling |
| **No forgotten errors** | Cannot ignore an error without explicit `Effect.catchAll` or similar |
| **Built-in DI** | Layers provide composable, type-safe dependency injection |
| **Testing simplicity** | Swap layers for tests without constructor changes |
| **Resource safety** | `Effect.acquireRelease` handles cleanup automatically |
| **Structured concurrency** | Fibers, interruption, and race conditions handled properly |
| **Observability** | Built-in tracing, metrics, and logging via Spans |
| **Retry/timeout** | `Effect.retry`, `Effect.timeout` are first-class |
| **Gradual adoption** | Can wrap existing async code with `Effect.promise` |

### 4.2 Disadvantages of Adopting Effect

| Drawback | Description |
|----------|-------------|
| **Learning curve** | New paradigm; team must learn Effect idioms |
| **Bundle size** | Minimum ~25KB gzipped; full import ~257KB gzipped |
| **Ecosystem fit** | Middy, AWS Lambda, Netlify have no Effect integrations |
| **Debugging** | Stack traces through Effect runtime can be harder to read |
| **Boilerplate** | Service tags, layers add ceremony for simple cases |
| **Community size** | Smaller than mainstream TypeScript patterns |
| **Migration cost** | All use cases and handlers would need rewriting |
| **Team velocity** | Initial slowdown during learning period |

---

## 5. Fit Assessment for diabe-teach

### 5.1 Does the Codebase Suffer from Problems Effect Solves?

| Problem | Present in Codebase? | Severity |
|---------|---------------------|----------|
| Untracked thrown errors | Yes | Low-Medium |
| Complex DI wiring | No - simple factory pattern | Low |
| Resource leaks | No evidence | N/A |
| Concurrency issues | No - single-request handlers | N/A |
| Retry/timeout needs | Not currently | Low |
| Observability gaps | Not mentioned | Unknown |

### 5.2 Current Architecture Quality

The codebase demonstrates solid patterns:
- Clear ports/adapters (hexagonal) architecture
- Well-defined domain errors with codes
- Centralized error-to-HTTP mapping
- Simple, testable dependency injection
- Good test coverage with in-memory repositories

### 5.3 Migration Effort Estimate

| Component | Files | Effort |
|-----------|-------|--------|
| Domain errors | 1 | Add `_tag` fields (minor) |
| Use cases | 13 | Rewrite as Effect generators (major) |
| Ports | 16 | Convert to Context.Tags (medium) |
| Adapters | ~10 | Wrap in Layers (medium) |
| Handlers | 27 | Rewrite with Effect HTTP (major) |
| Tests | 19 | Update to provide test Layers (medium) |
| **Total** | ~86 files | **Significant** |

---

## 6. Recommendations

### 6.1 Primary Recommendation: Do Not Adopt Effect Now

**Rationale:**
1. The current architecture is clean and working
2. The team would need significant onboarding
3. Bundle size increase is non-trivial for serverless functions
4. No Middy/Netlify integration means replacing established patterns
5. The problems Effect solves best (concurrency, resource management) are not pressing here

### 6.2 Consider Effect If/When:

- The codebase grows significantly more complex
- You add long-running processes or background jobs
- Concurrency and resource management become critical
- The team expresses interest in functional programming patterns
- A greenfield service is started

### 6.3 Low-Cost Improvements Without Effect

If you want better error tracking without Effect:

**Option A: Document possible errors in JSDoc**
```typescript
/**
 * @throws {PackNotFoundError} When pack does not exist
 * @throws {UnauthorizedTokenError} When token is invalid
 */
public async execute(command: CreateGameSessionCommand): Promise<CreateGameSessionResult>
```

**Option B: Use a Result type for new code**
```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

public async execute(
  command: CreateGameSessionCommand
): Promise<Result<CreateGameSessionResult, PackNotFoundError | SessionError>>
```

**Option C: Add error code constants to middleware**
```typescript
const ERROR_STATUS_MAP: Record<string, number> = {
  PACK_NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  UNAUTHORIZED_TOKEN: 401,
  // ...
};
```

---

## 7. Citations (Primary Sources)

### Effect Official Documentation
- [Introduction](https://effect.website/docs) - Overview of Effect library
- [The Effect Type](https://effect.website/docs/getting-started/the-effect-type/) - `Effect<Success, Error, Requirements>` explanation
- [Expected Errors](https://effect.website/docs/error-management/expected-errors/) - Typed error handling with `_tag`
- [Creating Effects](https://effect.website/docs/v3/getting-started/creating-effects) - Effect.succeed, Effect.fail, Effect.gen
- [Building Pipelines](https://effect.website/docs/getting-started/building-pipelines/) - pipe and flatMap patterns
- [Managing Services](https://effect.website/docs/v3/requirements-management/services) - Context.Tag and Layer
- [Effect vs fp-ts](https://effect.website/docs/other/fp-ts) - Comparison with fp-ts
- [Myths About Effect](https://effect.website/docs/v3/additional-resources/myths) - Bundle size and complexity myths
- [Effect v4 Beta](https://effect.website/blog/releases/effect/40-beta) - Latest improvements including reduced bundle size

### NPM Package Stats
- [Effect on pkgpulse](https://www.pkgpulse.com/packages/effect) - Download statistics and evidence
- [Effect on npmx.dev](https://npmx.dev/package/effect) - Package analysis

### Community Resources
- [Effect-TS in 2026 - DEV Community](https://dev.to/ottoaria/effect-ts-in-2026-functional-programming-for-typescript-that-actually-makes-sense-1go) - Practical guide
- [From fp-ts to effect-ts Migration Guide](https://www.sandromaglione.com/articles/from-fp-ts-to-effect-ts-migration-guide) - Migration patterns
- [Exploring Effect in TypeScript - Tweag](https://www.tweag.io/blog/2024-11-07-typescript-effect/) - Async and error handling
- [Effect-Based Architecture](https://zread.ai/2234839/TsFullStack/6-effect-based-architecture) - Architecture patterns
- [Services & Layers - Effect Solutions](https://www.effect.solutions/services-and-layers) - DI patterns

### GitHub
- [Effect-TS/effect](https://github.com/Effect-TS/effect) - Main repository
- [Bundle Size PR #8090](https://github.com/Effect-TS/effect/pull/8090) - Bundle size optimization efforts

---

## 8. Appendix: Code Examples

### A. Current Error Handling Flow

```
User Request
    |
    v
[Netlify Handler]
    |
    v
[Middy Pipeline]
    |-- authMiddleware (throws UnauthorizedTokenError)
    |-- rawHandler
    |       |
    |       v
    |   [UseCase.execute()] (throws DomainError subclasses)
    |
    v
[domainErrorMiddleware.onError]
    |-- instanceof checks
    |-- maps to HTTP status
    |
    v
HTTP Response
```

### B. Effect Alternative Flow

```
User Request
    |
    v
[Effect HTTP Handler]
    |
    v
[Effect Pipeline]
    |-- Effect.catchTag("UnauthorizedTokenError", ...)
    |-- Effect.catchTag("PackNotFoundError", ...)
    |       |
    |       v
    |   [Effect.gen use case]
    |       |-- yield* PackRepository
    |       |-- yield* SessionRepository
    |       |-- Effect.fail(new PackNotFoundError(...))
    |
    v
[Effect.provide(ProductionLayer)]
    |
    v
[Effect.runPromise]
    |
    v
HTTP Response
```
