# 10: Refactor Procedural Functions into Cohesive Classes (`BaseHttpHandler`, `GetPackByIdHttpHandler`, `OpenApiHttpApp`, `MongoConnectionManager`) and Move Runtime Config to Top-Level `AppRuntime` Class (`src/app-runtime.ts`)

**What to build:** Replace all loose procedural helper and factory functions in `src/` with cohesive, object-oriented classes (`BaseHttpHandler`, `GetPackByIdHttpHandler`, `OpenApiHttpApp`, `MongoConnectionManager`, and `CurriculumPack` static helpers), move runtime environment and dependency configuration to a visible top-level `AppRuntime` class (`src/app-runtime.ts` + `src/app-runtime.types.ts`), and delete the hidden `src/config/` folder.

**Blocked by:** 01, 02, 03, 04, 05, 06, 07, 08, 09 (all completed)

**Status:** done

- [x] `BaseHttpHandler<TQuery, TResult>` in `src/adapters/inbound/http/endpoint-handler.factory.ts` is an abstract class providing `public async handle(request, context): Promise<Response>` (`transformRequest -> execute -> BaseHttpHandler.jsonResponse / BaseHttpHandler.mapDomainErrorToResponse`) and static methods (`verifyApiKeyHeader`, `parseBearerTokenHeader`, `jsonResponse`, `mapDomainErrorToResponse`).
- [x] `GetPackByIdHttpHandler` in `src/adapters/inbound/http/get-pack-by-id.handler.ts` extends `BaseHttpHandler<GetCurriculumPackByIdQuery, GetCurriculumPackByIdResult>`, implementing `public transformRequest(input)` and `protected execute(query)`.
- [x] `OpenApiHttpApp` in `src/adapters/inbound/http/create-app.ts` implements `HttpApp` (`new OpenApiHttpApp(deps).fetch(request, context)`), encapsulating `OpenAPIBackend` routing (`docs/api/openapi.yaml`) and `ApiKeyAuth` security validation.
- [x] `MongoConnectionManager` in `src/adapters/outbound/mongo-client-singleton.ts` encapsulates the `MongoClient` connection cache as a class (`MongoConnectionManager.getDatabase(uri, dbName)`), and `CurriculumPack` encapsulates `#normalizeLookupKey` and `#deepFreeze` as private static methods so zero loose functions remain in `src/`.
- [x] `AppRuntime` in `src/app-runtime.ts` (with contracts in `src/app-runtime.types.ts`) sits directly at the top level of `src/` (replacing the hidden `src/config/runtime.config.ts`), providing `AppRuntime.loadEnvConfig`, `AppRuntime.buildProductionDependencies`, `AppRuntime.getProductionDependencies`, `AppRuntime.createServerlessHttpHandler`, and `AppRuntime.defineServerlessRouteConfig`, and `src/config/` is deleted.
- [x] `.dependency-cruiser.cjs` enforces that `src/app-runtime.ts` is the only file in `src/` allowed to wire `src/adapters/inbound/` and `src/adapters/outbound/` together, and all tests (`npm test`, `npm run typecheck`, `npm run lint:boundaries`) pass with zero violations.
