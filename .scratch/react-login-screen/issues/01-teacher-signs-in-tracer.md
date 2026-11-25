# 01: Teacher signs in and lands on Game Setup (tracer)

**What to build:** A teacher opens `/login` in the React web app, types the email and password of an existing Instructor Account, presses **Sign in** (or Enter), and arrives at the Game Setup placeholder, still signed in after a reload because the 12-hour Account Token is kept in the browser. The screen looks like the approved prototype's Teacher login (brand header, panel, fields, buttons) and carries the footer telling learners they join with a room code instead. This tracer also sets up the shell later tickets need: router and Query client, the single HTTP client (with the `[API] METHOD path -> status` development log), the Account Token store, and the test harness that renders the Login screen in jsdom over a fake `fetch`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `/login` shows labelled Email and Password fields (prototype limits and `autocomplete` hints), **Sign in** and **Create account** buttons, and the learner footer note.
- [x] Valid sign-in calls `POST /api/v1/accounts/sign-in` with a trimmed email, saves `{ accountId, email, accountToken, expiresAt }` in `localStorage` under its own key, and navigates to `/setup`.
- [x] Unknown routes redirect to `/login`; `/setup` renders a placeholder.
- [x] The web package has a jsdom Vitest setup (React Testing Library + user-event) that the root `npm run test` also runs, without changing backend tests' node environment.
- [x] Screen test: fake `fetch` answers 200 `AccountTokenResponse` → user types and clicks **Sign in** → lands on `/setup` and the Account Token is stored.
- [x] No `useEffect`; `npm run typecheck:web`, `npm run lint:web` (0 errors/warnings), `npm run lint:boundaries`, `npm run build:web` pass; `tests/web/web-architecture-guards.test.ts` stays green.
- [x] Manually verified: sign in against `npm run dev:local`.

## Comments

- **2026-11-25 (implementation):** All criteria met. Notes for later tickets:
  - Vitest's built-in `jsdom` environment imports `jsdom` from the root `node_modules`, but `jsdom` is a `web/` dependency only. `web/tests/support/jsdom-environment.ts` is a small custom environment (same approach as the built-in one, via `populateGlobal`) that loads `jsdom` from `web/`. The root `vitest.config.ts` now has a workspace: `api` (inherits the root node settings via `extends: true`) and `web` (`web/vitest.config.ts`).
  - Web tests live in `web/tests/` (included in `typecheck:web`; `lint:web` now lints `src tests`).
  - `dev:local` enforces `x-api-key`, so run Vite with `VITE_API_KEY=<api_key from .env.dev.yaml> npm run dev:web` (or use `dev:prototype`, which turns the key check off).
  - **Create account** is rendered but not wired (ticket 03). The status region only shows the server's raw `message` for now; the mapped sentences and focus rules are ticket 02.
  - Manual check: account signed up via curl on :8888; signed in through the real UI at http://localhost:5173/login (padded email, Enter) → `/setup`, token stored under `cc-account-token-v1`, console showed `[API] POST /api/v1/accounts/sign-in -> 200`.
