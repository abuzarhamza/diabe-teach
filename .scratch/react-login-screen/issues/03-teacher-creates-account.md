# 03: Teacher creates an Instructor Account

**What to build:** A new teacher types an email and a password and presses **Create account**; the Instructor Account is created, they are signed in at once (Account Token stored) and taken to Game Setup. A hint under the password field reads "At least 10 characters.". Before anything is sent, an email not shaped like an email or a password under 10 characters is refused with the matching sentence and focus on that field. If the email already has an account (409 `EMAIL_ALREADY_REGISTERED`) the teacher reads "That email is already registered. Sign in instead." with focus on Email. A 400 `INVALID_REQUEST_BODY` from the server is explained using `details.field`.

**Blocked by:** 02 (Sign-in refusals are explained, with focus on the field to fix)

**Status:** done

- [x] Screen test: fake `fetch` answers 201 `AccountTokenResponse` to `POST /api/v1/accounts/sign-up` → lands on `/setup`, Account Token stored.
- [x] Screen test: password of 9 characters → "Password too short: use at least 10 characters.", focus on Password, no request sent.
- [x] Screen test: malformed email → email sentence, focus on Email, no request sent.
- [x] Screen test: 409 `EMAIL_ALREADY_REGISTERED` → "That email is already registered. Sign in instead.", focus on Email.
- [x] Screen test: 400 `INVALID_REQUEST_BODY` with `details.field` → sentence for that field and focus on it.
- [x] Manually verified: create an account against `npm run dev:local`.

## Comments

- All criteria met. The email sentence ("Enter a valid email address, like name@school.org.") is the prototype's `checkCredentials` wording; the ticket did not name one. `INVALID_REQUEST_BODY` maps `details.field` `email`/`password` to the same sentences the pre-checks use (one table in `web/src/domain/login-errors.ts`); any other field falls back to the server's message with no focus.
- The local email check uses the server's own shape (`src/domain/instructor-account/account-email.ts`), not the prototype's `x@y.z` regex: the latter fails `lint:web` (`regexp/no-super-linear-backtracking`). The server's is slightly stricter (no empty labels such as `a@b..c`).
- The password input keeps `autocomplete="current-password"` (ticket 01 test); sign-up shares the same field.
- Manual (dev:prototype, no VITE_API_KEY, Chrome): 8-character password refused locally with focus on Password; a new account created (`[API] POST /api/v1/accounts/sign-up -> 201`, landed on /setup, token stored); the same email again, re-cased and padded, gave 409 "That email is already registered. Sign in instead." with focus on Email and nothing stored.
