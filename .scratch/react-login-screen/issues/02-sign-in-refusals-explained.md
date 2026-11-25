# 02: Sign-in refusals are explained, with focus on the field to fix

**What to build:** When sign-in fails, the teacher reads a plain sentence (announced to screen readers) and the cursor lands in the field to fix, using the prototype's wording: "Wrong email or password." for any 401 `INVALID_CREDENTIALS` (never revealing whether the email exists); the temporary-lock sentence with the local end time from `details.lockedUntil` for 423 `ACCOUNT_TEMPORARILY_LOCKED` (time omitted if unreadable); "Enter your email and password." for an empty field, without sending a request; and a "can't reach the API" sentence when `fetch` itself fails. Both buttons are disabled while a request is in flight. Every non-2xx response becomes a typed API error carrying the server's `code`, `message` and `details`, rendered by a reusable `ErrorBanner`.

**Blocked by:** 01 (Teacher signs in and lands on Game Setup)

**Status:** ready-for-agent

- [ ] Screen test: 401 `INVALID_CREDENTIALS` → "Wrong email or password." shown, focus on Password, no navigation, nothing stored.
- [ ] Screen test: 423 with `details.lockedUntil` → lock sentence including the local HH:MM; without it → sentence without a time.
- [ ] Screen test: empty email or password → "Enter your email and password.", focus on the empty field, fake `fetch` never called.
- [ ] Screen test: `fetch` rejects → network sentence pointing at `npm run dev:local`.
- [ ] Screen test: while the fake response is pending, **Sign in** and **Create account** are disabled; re-enabled after.
- [ ] The error-to-sentence-and-field mapping is a pure UI-domain rule (no React, no fetch).
