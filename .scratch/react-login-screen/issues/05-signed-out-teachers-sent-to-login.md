# 05: Teacher screens send signed-out teachers back to login with a reason

**What to build:** A teacher who opens a teacher-only screen (the `/setup` placeholder) without a valid Account Token is sent to `/login`, which explains why once: "Sign in to continue." when there was no token, "Your sign-in has expired. Sign in again." when it had expired. When the server refuses the Account Token (401 on `GET /api/v1/accounts/me`, which `/setup` calls to confirm the teacher), the token is cleared and the teacher lands on `/login` reading "Your sign-in was not accepted (expired or signed out elsewhere). Sign in again.". The reason is shown as a warning alert above the form and disappears after a reload. Later teacher screens reuse the same guard.

**Blocked by:** 04 (Signed-in panel and Sign out)

**Status:** ready-for-agent

- [ ] Screen test: visit `/setup` with no token → on `/login` with "Sign in to continue.".
- [ ] Screen test: visit `/setup` with an expired token → on `/login` with the expired sentence.
- [ ] Screen test: valid-looking token but fake `fetch` answers 401 to `/accounts/me` → token cleared, on `/login` with the "not accepted" sentence.
- [ ] Screen test: valid token and 200 `InstructorAccountView` → `/setup` placeholder stays.
- [ ] Screen test: the reason is shown once; re-rendering `/login` afterwards shows no alert.
- [ ] Manually verified: delete or tamper with the token in DevTools and reload `/setup` on `npm run dev:local`.
