# 03: Teacher creates an Instructor Account

**What to build:** A new teacher types an email and a password and presses **Create account**; the Instructor Account is created, they are signed in at once (Account Token stored) and taken to Game Setup. A hint under the password field reads "At least 10 characters.". Before anything is sent, an email not shaped like an email or a password under 10 characters is refused with the matching sentence and focus on that field. If the email already has an account (409 `EMAIL_ALREADY_REGISTERED`) the teacher reads "That email is already registered. Sign in instead." with focus on Email. A 400 `INVALID_REQUEST_BODY` from the server is explained using `details.field`.

**Blocked by:** 02 (Sign-in refusals are explained, with focus on the field to fix)

**Status:** ready-for-agent

- [ ] Screen test: fake `fetch` answers 201 `AccountTokenResponse` to `POST /api/v1/accounts/sign-up` → lands on `/setup`, Account Token stored.
- [ ] Screen test: password of 9 characters → "Password too short: use at least 10 characters.", focus on Password, no request sent.
- [ ] Screen test: malformed email → email sentence, focus on Email, no request sent.
- [ ] Screen test: 409 `EMAIL_ALREADY_REGISTERED` → "That email is already registered. Sign in instead.", focus on Email.
- [ ] Screen test: 400 `INVALID_REQUEST_BODY` with `details.field` → sentence for that field and focus on it.
- [ ] Manually verified: create an account against `npm run dev:local`.
