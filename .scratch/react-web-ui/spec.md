# Spec: Simple 3-Layer DDD React + Vite Web UI replacing the browser-fake prototype screens

**Status:** ready-for-agent

> **Drift note (2026-11-27, as of `d2c2a42`):** `react-web-setup` 01–02 are done (standalone `web/` package, no-`useEffect` lint, boundary rules). Slice `01` (teacher sign-in) is done, built as `.scratch/react-login-screen/` 01–06. The prototype pages are `claudPoc/concept-chain/{login,setup,lobby,teacher,participant}.html`, and the stylesheet is `shared.css` (already copied to `web/src/styles.css`). The prototype is the visual reference only. Field names below follow `docs/api/openapi.yaml`. Implementation slices: `issues/01`–`14`. Questions only the user can answer are listed under "Open questions (need the user)".

## Problem Statement

While the backend API (`src/` and `netlify/functions/`) and manual Bruno documentation (`docs/api/bruno/`) are complete across all 24 endpoints, the browser UI in `claudPoc/concept-chain/` is still a set of static prototype pages (`login.html`, `setup.html`, `lobby.html`, `teacher.html`, `participant.html`). Only teacher login and pack discovery call the real API (`account-api.js`). All Game Session gameplay, board dealing, chain submissions, adjudication, assessments, survey, and analytics still run against an in-browser fake (`shared.js`, kept in `localStorage`). The React app in `web/` has the teacher login screen (react-login-screen 01–06) and a Game Setup placeholder, nothing else yet.

We need a real, maintainable production React web application that:
1. Connects every screen to the real `/api/v1/*` backend endpoints with zero browser-fake gameplay state.
2. Is structured in the **Simple 3-Layer Pragmatic DDD architecture (`web/src/{domain,api,features}`)** defined in **ADR-0008**, so a first-time React developer can easily read, test, and debug pure UI domain rules (`domain/`), network/token calls (`api/`), and React views (`features/`).
3. Preserves the visual design of the prototype by reusing `claudPoc/concept-chain/shared.css` (copied to `web/src/styles.css`).

## Solution

Build the **Vite + React + TypeScript Single-Page Application (SPA)** in `web/` following **ADR-0008**:

1. **Layer 1 — Pure UI Domain (`web/src/domain/`):**
   - Pure TypeScript modules with zero React, zero `fetch`, and zero browser storage imports, unit-tested in Vitest:
     - `chain-path.ts`: Chebyshev-8 cell adjacency check (`|r1 - r2| <= 1 && |c1 - c2| <= 1`), duplicate-cell prevention, backtrack/pop on clicking the last cell, and `minChainLength` validation before submission.
     - `phase-timer.ts`: Pure countdown calculation from `phaseEndsAt` and `now` (`remainingSec`, formatted `MM:SS`, `isInstructorDriven` when `phaseEndsAt === null`, and `isInGracePeriod` during the 5-second Chain-Mapping submission grace window).
     - `session-phase.ts`: Maps each of the 11 backend `PhaseIdentifier` values that the state's `currentPhase` can hold (`pretest`, `trial-orientation`, `round-1:chain-mapping`, `round-1:peer-adjudication`, `round-1:round-summary`, `round-2:chain-mapping`, `round-2:peer-adjudication`, `round-2:round-summary`, `posttest`, `feedback-survey`, `completed`) to its screen title, step number, active view component key, and allowed instructor/participant controls (`canAdvance`, `canExtend`, `canEnd`, `canLeave`).
