# 01: Teacher signs in and lands on Game Setup (tracer)

**What to build:** A teacher opens `/login` in the React web app, types the email and password of an existing Instructor Account, presses **Sign in** (or Enter), and arrives at the Game Setup placeholder, still signed in after a reload because the 12-hour Account Token is kept in the browser. The screen looks like the approved prototype's Teacher login (brand header, panel, fields, buttons) and carries the footer telling learners they join with a room code instead. This tracer also sets up the shell later tickets need: router and Query client, the single HTTP client (with the `[API] METHOD path -> status` development log), the Account Token store, and the test harness that renders the Login screen in jsdom over a fake `fetch`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `/login` shows labelled Email and Password fields (prototype limits and `autocomplete` hints), **Sign in** and **Create account** buttons, and the learner footer note.
- [ ] Valid sign-in calls `POST /api/v1/accounts/sign-in` with a trimmed email, saves `{ accountId, email, accountToken, expiresAt }` in `localStorage` under its own key, and navigates to `/setup`.
- [ ] Unknown routes redirect to `/login`; `/setup` renders a placeholder.
- [ ] The web package has a jsdom Vitest setup (React Testing Library + user-event) that the root `npm run test` also runs, without changing backend tests' node environment.
- [ ] Screen test: fake `fetch` answers 200 `AccountTokenResponse` → user types and clicks **Sign in** → lands on `/setup` and the Account Token is stored.
- [ ] No `useEffect`; `npm run typecheck:web`, `npm run lint:web` (0 errors/warnings), `npm run lint:boundaries`, `npm run build:web` pass; `tests/web/web-architecture-guards.test.ts` stays green.
- [ ] Manually verified: sign in against `npm run dev:local`.
