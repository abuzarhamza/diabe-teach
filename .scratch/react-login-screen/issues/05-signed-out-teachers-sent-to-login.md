# 05: Teacher screens send signed-out teachers back to login with a reason

**What to build:** A teacher who opens a teacher-only screen (the `/setup` placeholder) without a valid Account Token is sent to `/login`, which explains why once: "Sign in to continue." when there was no token, "Your sign-in has expired. Sign in again." when it had expired. When the server refuses the Account Token (401 on `GET /api/v1/accounts/me`, which `/setup` calls to confirm the teacher), the token is cleared and the teacher lands on `/login` reading "Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.". The reason is shown as a warning alert above the form and disappears after a reload. Later teacher screens reuse the same guard.

**Blocked by:** 04 (Signed-in panel and Sign out)

**Status:** done

- [x] Screen test: visit `/setup` with no token → on `/login` with "Sign in to continue.".
- [x] Screen test: visit `/setup` with an expired token → on `/login` with the expired sentence.
- [x] Screen test: valid-looking token but fake `fetch` answers 401 to `/accounts/me` → token cleared, on `/login` with the "not accepted" sentence.
- [x] Screen test: valid token and 200 `InstructorAccountView` → `/setup` placeholder stays.
- [x] Screen test: the reason is shown once; re-rendering `/login` afterwards shows no alert.
- [x] Manually verified: delete or tamper with the token in DevTools and reload `/setup` on `npm run dev:local`.

## Comments

- All criteria met. Screen tests: `web/tests/features/accounts/teacher-guard.test.tsx` (9 tests: the five above, plus a malformed token reading as "Sign in to continue.", no alert on a plain `/login`, and the two expiry-while-open cases below). The 01/03 sign-in/sign-up tests now expect Game Setup's `GET /accounts/me` after the POST; the unguarded "/setup placeholder" test now stores a token.
- Guard: teacher screens are children of one pathless route with `loader: requireTeacher` (`web/src/features/shared/require-teacher.ts`) and element `TeacherRoute` (`web/src/features/shared/TeacherRoute.tsx`). The loader sets the reason (keeping a pending "not accepted") and redirects; `TeacherRoute` confirms the teacher with `getCurrentAccount()` via `useQuery` (no retry on 401) and, when the signed-in teacher turns null, renders `<Navigate to={location} replace />` so the loader runs again and picks the reason. No `useEffect`.
- One-shot reason: `web/src/api/login-reason-store.ts` (sessionStorage key `cc-login-message-v1`, the prototype's sentences). `LoginPage` takes it once in a `useState` initializer (checked under StrictMode: the first call's result is kept) and shows it as a `role="alert"` warning above the form.
- 401 on any Account-Token request: `http-client.ts` sets "not accepted" and clears the token; the guard does the rest.
- Ticket 04 gap closed: `subscribeToStoredAccount` also arms a timer for the stored token's `expiresAt` (capped at setTimeout's maximum, re-armed), and the snapshot is now null for an expired/malformed token, so `/login` switches from the panel to the form and guarded pages go to `/login` with the expired sentence when the token expires while open.
- Manual (`dev:prototype`, no `VITE_API_KEY`, `dev:web`): `/setup` signed out -> `/login` "Sign in to continue."; reload -> no alert; created a throwaway test account -> `/setup`; tampered the token signature and reloaded -> `/login` "not accepted", token cleared; past `expiresAt` -> `/login` expired sentence. Non-401 `/me` failures (e.g. API down) show an `ErrorBanner` above the screen and keep it.