2. **Layer 2 — API & Token Store Boundary (`web/src/api/`):**
   - The **only** layer that calls `fetch()` or reads/writes `localStorage` / `sessionStorage`.
   - Already built (react-login-screen 01–06):
     - `account-token-store.ts`: The teacher's 12-hour **Account Token** (expiry-aware, shared across tabs through the `storage` event).
     - `login-reason-store.ts`: The one-time reason shown on `/login` when a teacher screen sends a signed-out teacher back.
     - `http-client.ts`: Single typed `apiRequest()` wrapper that attaches `Content-Type: application/json`, optional `x-api-key` (from `VITE_API_KEY`), and the explicit `Authorization: Bearer <token>` for that route's security scheme (`AccountAuth` vs. `BearerAuth`), logs `[API] <METHOD> <path> -> <status>` in development mode, and throws a structured `ApiHttpError` (`status`, `code`, `message`, `details`) on non-2xx responses.
     - `accounts-api.ts`: `signUpInstructor`, `signInInstructor`, `getCurrentAccount`.
   - Still to build:
     - `session-seat-store.ts`: The per-session **Capability Token** seat (`sessionId`, `role: "instructor" | "participant"`, `token`, `participantId`, `displayName`, `roomCode`). It is a separate file from `account-token-store.ts`, so the two token kinds never mix (ADR-0007).
     - `packs-api.ts`: `listPacks`, `getPackById`, `validatePack`, `registerPack`, `archivePack`, `unarchivePack`.
     - `sessions-api.ts`: `createSession`, `joinSession`, `getSessionState`, `transitionPhase`, `extendPhase`, `endSession`, `leaveSession`, `submitChain`, `listRoundChains`, `adjudicateChain`, `getRoundStandings`, `submitAssessment`, `submitSurvey`, `getSessionAnalytics`.
3. **Layer 3 — React Screens & Components (`web/src/features/`):**
   - **Hooks rule (react-login-screen 06):** screens call hooks named for what they do (`useSignIn`, `useCurrentAccount`, later `useSessionState`, `useRoundChains`, ...). Only a feature's `*-hooks.ts` file (for example `features/accounts/account-hooks.ts`, later `features/packs/pack-hooks.ts` and `features/game-session/session-hooks.ts`), `main.tsx` and `App.tsx` may import TanStack Query. ESLint enforces this.
   - **`shared/`**: `TopBar` (built), `ErrorBanner` (built; displays `ApiHttpError.code`, `message`, and `details.field` clearly), and `PhaseTimerBadge` (updates every second using `domain/phase-timer.ts`).
   - **`accounts/LoginPage.tsx`** (`/login`):
     - Teacher Sign In and Create account (built in react-login-screen 01–05; see that spec).
     - Learner Quick Join form (`roomCode` + `displayName`) calling `sessionsApi.joinSession`, saving the learner's `CapabilityToken` seat, and navigating directly to `/sessions/:sessionId`.
     - Solo Practice quick-start button calling `sessionsApi.createSession({ mode: "solo", packId, ... })` and navigating directly to `/sessions/:sessionId`. How a signed-out learner picks the `packId` is open question (c).
   - **`packs/`** (`/packs`, `/packs/new`, `/packs/:packId`):
     - `PackLibraryPage.tsx`: Lists Curriculum Packs (`packsApi.listPacks({ includeArchived })`), toggles "Show archived", and lets a signed-in teacher archive or unarchive packs or click "Start Game with Pack". The pack list does not say which packs are System Packs (open question (a)).
     - `PackDetailPage.tsx`: Displays a Curriculum Pack's `boardConfig`, **Semantic Domains**, **Keyword Cards**, **Adjudication Rubric**, assessment questions, and survey items (`perceptionSurvey.items`, may be `null`) (`packsApi.getPackById`).
     - `PackEditorPage.tsx`: Form/JSON editor to dry-run validate (`packsApi.validatePack`) and publish a new Curriculum Pack or new **Pack Version** (`packsApi.registerPack`), displaying any validation errors/warnings.
   - **`game-session/`** (`/setup` and `/sessions/:sessionId`):
     - `GameSetupPage.tsx`: Signed-in teacher picks a Curriculum Pack, mode (`classroom` or `solo`; `study-rct` is open question (b)), adjudication mode (`peer-instructor`, `ai`, `hybrid`), and per-phase timer durations (or instructor-driven `null`), calls `sessionsApi.createSession`, and enters `/sessions/:sessionId`.
     - `SessionShellPage.tsx`: The single parent state owner for `/sessions/:sessionId`. Polls `sessionsApi.getSessionState(sessionId)` every 2 seconds, renders the instructor control bar (`Advance Phase`, `+1 Min Extend`, `End Session`) or learner `Leave Session` button, and switches automatically between the phase views on `state.currentPhase` (with `state.activeRoundNumber`, `1`, `2` or `null`, for the round views):
       - `LobbyView.tsx`: Shows the 6-character `roomCode`, live `participants` roster (each with `leftAt`, so active vs. departed learners), and session settings.
       - `AssessmentView.tsx`: Renders the Curriculum Pack's MCQ questions for `pretest` and `posttest` with explicit `"I don't know"` (**Uncertainty Calibration**) option buttons, calls `sessionsApi.submitAssessment`, and displays the immediate score & Uncertainty Calibration summary.
       - `OrientationView.tsx`: Renders the Curriculum Pack's **Calibration Examples** and board orientation before Round 1 begins.
       - `ChainMappingView.tsx`: Renders the server-dealt `state.activeBoard` grid of **Keyword Cards**, uses `domain/chain-path.ts` to highlight adjacent selectable cells as the learner builds a path, collects `narrativeExplanation` and `stepRationales`, calls `sessionsApi.submitChain`, and lists the learner's submitted chains for the active round.
       - `AdjudicationView.tsx`: Polls `sessionsApi.listRoundChains(sessionId, roundNumber)` during `round-1:peer-adjudication` / `round-2:peer-adjudication`, lets learners cast `peer-approve` / `peer-reject` votes, and lets the supervising instructor issue an **Instructor Final Ruling** (`instructor-approve` / `instructor-reject` with `qualityScore` `1..10` and `feedback`) that locks the chain.
       - `RoundSummaryView.tsx`: Fetches and displays `sessionsApi.getRoundStandings(sessionId, roundNumber)`. Each `PlayerRoundStanding` has `rank`, `participantId`, `longestValidChainLength`, `totalValidChainsCount` and `approvedChainIds`. The learner's name comes from `state.participants`, matched by `participantId` (the contract's `displayName` on a standing is optional and nullable).
       - `SurveyView.tsx`: During `feedback-survey`, renders one Likert row (`1..5`) per item in the pack's `perceptionSurvey.items` (which may be `null`: then there is no survey to fill) and optional comments, and calls `sessionsApi.submitSurvey` with a `responses` map (item `id` → `1..5`).
       - `ResultsView.tsx`: Fetches `sessionsApi.getSessionAnalytics(sessionId)` during `completed` (or after posttest) and renders the learner's `participantReport` (Pretest vs. Posttest knowledge gain delta, guessing reduction delta, **Chain Diversity Index**, neglected cards) and the instructor's `cohortSummary` (including the **Board Neglect Heatmap** grid).

