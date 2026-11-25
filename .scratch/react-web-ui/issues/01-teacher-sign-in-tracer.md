# 01: Tracer — teacher signs in / signs up through the real API

**Status:** ready-for-agent
**Blocked by:** none
**Detailed spec:** `.scratch/react-login-screen/spec.md` (supersedes the acceptance criteria below; test seam is the rendered LoginPage over a fake fetch).

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
