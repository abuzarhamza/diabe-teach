# Teacher accounts

A teacher creates an Instructor Account with an email and a password, signs in again later to get a new Account Token, and reads their own profile. The API refuses wrong credentials without revealing which part was wrong, locks the account after repeated wrong passwords, and refuses a session Capability Token where an Account Token is required.

## Sub-features

- `account-sign-up` creates an account, normalises the email (trimmed, lower-cased) and returns an Account Token.
- `account-sign-up-duplicate` refuses a second sign-up for the same normalised email.
- `account-sign-up-invalid` refuses a password shorter than 10 characters.
- `account-sign-in` returns a new Account Token for the same account.
- `account-sign-in-refused` gives the same `INVALID_CREDENTIALS` answer for a wrong password and for an unknown email.
- `account-lockout` locks the account for 15 minutes on the 5th wrong password in a row.
- `account-me` returns the profile behind an Account Token.
- `account-me-token-kind` refuses a missing token and a session Capability Token on `/accounts/me`.
- `account-api-key` refuses an `/api/v1` call that has no `x-api-key`.

## How to get to it (user POV)

- `POST /api/v1/accounts/sign-up` with `{ "email", "password" }` (no bearer token).
- `POST /api/v1/accounts/sign-in` with `{ "email", "password" }` (no bearer token).
- `GET /api/v1/accounts/me` with `Authorization: Bearer <Account Token>`.
- Bruno: `docs/api/bruno/02-Instructor-Accounts/` (`vapi bruno teacher-accounts 02-Instructor-Accounts`), happy path only.

## Driving it with vapi

Preconditions:

- Baseline from the [README](./README.md), and `vapi doctor` printed `DOCTOR HEALTHY`.
- No account exists yet for `verify.teacher@example.edu` or `lock.teacher@example.edu`. Any new launch meets this.

- **Sign up (mixed-case email with spaces).** Run `vapi req teacher-accounts sign-up POST /api/v1/accounts/sign-up --json '{"email":"  Verify.Teacher@Example.edu ","password":"correct horse battery"}' --expect 201 --expect-field email=verify.teacher@example.edu --save accountToken=accountToken --save accountId=accountId`. The response is `201` with `{ accountId, email: "verify.teacher@example.edu", accountToken, expiresAt }`, and `expiresAt` is about 12 h later.
- **Duplicate sign-up.** Run `vapi req teacher-accounts sign-up-duplicate POST /api/v1/accounts/sign-up --json '{"email":"verify.teacher@example.edu","password":"another long password"}' --expect 409 --expect-code EMAIL_ALREADY_REGISTERED`. This proves the first account was stored under the normalised email.
- **Short password.** Run `vapi req teacher-accounts sign-up-short-password POST /api/v1/accounts/sign-up --json '{"email":"short.pw@example.edu","password":"short"}' --expect 400 --expect-code INVALID_REQUEST_BODY --expect-field details.field=password`.
- **Sign in.** Run `vapi req teacher-accounts sign-in POST /api/v1/accounts/sign-in --json '{"email":"verify.teacher@example.edu","password":"correct horse battery"}' --expect 200 --expect-field accountId={{accountId}} --save signInToken=accountToken`. The response is `200` for the same `accountId`.
- **Read profile with the sign-in token.** Run `vapi req teacher-accounts me GET /api/v1/accounts/me --auth signInToken --expect 200 --expect-field accountId={{accountId}} --expect-field email=verify.teacher@example.edu`. The response is `{ accountId, email, createdAt }`. This second view proves the account persisted.
- **Wrong password.** Run `vapi req teacher-accounts sign-in-wrong-password POST /api/v1/accounts/sign-in --json '{"email":"verify.teacher@example.edu","password":"not my password"}' --expect 401 --expect-code INVALID_CREDENTIALS`.
- **Unknown email.** Run `vapi req teacher-accounts sign-in-unknown-email POST /api/v1/accounts/sign-in --json '{"email":"nobody@example.edu","password":"correct horse battery"}' --expect 401 --expect-code INVALID_CREDENTIALS`. The `message` is identical to the wrong-password one, so an attacker cannot tell which emails have accounts.
- **Profile without a token.** Run `vapi req teacher-accounts me-no-token GET /api/v1/accounts/me --expect 401 --expect-code UNAUTHORIZED_TOKEN`.
- **Profile with a Capability Token.** Create a solo session to get a session token, then present it to `/me`. Run `vapi req teacher-accounts solo-session POST /api/v1/sessions --json '{"packId":"diabe-teach","mode":"solo","adjudicationMode":"peer-instructor"}' --expect 201 --save soloInstructorToken=instructorToken`, then `vapi req teacher-accounts me-capability-token GET /api/v1/accounts/me --auth soloInstructorToken --expect 401 --expect-code UNAUTHORIZED_TOKEN`.
- **Missing API key.** Run `vapi req teacher-accounts sign-in-no-api-key POST /api/v1/accounts/sign-in --no-key --json '{"email":"verify.teacher@example.edu","password":"correct horse battery"}' --expect 401 --expect-code UNAUTHORIZED_TOKEN`.
- **Lockout.** Run `vapi req teacher-accounts lock-sign-up POST /api/v1/accounts/sign-up --json '{"email":"lock.teacher@example.edu","password":"correct horse battery"}' --expect 201`. Then run `vapi req teacher-accounts lock-wrong-password POST /api/v1/accounts/sign-in --json '{"email":"lock.teacher@example.edu","password":"wrong password"}'` five times. Attempts 1 to 4 return `401 INVALID_CREDENTIALS`, and attempt 5 already returns `423 ACCOUNT_TEMPORARILY_LOCKED` with `details.lockedUntil` about 15 minutes ahead. Then run `vapi req teacher-accounts lock-correct-password POST /api/v1/accounts/sign-in --json '{"email":"lock.teacher@example.edu","password":"correct horse battery"}' --expect 423 --expect-code ACCOUNT_TEMPORARILY_LOCKED`: even the correct password is refused, with the same `lockedUntil`.
- **Proof.** `.verification/<run-id>/teacher-accounts/` holds one `PASS` file per bullet, in order (18 files: `01-sign-up` … `18-lock-correct-password`). The `sign-up`, `sign-in` and `me` files show the same `accountId`, and `dev-local.log` has a pino line for each request. This was proved end to end at `37e2b89` (run `proof-teacher-accounts`).

## Gotchas

- The email is normalised only on the way in. Assert the `email` the server returns, not the string you sent.
- The Bruno sign-up request uses a fixed email and accepts `201` or `409`, so it proves nothing on its second run. Use the `vapi` bullets above.
- The lockout bullets leave `lock.teacher@example.edu` locked for 15 minutes. Use a fresh email (or relaunch) when you repeat them on the same instance.
- Sign-up and sign-in take a few hundred ms each, because Argon2id hashing is deliberately slow. Don't treat that as a hang.
- A `solo` session needs no Account Token. Creating a `classroom` session without one returns `401 UNAUTHORIZED_TOKEN`, which [session-lifecycle](./session-lifecycle.md) covers.
