# Spec: Teacher Login screen in the React web app

**Status:** ready-for-agent

## Problem Statement

A teacher who wants to manage Curriculum Packs or start a Classroom Game must first prove which Instructor Account they are. Today that screen exists only as the static prototype page in `claudPoc/` (Teacher login), wired to the real API through a hand-written browser script. The React web app (ADR-0008) has no login screen at all: it renders a placeholder, so no teacher can sign up, sign in, stay signed in across reloads, or sign out in the production UI, and every later teacher screen (Game Setup, Pack Library, Pack Editor) has nothing to stand on.

## Solution

The React web app gets a Teacher Login screen at `/login` that behaves like the approved prototype and looks like it (same design system):

- A teacher types an email and a password and either **signs in** to an existing Instructor Account or **creates an account** (sign-up signs them in at once).
- On success they receive a 12-hour **Account Token**, which the app keeps in the browser, and are taken to Game Setup.
- If they are already signed in when they open `/login`, they see "Signed in as <email>" with **Continue to Game setup** and **Sign out**, instead of the form.
- Every refusal is shown as a plain sentence beside the form, with the cursor placed in the field to fix: wrong email or password, email already registered, password too short, sign-in temporarily locked (with the time the lock ends), API unreachable.
- When another teacher screen sends them back because their Account Token is missing, expired or refused by the server, the login screen explains why ("Your sign-in has expired. Sign in again.").
- A footer reminds learners that they do not sign in: they join with a room code.

## User Stories

1. As a teacher, I want to open `/login` and see an email field, a password field, a **Sign in** button and a **Create account** button, so that I know how to get into the app.
2. As a teacher, I want to sign in with my email and password, so that I can manage Curriculum Packs and start Classroom Games.
3. As a teacher, I want pressing Enter in the form to sign in, so that I don't have to reach for the mouse.
4. As a new teacher, I want to create an Instructor Account with my email and a password, so that I can start using the app without an invitation or verification email.
5. As a new teacher, I want sign-up to sign me in straight away, so that I don't have to type my credentials twice.
6. As a teacher, I want to be taken to Game Setup after signing in or signing up, so that I can start my class without extra clicks.
7. As a teacher, I want the app to remember my sign-in when I reload the page or open a new tab, so that I don't have to sign in again during a lesson.
8. As a teacher, I want my sign-in to stop working once the 12-hour Account Token expires, so that a borrowed classroom computer doesn't stay signed in forever.
9. As a teacher who is already signed in, I want `/login` to show "Signed in as <my email>" with **Continue to Game setup**, so that I can carry on instead of signing in again.
10. As a teacher, I want a **Sign out** button, so that I can leave a shared classroom computer safely.
11. As a teacher who signs out, I want the form to reappear with the cursor in the email field, so that another teacher can sign in right away.
12. As a teacher who signs out in one tab, I want other open tabs to show me as signed out too, so that I'm not misled about my state.
13. As a teacher who types the wrong email or password, I want to see "Wrong email or password." with the cursor in the password field, so that I can retry quickly.
14. As a teacher, I want the same message for an unknown email and a wrong password, so that the screen never reveals which emails have accounts (matching the API).
15. As a teacher signing up with an email that already has an Instructor Account, I want to see "That email is already registered. Sign in instead." with the cursor in the email field, so that I know to sign in.
16. As a teacher signing up with a password under 10 characters, I want to see "Password too short: use at least 10 characters." before anything is sent, so that I fix it at once.
17. As a teacher, I want a hint under the password field saying "At least 10 characters.", so that I know the rule before I make a mistake.
18. As a teacher signing up with something that isn't shaped like an email, I want a clear message with the cursor in the email field, so that I can correct the typo.
19. As a teacher who leaves email or password empty when signing in, I want "Enter your email and password." with the cursor in the empty field, so that I don't wait for a pointless request.
20. As a teacher who has typed five wrong passwords in a row, I want to be told sign-in is temporarily locked and until what local time, so that I know when to try again.
21. As a teacher whose account is locked, I want the right password to also be refused until the lock ends, with the same explanation, so that the behaviour is predictable.
22. As a teacher, I want both buttons disabled while a request is in flight, so that I can't send duplicate sign-ins or create two accounts by double-clicking.
23. As a teacher, I want a clear message when the API cannot be reached, so that I (or the developer) know to start the local server rather than thinking my password is wrong.
24. As a teacher sent back to `/login` from another teacher screen because I wasn't signed in, I want to read "Sign in to continue.", so that I understand why I'm here.
25. As a teacher sent back because my Account Token expired or the server refused it, I want to read why, so that I'm not confused about losing my place.
26. As a teacher, I want that explanation shown only once, so that it doesn't linger after I've read it and reloaded.
27. As a teacher, I want my email to be trimmed and treated case-insensitively, so that " Rahman.S@AKU.edu " signs in the same account as "rahman.s@aku.edu".
28. As a teacher, I want the browser's password manager to offer my saved credentials, so that signing in is fast (correct `autocomplete` hints).
29. As a teacher using a screen reader, I want error messages announced and each field properly labelled, so that I can sign in without seeing the screen.
30. As a learner who lands on `/login` by mistake, I want a note telling me learners don't sign in and pointing me to joining with a room code, so that I don't try to create an account.
31. As a teacher, I want the login screen to look like the approved prototype (brand header, panel, buttons, fonts), so that the production app feels familiar.
32. As a developer debugging sign-in, I want each API call logged in development as `[API] METHOD path -> status`, so that I can see what happened without opening the network tab.
33. As a developer, I want every refusal to carry the server's `code`, `message` and `details`, so that the screen and logs show exactly which domain error occurred.
34. As a developer building later teacher screens, I want one shared way to read the signed-in teacher and to send them back to `/login` with a reason, so that every teacher screen guards itself the same way.
35. As a developer, I want the Account Token never to be sent where a Capability Token is expected (and vice versa), so that the app respects ADR-0007.

