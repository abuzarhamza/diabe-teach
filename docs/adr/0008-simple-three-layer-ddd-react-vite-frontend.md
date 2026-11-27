# ADR-0008: Simple Three-Layer DDD React + Vite Frontend Architecture (`web/src/{domain,api,features}`)

## Status

Accepted (2026-11-21).

## Context

The backend API (`src/` and `netlify/functions/`) is now feature-complete across all 24 endpoints, while the UI currently lives as multi-page static HTML/JS prototypes in `claudPoc/concept-chain/` backed largely by a browser fake (`app.js`) except for teacher login and pack library calls (`account-api.js`). We need to build the real production web UI in React.

Two constraints shape the frontend architecture:
1. **Deployment and backend topology:** The backend already runs as 24 serverless Netlify Functions v2 endpoints under `/api/*` on the same origin. An SSR meta-framework (Next.js) would introduce a second server runtime on Netlify, hydration complexity, and `"use client"` boilerplate on almost every screen because the game is a live client-side state machine (countdown timers, interactive 7×7 Concept Chain board, 2-second session polling, and browser-stored `AccountToken` / `CapabilityToken`).
2. **Developer ergonomics and debuggability:** As a first-time React codebase, a full 4-layer ceremonial Hexagonal frontend (with separate ports, DTOs, mappers, use-case classes, and DI containers mirroring the backend) would scatter a single button click across 6+ files. Conversely, a flat React codebase where components call `fetch()`, manipulate `localStorage`, and compute Chebyshev-8 board adjacency inline inside `useEffect` hooks becomes brittle and untestable without a browser.

## Decision