## User Stories

1. As a first-time React developer maintaining the project, I want `web/src/` split into three strict directories (`domain/`, `api/`, `features/`) enforced by `npm run lint:boundaries`, so that I always know where game rules, network calls, and React components live.
2. As a developer debugging an API refusal in the browser, I want every HTTP call to go through `web/src/api/http-client.ts` and render its `{ code, message, details }` inside a shared `ErrorBanner` component, so that domain error codes like `CHAIN_ALREADY_SUBMITTED` or `ACCOUNT_TEMPORARILY_LOCKED` are immediately visible on screen and in the console.
3. As a teacher visiting `/login`, I want to sign up or sign in with my email and password and have my 12-hour **Account Token** stored automatically, so that I can manage Curriculum Packs and start Classroom Games.
4. As a learner visiting `/login`, I want to enter a 6-character `roomCode` and my `displayName` to join a Classroom Game and immediately enter `/sessions/:sessionId` with my session **Capability Token**, so that I need no account to play.
5. As a solo learner, I want to start a Solo Practice Game Session from `/login` or `/setup` without signing in, so that I can practice clinical concept-chaining on my own.
6. As a signed-in teacher on `/packs`, I want to browse active Curriculum Packs, toggle `includeArchived`, inspect a pack's Keyword Cards and Adjudication Rubric on `/packs/:packId`, archive or unarchive non-system packs, and validate or register a new pack or Pack Version on `/packs/new`.
7. As a signed-in teacher on `/setup`, I want to choose a Curriculum Pack, configure phase timers (or mark phases as instructor-driven with no timer), and create a Classroom Game Session, receiving the `roomCode` and instructor seat automatically.
8. As an instructor or learner on `/sessions/:sessionId`, I want `SessionShellPage` to poll `GET /api/v1/sessions/:sessionId` every 2 seconds and automatically transition my screen whenever `state.currentPhase` changes, so that the entire class moves from Pretest to Round 1, Peer-Adjudication, Round 2, Posttest, Survey, and Results without manual page reloads.
9. As an instructor on `/sessions/:sessionId`, I want an instructor control bar to advance to the next phase, extend a timed phase by +60 seconds (`POST /phase/extend`), or end the session early (`POST /end`), while learners see only their phase view and a `Leave Session` button (`POST /leave`).
10. As a learner in `pretest` or `posttest`, I want to answer each multiple-choice question from the pack's `assessmentInstrument`—including the explicit *"I don't know"* option for **Uncertainty Calibration**—and see my submitted attempt confirmation and posttest knowledge gain report.
11. As a learner in `round-1:chain-mapping` or `round-2:chain-mapping`, I want to see the server-dealt `activeBoard` grid, click Chebyshev-8 adjacent **Keyword Cards** to build a **Concept Chain** (with non-adjacent cells disabled by `domain/chain-path.ts`), write my `narrativeExplanation` and optional `stepRationales`, and submit the chain to the server.
12. As a learner or instructor in `round-1:peer-adjudication` or `round-2:peer-adjudication`, I want to see the round's submitted Concept Chains (with author and voter display names), cast peer votes (`peer-approve` / `peer-reject`) as a learner, or issue a locking **Instructor Final Ruling** (`instructor-approve` / `instructor-reject` with score `1..10` and feedback) as the instructor.
13. As a learner or instructor in `round-1:round-summary` or `round-2:round-summary`, I want to view the round's leaderboard standings sorted by rank and longest valid Concept Chain length.
14. As a learner in `feedback-survey`, I want to rate each perception item of the pack's survey (`1..5`) and submit optional free-text comments.
15. As a learner or instructor in `completed`, I want to view the final metacognitive and gameplay analytics (`GET /api/v1/sessions/:sessionId/analytics`), including Pretest/Posttest deltas, **Chain Diversity Index**, and the 2D **Board Neglect Heatmap**.