## Implementation Decisions

- **Architecture:** Follows ADR-0008's three layers. Pure rules go in the UI domain layer, all `fetch` and browser-storage access in the API layer, and React screens in features. No `useEffect` anywhere. Server writes use TanStack Query `useMutation` from event handlers. Navigation happens in the mutation's success callback. Derived values (which panel to show, which field to focus) are computed during render.
- **Routing and app shell:** The app gets `react-router` routes and a TanStack Query client provider. `/login` renders the Login screen. `/setup` exists as a placeholder for teachers only (its real content belongs to the Game Setup spec). Unknown routes redirect to `/login`.
- **HTTP client (API layer):** A single typed request function that sends JSON, takes an optional `x-api-key` from build-time config (absent in local dev, as in `dev:prototype`) and adds `Authorization: Bearer <token>` only when the caller names the token kind. Any non-2xx `ApiErrorResponse { code, message, details }` becomes a typed `ApiHttpError { status, code, message, details }`. A failed `fetch` becomes `ApiHttpError` with code `NETWORK_ERROR` and status `0`. In development it logs `[API] METHOD path -> status`. Later specs reuse this client for every route.
- **Account Token store (API layer):** Saves `{ accountId, email, accountToken, expiresAt }` from `AccountTokenResponse` in `localStorage` under its own key. The prototype's key name can be reused so a teacher signed in on the prototype stays signed in. A stored token that is missing, malformed or past `expiresAt` reads as "not signed in". Sign out removes it. The store exposes a subscribe function for the browser `storage` event, so the screen can read it with `useSyncExternalStore` and changes in other tabs show up. Capability Tokens are out of scope here, but the store must keep the Account Token under a separate key so the two can never be confused (ADR-0007).
- **"Why you were sent here" message (API layer):** A one-shot message in `sessionStorage`. A teacher-screen guard sets it ("Sign in to continue." / "Your sign-in has expired. Sign in again." / "Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.") and the Login screen reads it once and clears it. A 401 on any Account-Token request clears the token, sets this message and sends the browser to `/login`.
- **Accounts API (API layer):** `signUpInstructor(email, password)` calls `POST /api/v1/accounts/sign-up` (201) and `signInInstructor(email, password)` calls `POST /api/v1/accounts/sign-in` (200). Both return `AccountTokenResponse` and save it. `getCurrentAccount()` calls `GET /api/v1/accounts/me` with the Account Token and returns `InstructorAccountView`. The email is trimmed before sending; the server lower-cases it.
- **Credential pre-checks (UI domain, pure):** Sign-up rejects locally an email that isn't shaped like `x@y.z` (field `email`) and a password under 10 characters (field `password`). Sign-in only rejects an empty email or password locally ("Enter your email and password."). It applies no email or password rules, because the API answers anything else with the same 401 `INVALID_CREDENTIALS`.
- **Error to message mapping (UI domain, pure):** One function turns an `ApiHttpError` into `{ sentence, focusField }`:
  - `INVALID_CREDENTIALS` → "Wrong email or password.", focus the password field.
  - `EMAIL_ALREADY_REGISTERED` → "That email is already registered. Sign in instead.", focus the email field.
  - `ACCOUNT_TEMPORARILY_LOCKED` → "Too many wrong passwords: sign-in is temporarily locked until HH:MM. Try again later.", with the local time taken from `details.lockedUntil` and the "until" part left out if that time is missing or can't be read. Focus the password field.
  - `INVALID_REQUEST_BODY` → the message for `details.field`, focusing that field.
  - `NETWORK_ERROR` → "Can't reach the API. Start it with `npm run dev:local`."
  - Anything else → the server's `message`.

  This copies the prototype's wording so both screens say the same thing.