We adopt a **Vite + React + TypeScript Single-Page Application (SPA)** in `web/` as its own standalone package (`web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/eslint.config.js` with `@antfu/eslint-config({ react: true })`, so frontend dependencies and linting stay completely isolated from the backend's root `package.json` and `eslint.config.mjs`), organized into a **Simple Three-Layer Pragmatic DDD structure** under `web/src/`:

```text
web/
├── package.json                          # Standalone frontend dependencies + @antfu/eslint-config & eslint
├── eslint.config.js                      # Standalone antfu({ react: true }) ESLint config with no-useEffect rule
├── tsconfig.json                         # Frontend TypeScript configuration ("jsx": "react-jsx")
├── index.html
├── vite.config.ts
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── styles.css                        # Reuses claudPoc/concept-chain/styles.css directly
    ├── domain/                           # Layer 1: Pure UI Domain Rules (Zero React, zero fetch, zero storage)
    │   ├── chain-path.ts                 # Chebyshev-8 adjacency, duplicate-cell check, minChainLength check
    │   ├── phase-timer.ts                # Countdown formatting (MM:SS) and 5-second grace period math from phaseEndsAt
    │   └── session-phase.ts              # Maps the 11 Game Session phases to the active view and role permissions
    ├── api/                              # Layer 2: Outbound API & Token Store (All fetch() and storage calls live here)
    │   ├── http-client.ts                # Single fetch() wrapper: attaches x-api-key + Bearer token, parses ApiErrorResponse
    │   ├── token-store.ts                # Reads/writes AccountToken (localStorage) and session CapabilityTokens
    │   ├── accounts-api.ts               # signUp, signIn, getCurrentAccount
    │   ├── packs-api.ts                  # listPacks, getPackById, validatePack, registerPack, archivePack, unarchivePack
    │   └── sessions-api.ts               # createSession, joinSession, getSessionState, transitionPhase, extendPhase, submitChain, listRoundChains, adjudicateChain, getStandings, submitAssessment, submitSurvey, getAnalytics, leaveSession, endSession
    └── features/                         # Layer 3: React Screens & Components (Inbound UI grouped by domain area)
        ├── shared/                       # TopBar, ErrorBanner (renders ApiErrorResponse.code + message), PhaseTimerBadge
        ├── accounts/                     # LoginPage (teacher sign-in/sign-up + learner room-code join)
        ├── packs/                        # PackLibraryPage, PackDetailPage, PackEditorPage
        └── game-session/                 # GameSetupPage + SessionShellPage (polls state every 2s & switches phase view)
            └── views/                    # LobbyView, AssessmentView, OrientationView, ChainMappingView, AdjudicationView, RoundSummaryView, SurveyView, ResultsView
```

### Layer Rules (Enforced by `npm run lint:boundaries`)

1. **`web/src/domain/` (Pure UI Domain):**
   - Pure TypeScript functions and value objects only.
   - **Forbidden imports:** `react`, `react-dom`, `react-router`, `web/src/api/*`, `web/src/features/*`, `fetch`, `window`, `localStorage`, `sessionStorage`.
   - Tested directly in Vitest in milliseconds without mounting React components or mocking HTTP.
2. **`web/src/api/` (API & Storage Boundary):**
   - The **only** folder permitted to call `fetch()` or access browser token storage (`localStorage` / `sessionStorage`).
   - All HTTP requests go through `http-client.ts`, which attaches the appropriate token (`AccountToken` for `AccountAuth` routes, session-scoped `CapabilityToken` for `BearerAuth` routes, per ADR-0007), parses standard `{ code, message, details }` error responses into a typed `ApiHttpError`, and logs a concise `[API]` diagnostic line in local development.
   - **Forbidden imports:** `react`, `web/src/features/*`.
3. **`web/src/features/` (React Screens & Components):**
   - Grouped by domain concept (`accounts`, `packs`, `game-session`, `shared`), matching the existing prototype screens in `claudPoc/concept-chain/`.
   - **`SessionShellPage`** is the single state owner for an active Game Session (`/sessions/:sessionId`): it uses TanStack Query (`useQuery` with `refetchInterval: 2000`) to poll `GET /api/v1/sessions/:sessionId`, holds the latest `PublicSessionState`, and delegates to `domain/session-phase.ts` to render the active phase view (`LobbyView`, `AssessmentView`, `ChainMappingView`, `AdjudicationView`, etc.) by passing state down as plain React props.
   - Components never call `fetch()` or `localStorage` directly; they call functions from `web/src/api/*` and pure rules from `web/src/domain/*`.
4. **No `useEffect` in React code (enforced by ESLint `no-restricted-imports` / `no-restricted-properties`):**
   - Following React's modern *"You Might Not Need an Effect"* guidance, `useEffect` is **banned** across `web/src/**`:
     - **Data fetching & 2-second session polling:** Handled declaratively by **TanStack Query** (`useQuery({ queryKey, queryFn, refetchInterval: 2000 })`).
     - **User actions (sign-in, join, advance phase, submit chain, vote, rule):** Handled directly in **event handlers** (`onSubmit`, `onClick`) or `useMutation`, updating query cache and navigating in `onSuccess`—never by watching state inside a `useEffect`.
     - **Derived state (can submit chain, filtered packs, current phase view):** Computed synchronously **during render** via pure functions in `web/src/domain/*`.
     - **Resetting form state when round or phase changes:** Handled by passing a React `key` prop (`<ChainMappingView key={state.phase} ... />`).
     - **Wall-clock countdown tick (`MM:SS`):** Subscribed via `useSyncExternalStore` to a shared 1-second clock store in `web/src/api/clock-store.ts`.

## Considered Options

- **Next.js (App Router / SSR):** Rejected because our backend already runs as Netlify Functions v2 and every game screen is a real-time client state machine requiring browser tokens and 2-second polling. Next.js adds SSR/client boundary friction with no architectural benefit.
- **Full 4-Layer Hexagonal Frontend (`domain` + `application/ports` + `adapters/outbound` + `adapters/inbound/react`):** Rejected as too ceremonial for a first-time React developer—tracing a single button click through 6 files slows down debugging, whereas collapsing `application` + `outbound` into a single `api/` module preserves domain purity and testability with half the indirection.
- **Flat React Components (no `domain/` or `api/` separation):** Rejected because embedding Chebyshev-8 board adjacency, grace-period timer math, and raw `fetch()` calls inside React `useEffect` hooks makes game logic hard to test and easy to break.

## Consequences

### Positive

- **One-stop debugging:** Game rule bug → `web/src/domain/`; network or token bug → `web/src/api/http-client.ts`; rendering or click bug → `web/src/features/`.
- **Fast unit tests:** All board path building, timer grace-period math, and phase-to-screen mapping are tested in Vitest as pure functions.
- **Zero styling guesswork:** Reuses `claudPoc/concept-chain/styles.css` directly so the React app preserves the exact visual design of the approved prototype.
- **Same-origin Netlify deployment:** Vite builds static assets to `web/dist`, served alongside `/api/v1/*` Netlify Functions with no CORS configuration needed.
