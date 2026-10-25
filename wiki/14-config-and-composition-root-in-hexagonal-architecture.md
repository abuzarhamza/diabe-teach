# 14 — Is `netlify/config/` an Inbound Adapter or the Composition Root?

## Research Question

> *"As `config` (`netlify/config/`) is inbound, can we move it into `src/adapters/inbound/` in hexagonal design? Tell me if I am correct."*

---

## Executive Verdict

**You are partially right about one piece (`create-netlify-function-handler.ts`), and mistaken about `netlify/config/` as a whole:**

1. **`netlify/config/` as a whole is NOT an Inbound Adapter — it is the Application's Composition Root (Configurator).**
   Moving `netlify/config/` wholesale into `src/adapters/inbound/` would **violate Hexagonal Architecture** and immediately fail two `dependency-cruiser` rules in [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs):
   - **`no-inbound-to-outbound-adapter-imports`** (lines 25–31): [`netlify/config/netlify-runtime.config.ts`](../netlify/config/netlify-runtime.config.ts) directly imports and instantiates **Outbound Adapters** (`MongoCurriculumPackRepository`, `getMongoDatabase`, `HmacCapabilityTokenAdapter`) from `src/adapters/outbound/`. In Hexagonal Architecture, an **Inbound Adapter** (`src/adapters/inbound/`) is strictly forbidden from importing **Outbound Adapters** (`src/adapters/outbound/`).
   - **`netlify-sdk-isolated-to-composition-root`** (lines 54–64): [`netlify/config/netlify-runtime.types.ts`](../netlify/config/netlify-runtime.types.ts) imports `@netlify/functions` types (`Config`, `Context`), which are isolated outside `src/`.
2. **Where your intuition IS right:**
   [`netlify/config/create-netlify-function-handler.ts`](../netlify/config/create-netlify-function-handler.ts) currently blends **two separate responsibilities**:
   - **An Inbound Adapter bridge** (lines 19–26): forwarding `(request: Request, context: NetlifyFunctionContext)` into `app.fetch(request, { params: context?.params })`.
   - **A Composition Root default** (line 15): `deps: NetlifyProductionDependencies = getNetlifyProductionDependencies()`, which pulls the Outbound MongoDB and HMAC wiring into the file.

---

## 1. Primary Sources: Why Config / Dependency Wiring Is NOT an Inbound Adapter

### 1.1 Alistair Cockburn — *Hexagonal Architecture (Ports and Adapters)* & *Configurable Dependency*
In Alistair Cockburn's specification of **Hexagonal Architecture (Ports and Adapters)** (2005) and *Hexagonal Architecture Explained* (Cockburn & Garrido de Paz, 2024):
- **Inbound (Driving / Primary) Adapters** translate external input signals (HTTP requests, CLI flags, WebSockets) into calls on the application's **Inbound Ports** (`UseCase` interfaces) using only **Application Ports**. An Inbound Adapter **must never know which concrete Outbound Adapters (`MongoDB`, `InMemory`, `Postgres`) exist**.
- **Outbound (Driven / Secondary) Adapters** implement the application's **Outbound Ports** (`CurriculumPackRepositoryPort`, `CapabilityTokenPort`) using concrete infrastructure (`mongodb`, `node:crypto`).
- **The Configurator (`Main` / Composition Root):** Because neither the Application Hexagon nor the Inbound Adapters are allowed to import concrete Outbound Adapters, Cockburn defines a distinct outer component — the **Configurator** — that reads runtime environment variables (`process.env`), instantiates the concrete Outbound Adapters, and injects them into the Inbound Adapter (`createApp(deps)`).

### 1.2 Mark Seemann — *Dependency Injection Principles, Practices, and Patterns* (Ch. 4: "The Composition Root")
Mark Seemann and Steven van Deursen define the **Composition Root**:
> *"A Composition Root is a (preferably) unique location in an application where modules are composed together. It should be placed as close to the application's entry point as possible."*

- The **Composition Root** is the **only layer in the system** allowed to import **both** `src/adapters/inbound/` and `src/adapters/outbound/` simultaneously.
- If you move the Composition Root inside `src/adapters/inbound/`, then `src/adapters/inbound/` becomes coupled to MongoDB (`MongoCurriculumPackRepository`) and HMAC (`HmacCapabilityTokenAdapter`), destroying the boundary between Inbound and Outbound adapters.

### 1.3 Robert C. Martin — *Clean Architecture* (Ch. 26: "The Main Component")
In *Clean Architecture*, Robert C. Martin places configuration and dependency wiring in the outermost **`Main` Component**:
> *"The `Main` component is the ultimate detail — the lowest-level policy. It is the initial entry point of the system... Its job is to create all the Factories, Strategies, and other global facilities, and then hand control over to the high-level abstract portions of the system."*

---

## 2. File-by-File Audit of `netlify/config/`