- **Login screen (features):** It shows one of two panels, chosen from the Account Token store: a signed-in panel (email, **Continue to Game setup**, **Sign out**) or the form. Submitting the form signs in and the **Create account** button signs up. Both buttons are disabled while a mutation is pending. Errors are shown in an `aria-live` status region, and focus moves to the field the error names. The one-shot message appears as a warning alert above the form. Inputs use the prototype's limits and hints (`maxLength` 254 and 1024, `autocomplete="username"` / `current-password`, `required`, password hint). The layout reuses the prototype's `.login`, `.field`, `.panel`, `.brand`, `.btn` and `.toast` styles, added to the shared stylesheet.
- **Shared components (features/shared):** An `ErrorBanner` that renders an `ApiHttpError` (sentence, plus the code in development) is built here for later screens to reuse. A teacher route guard reads the Account Token store, and when no valid token exists it sets the one-shot message and redirects to `/login`. The `/setup` placeholder uses it.
- **No new backend work:** The accounts routes and their contract already exist and are not changed.

## Testing Decisions

- **What makes a good test:** It drives the screen the way a teacher would (types into labelled fields, clicks buttons by their visible names) and asserts only on what the teacher sees (text, focus, disabled state, the page they end up on) and on what is left in browser storage. It never asserts on component internals, hook calls or the wording of request bodies beyond what the API contract requires.
- **One seam: the rendered Login screen over a fake `fetch`.** The Login route is rendered inside the real router and the real Query client with React Testing Library in jsdom. `fetch` is replaced by a fake that answers per method and path with contract-shaped responses (`AccountTokenResponse`, `InstructorAccountView`, `ApiErrorResponse`), and `localStorage` / `sessionStorage` are real jsdom storage, cleared between tests. Scenarios:
  - sign in with valid credentials → route `/setup` and Account Token stored;
  - sign up → 201 → `/setup`;
  - 401 `INVALID_CREDENTIALS` → "Wrong email or password." and focus on password;
  - 409 `EMAIL_ALREADY_REGISTERED` → message and focus on email;
  - 423 with `details.lockedUntil` → lock message with local time;
  - short password on sign-up → message shown and no request sent;
  - empty fields on sign-in → no request sent;
  - `fetch` rejects → network message;
  - buttons disabled while the request is pending;
  - stored valid token → signed-in panel with email, and **Sign out** clears storage and shows the form with focus on email;
  - expired stored token → form shown;
  - one-shot message in `sessionStorage` → shown once, then cleared;
  - visiting `/setup` with no token → redirected to `/login` with "Sign in to continue.".
- **New test setup this needs:** `@testing-library/react`, `@testing-library/user-event` and `jsdom` as dev dependencies of the standalone `web/` package, and a Vitest configuration for `web/` (jsdom environment, `.tsx` tests) that the root test run also picks up. That way `npm run test` still runs everything and the backend's node-environment tests are untouched.
- **Prior art:** `tests/claudpoc-account-api.test.ts` covers the prototype's account client with stubbed storage and `fetch`. The new tests should cover the same scenarios one level higher, through the screen. Existing `tests/web/web-architecture-guards.test.ts` must stay green (no `useEffect`, layer boundaries).
- **Also required to pass:** `npm run typecheck:web`, `npm run lint:web` (0 errors, 0 warnings), `npm run lint:boundaries`, `npm run build:web`, and a manual sign-up, sign-in and sign-out against `npm run dev:local`.

## Out of Scope

- Learner Quick Join (room code + display name) and Solo Practice quick start: they need the Capability Token seat and the Session Shell, and belong to the learner-join slice of the React web UI spec.
- The real Game Setup, Pack Library and Pack Editor screens: `/setup` is only a guarded placeholder here.
- Password reset, email verification, changing the email or password, and "remember me" beyond the 12-hour token: the API has none of these.
- Any change to the accounts API, its contract or the `claudPoc/` prototype (the prototype and its contract tests stay as they are).
- Netlify production wiring for the SPA (publish folder, SPA fallback): a separate slice.

## Further Notes

- Decision records: ADR-0007 (Instructor Accounts; the Account Token is never interchangeable with a Capability Token) and ADR-0008 (three-layer React + Vite frontend, no `useEffect`).
- Glossary terms used: **Instructor Account**, **Account Token**, **Capability Token**, **Curriculum Pack**, **Classroom Game**, **Game Session**.
- This spec details slice `01` of `.scratch/react-web-ui/` (teacher sign-in tracer) and supersedes that issue's acceptance criteria, which assumed a node-only test seam.
- The prototype's behaviour (wording, focus rules, one-shot message, `storage` event sync) comes from `claudPoc/concept-chain/login.html` and `account-api.js`.
