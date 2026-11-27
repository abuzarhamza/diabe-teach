# 01: Tracer — teacher signs in / signs up through the real API

**Status:** done
**Blocked by:** none
**Detailed spec:** `.scratch/react-login-screen/spec.md` (supersedes the acceptance criteria below; test seam is the rendered LoginPage over a fake fetch).

> **Superseded (2026-11-27):** built as `.scratch/react-login-screen/` 01–06: `9ecbf41` (01 sign in), `09a8594` (02 refusals), `50ed5d2` (03 create account), `ea0f068` (04 signed-in panel and sign out), `95b686b` (05 signed-out teachers sent to login), `5efbd2c` (06 named hooks; only `*-hooks.ts` import TanStack Query). `d2c2a42` added the signed-in teacher and Sign out to the TopBar. The real files are `web/src/api/{account-token-store,login-reason-store,http-client,accounts-api}.ts`, and the tests are rendered-screen tests in `web/tests/features/` over `web/tests/support/`. The text below is the original plan, kept for history.

**What to build:** The thinnest end-to-end slice through all three layers, proving the architecture:
- `web/src/api/http-client.ts` — `apiRequest()` (JSON headers, optional `x-api-key`, explicit `Authorization: Bearer`, `[API] METHOD path -> status` dev log, throws typed `ApiHttpError {status, code, message, details}`).
- `web/src/api/token-store.ts` — Account Token only for now (`save/read/clear`, expiry-aware).
- `web/src/api/accounts-api.ts` — `signUpInstructor`, `signInInstructor`, `getCurrentAccount`.
- `features/shared/ErrorBanner.tsx`, `features/shared/TopBar.tsx` (signed-in email + Sign out).
- `features/accounts/LoginPage.tsx` at `/login` (Sign in / Sign up), using `useMutation`; on success navigate to `/setup` (placeholder page).
- `App.tsx` → `react-router` routes + `QueryClientProvider`.

## Acceptance criteria
- [ ] `tests/web/api/http-client.test.ts`: mocked `fetch` proves header attachment and `ApiHttpError` parsing for 400/401/409/423.
- [ ] `tests/web/api/token-store.test.ts`: save/read/clear, expired token reads as absent.
- [ ] Wrong password shows `ErrorBanner` with the server `code` (e.g. `INVALID_CREDENTIALS`); lockout shows `ACCOUNT_TEMPORARILY_LOCKED`.
- [ ] Reload after sign-in keeps the teacher signed in (`getCurrentAccount`).
- [ ] `npm run typecheck:web`, `npm run lint:web`, `npm run lint:boundaries`, `npm run build:web` all clean.
- [ ] Manually verified against `npm run dev:local`.