| File | What It Imports | What It Actually Does | True Hexagonal Role | Can It Move to `src/adapters/inbound/`? |
| :--- | :--- | :--- | :--- | :--- |
| [`netlify/config/netlify-runtime.config.ts`](../netlify/config/netlify-runtime.config.ts) | `src/adapters/outbound/mongo-curriculum-pack-repository.ts`, `src/adapters/outbound/mongo-client-singleton.ts`, `src/adapters/outbound/hmac-capability-token-adapter.ts` | Reads `process.env.MONGODB_URI`, `MONGODB_DB_NAME`, `CAPABILITY_TOKEN_SECRET`, `API_KEY` and instantiates `new MongoCurriculumPackRepository(...)` and `new HmacCapabilityTokenAdapter(...)` | **Composition Root / Configurator** (wires Outbound + Inbound config) | **No** — imports `src/adapters/outbound/*`, which violates `no-inbound-to-outbound-adapter-imports` |
| [`netlify/config/netlify-runtime.types.ts`](../netlify/config/netlify-runtime.types.ts) | `@netlify/functions`, `src/application/ports/*` | Declares `NetlifyRuntimeEnvConfig`, `NetlifyProductionDependencies`, `NetlifyFunctionHandler` | **Composition Root & Platform Types** | **No** — imports `@netlify/functions`, which violates `netlify-sdk-isolated-to-composition-root` |
| [`netlify/config/create-netlify-function-handler.ts`](../netlify/config/create-netlify-function-handler.ts) | `src/adapters/inbound/http/create-app.ts` **and** `./netlify-runtime.config.ts` | 1. Calls `createApp(deps)` and bridges `(request, context)` $\to$ `app.fetch(request, { params: context?.params })` (**Inbound concern**)<br>2. Defaults `deps = getNetlifyProductionDependencies()` (**Composition Root concern**) | **Hybrid: Inbound Bridge + Composition Root Default** | **Only the pure `(request, context) => app.fetch(...)` bridge** if decoupled from `getNetlifyProductionDependencies()` and `@netlify/functions` |

---

## 3. Architectural Diagram: Inbound vs. Outbound vs. Composition Root

```
                   ┌───────────────────────────────────────────────────────┐
                   │   OUTERMOST RING: Entry Point & Composition Root      │
                   │   netlify/functions/api.ts + netlify/config/*         │
                   │   - Reads process.env (MONGODB_URI, API_KEY, etc.)    │
                   │   - Instantiates Outbound Adapters                    │
                   │   - Injects them into Inbound Adapter: createApp(deps)│
                   └──────────────┬─────────────────────────┬──────────────┘
                                  │                         │
            injects deps into     ▼                         ▼   instantiates
        ┌───────────────────────────────────┐     ┌───────────────────────────────────┐
        │ INBOUND ADAPTERS                  │     │ OUTBOUND ADAPTERS                 │
        │ src/adapters/inbound/http/        │     │ src/adapters/outbound/            │
        │ - createApp(deps)                 │     │ - MongoCurriculumPackRepository   │
        │ - openapi-backend router          │     │ - HmacCapabilityTokenAdapter      │
        │ - get-pack-by-id.handler.ts       │     │ - mongo-client-singleton.ts       │
        │                                   │     │                                   │
        │ ❌ NEVER imports outbound!        │     │ ❌ NEVER imports inbound!         │
        └─────────────────┬─────────────────┘     └─────────────────┬─────────────────┘
                          │ calls                                   │ implements
                          ▼                                         ▼
        ┌─────────────────────────────────────────────────────────────────────────────┐
        │ APPLICATION & DOMAIN HEXAGON (src/application/ + src/domain/)               │
        │ - GetCurriculumPackByIdUseCase                                              │
        │ - CurriculumPackRepositoryPort, CapabilityTokenPort                         │
        │ - CurriculumPack, PackId, DomainError                                       │
        └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. What Options Do We Have?

1. **Keep `netlify/config/` Outside `src/adapters/inbound/` as the Composition Root (Recommended Default)**
   - In our architecture, `netlify/` (`netlify/functions/api.ts` + `netlify/config/*`) is the **Serverless Composition Root** ring sitting outside `src/`.
   - This keeps `src/adapters/inbound/` 100% pure of MongoDB, `process.env`, and `@netlify/functions`, and keeps all 7 rules in [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) passing with zero violations.
2. **Optional Refinement: Rename `netlify/config/` $\to$ `netlify/composition-root/` (or Split the Pure Handler Bridge)**
   - If the folder name `netlify/config/` feels ambiguous, renaming it or documenting it explicitly as the **Composition Root** makes it clear why it sits outside `src/adapters/inbound/` (because it wires both Inbound and Outbound adapters together).

---

## 5. Sources

1. Alistair Cockburn (2005), *Hexagonal Architecture (Ports and Adapters)* — Primary (Driving) vs. Secondary (Driven) Adapters and the Configurable Dependency pattern.
2. Alistair Cockburn & Juan Manuel Garrido de Paz (2024), *Hexagonal Architecture Explained* — Chapter on the Configurator (`main`) actor outside Driving and Driven adapters.
3. Mark Seemann & Steven van Deursen (2019), *Dependency Injection Principles, Practices, and Patterns*, Chapter 4 ("The Composition Root").
4. Robert C. Martin (2017), *Clean Architecture*, Chapter 26 ("The Main Component").
5. Repository Primary Sources:
   - [`.dependency-cruiser.cjs`](../.dependency-cruiser.cjs) (lines 25–64)
   - [`netlify/config/netlify-runtime.config.ts`](../netlify/config/netlify-runtime.config.ts) (lines 1–73)
   - [`netlify/config/create-netlify-function-handler.ts`](../netlify/config/create-netlify-function-handler.ts) (lines 1–27)
   - [`netlify/config/netlify-runtime.types.ts`](../netlify/config/netlify-runtime.types.ts) (lines 1–31)
