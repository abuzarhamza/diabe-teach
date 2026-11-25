# 02: Sign-in refusals are explained, with focus on the field to fix

**What to build:** When sign-in fails, the teacher reads a plain sentence (announced to screen readers) and the cursor lands in the field to fix, using the prototype's wording: "Wrong email or password." for any 401 `INVALID_CREDENTIALS` (never revealing whether the email exists); the temporary-lock sentence with the local end time from `details.lockedUntil` for 423 `ACCOUNT_TEMPORARILY_LOCKED` (time omitted if unreadable); "Enter your email and password." for an empty field, without sending a request; and a "can't reach the API" sentence when `fetch` itself fails. Both buttons are disabled while a request is in flight. Every non-2xx response becomes a typed API error carrying the server's `code`, `message` and `details`, rendered by a reusable `ErrorBanner`.

**Blocked by:** 01 (Teacher signs in and lands on Game Setup)

**Status:** done

- [x] Screen test: 401 `INVALID_CREDENTIALS` → "Wrong email or password." shown, focus on Password, no navigation, nothing stored.
- [x] Screen test: 423 with `details.lockedUntil` → lock sentence including the local HH:MM; without it → sentence without a time.
- [x] Screen test: empty email or password → "Enter your email and password.", focus on the empty field, fake `fetch` never called.
- [x] Screen test: `fetch` rejects → network sentence pointing at `npm run dev:local`.
- [x] Screen test: while the fake response is pending, **Sign in** and **Create account** are disabled; re-enabled after.
- [x] The error-to-sentence-and-field mapping is a pure UI-domain rule (no React, no fetch).

## Comments

- Done in `web/src/domain/login-errors.ts` (`loginErrorView`, `signInCredentialsProblem`), `web/src/features/shared/ErrorBanner.tsx`, and `LoginPage.tsx`. The screen tests are in `web/tests/features/accounts/login-refusals.test.tsx`. The fake `fetch` can now hold a reply pending or reject it (`"network-error"`).
- The mapping covers only this ticket's codes (`INVALID_CREDENTIALS`, `ACCOUNT_TEMPORARILY_LOCKED`, `NETWORK_ERROR`). Any other code falls back to the server's `message`, with no focus. Ticket 03 adds `EMAIL_ALREADY_REGISTERED` and `INVALID_REQUEST_BODY`.
- The lock time is always 24-hour `HH:MM` local time (from `getHours`/`getMinutes`). The prototype uses `toLocaleTimeString`, which may show AM/PM. The wording is otherwise the same.
- `ErrorBanner` shows the API `code` next to the sentence in development only (`import.meta.env.DEV`).
- The password input is now styled like the email input (`styles.css`), which was a backlog item from ticket 01.
- Manual check (`dev:prototype`, no `VITE_API_KEY`, via `dev:web` on :5173):
  - In Chrome: an empty field gave the empty-field sentence with focus on Email; a wrong password gave "Wrong email or password." with focus on Password; a locked account gave "...locked until 13:25..." (`lockedUntil` 19:25Z). Nothing was stored.
  - With curl: the 5th wrong password already returns 423, not 401.
- **Not met in the running app:** with the API stopped, Vite's dev proxy answers an empty **500** (ECONNREFUSED), so `fetch` does not reject. The screen therefore shows "Request failed (500).", not the network sentence. The screen test (where `fetch` rejects) passes. Follow-up: treat a proxy 5xx with no body as `NETWORK_ERROR`, or configure the Vite proxy's error handler to fail the connection instead.