## Implementation Decisions

- **Architecture decision record:** Follows **ADR-0008** (`docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md`).
- **Packages & build integration (done in react-web-setup 01–02):**
  - `web/` is a standalone package with its own `web/package.json` and lockfile. React, React Router, TanStack Query, Vite and the test libraries are its dependencies, not the root's.
  - The root runs it through `npm run dev:web`, `build:web`, `typecheck:web` and `lint:web` (`npm --prefix web ...`).
  - `web/vite.config.ts` builds to `web/dist`. In development Vite proxies `/api` to `netlify dev` on port 8888.
  - Serving `web/dist` from Netlify next to the API functions is issue 14.
  - `claudPoc/concept-chain/shared.css` is copied to `web/src/styles.css`, so every component uses the prototype's CSS design system.
- **Strict ban on `useEffect` (enforced by ESLint in `web/src/**`):**
  - `useEffect` (and `React.useEffect`) is banned across `web/src/**` via ESLint `no-restricted-imports` and `no-restricted-properties`:
    - **Server fetching & 2-second polling:** `useQuery` (`@tanstack/react-query`, with `refetchInterval: 2000` on `getSessionState` and `listRoundChains`).
    - **Writes & navigation:** Direct event handlers (`onClick`, `onSubmit`) / `useMutation` callbacks.
    - **Derived values:** Pure synchronous calculation during render using `web/src/domain/*`.
    - **Resetting local component state on phase/round transitions:** Keying child views by phase/round (`key={state.currentPhase}`, or `key={`${state.currentPhase}:${state.activeRoundNumber}`}` where a view spans rounds).
    - **1-second wall-clock countdown tick:** `useSyncExternalStore` backed by a tiny external ticker in `web/src/api/clock-store.ts`.
- **Boundary enforcement (`.dependency-cruiser.cjs`, already in place):**
  - Rules enforcing ADR-0008:
    - `web-domain-stays-pure`: `web/src/domain/**` cannot import from `web/src/api/**`, `web/src/features/**`, `react`, `react-dom`, or `react-router`.
    - `web-api-no-react-or-features`: `web/src/api/**` cannot import from `web/src/features/**` or `react`.

## Testing Decisions

- **What makes a good test (same seam as react-login-screen):**
  - **Rendered-screen tests (`web/tests/features/<area>/*.test.tsx`):** Render the route inside the real router and Query client with React Testing Library in jsdom, using `web/tests/support/render-app.tsx`. `fetch` is the fake from `web/tests/support/fake-fetch.ts`, answering per method and path with contract-shaped bodies; storage is real jsdom storage. Drive the screen as a user would (labelled fields, buttons by name) and assert on what they see, on the requests the contract requires (path, method, `Authorization`), and on what is left in storage. Header attachment, `ApiHttpError` parsing and token isolation are proved this way, not by separate `api/` unit tests.
  - **UI Domain unit tests (`web/tests/domain/*.test.ts`):** Pure functions only. Test `chain-path.ts` (Chebyshev-8 adjacency, backtracking, duplicate cells, `minChainLength`), `phase-timer.ts` (countdown formatting, `null` instructor-driven deadlines, 5-second grace period), and `session-phase.ts` (all 11 phases mapped to views and role capabilities) with no DOM.
  - The web tests run as the `web` Vitest project, so the root `npm run test` runs them. `tests/web/web-architecture-guards.test.ts` (no `useEffect`, layer boundaries) must stay green.
  - **End-to-end verification:** `npm run typecheck:web`, `lint:web`, `lint:boundaries` and `build:web` clean, then check the screens by hand against `npm run dev:local` (with `VITE_API_KEY`) or `npm run dev:prototype` (no key).
- **Prior art:**
  - `web/tests/features/accounts/*.test.tsx` and `web/tests/support/` (the seam to copy);
  - `claudPoc/concept-chain/account-api.js` and `claudPoc/concept-chain/*.html` (visual layout and CSS classes);
  - `tests/functions/key-event-logs.test.ts` (full end-to-end API flow across sign-up, pack register, session create, join, phase transitions, chain submit, and adjudication).

## Out of Scope

- Deleting `claudPoc/` (keep `claudPoc/` intact so existing `tests/claudpoc-*` contract tests remain green).
- Server-Sent Events (`/stream`), which remain deferred per `decision-sse-stream-deferred.md` in favor of 2-second polling in `SessionShellPage`.
- Server-Side Rendering (Next.js).

## Open questions (need the user)

Not decided here. Each blocks part of a slice until the user answers.

- **(a) System Packs in the Pack Library (issue 03).** `CurriculumPackListItem` has no flag that marks a System Pack, so the library cannot hide the archive control for System Packs. Options: add a flag (for example `isSystemPack`) to the pack list in the API, or show **Archive** on every pack and explain the server's 403 `PACK_IS_SYSTEM_PACK` when it comes back.
  **Decided by the user on 2026-11-27: add the flag.** A backend prefactor (`.scratch/react-packs/issues/00-system-pack-flag.md`) adds `isSystemPack` to the pack list and pack detail; the web hides Archive and "save as new version" for System Packs.
- **(b) `study-rct` mode (issue 05).** `SessionMode` is `solo`, `classroom` or `study-rct`. Does Game Setup offer `study-rct`, or is it out of scope for this UI?
- **(c) Solo Practice from `/login` (issue 13).** `createSession` needs a `packId` (the contract's default is `diabe-teach`). How does a signed-out learner pick a pack: a fixed default pack, a pack picker on `/login` (the pack list needs only the API key), or Solo Practice from `/setup` only?

## Further Notes

- **Decision record:** `docs/adr/0008-simple-three-layer-ddd-react-vite-frontend.md`.
- **Glossary:** All component names, labels, and domain helpers use `GLOSSARY.md` terms (`CurriculumPack`, `KeywordCard`, `SemanticDomain`, `GameSession`, `GameplayRound`, `ConceptChain`, `InstructorFinalRuling`, `AccountToken`, `CapabilityToken`, `AssessmentAttempt`, `UncertaintyCalibration`, `ChainDiversityIndex`, `BoardNeglectHeatmap`).
