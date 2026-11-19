# ADR-0007: Instructor Accounts, Account Tokens, a Shared Pack Library, and Pack Version Pinning

## Status

Accepted (2026-11-19). Updates ADR-0006 §1 (Authorization) and §7 (Ownership). Replaces the "real authentication is out of scope" line of the earlier Concept Chain prototype spec (`.scratch/concept-chain-teacher-login-and-game-setup/spec.md`).

## Context

Until now the server did not know who a teacher was. The only credential was the instructor Capability Token returned when a Game Session starts, and it is tied to that one session. So a teacher could not register or validate a Curriculum Pack before running a game, nobody could tell who wrote a pack, anyone with the API key could start a classroom Game Session, and a Game Session stored only a pack id, so a new Pack Version released mid-class changed what that class's Post-test and survey were marked against.

## Decision

### 1. Our own email and password accounts for the PoC

Teachers get an **Instructor Account**: an email and a password, nothing else (no display name).

- Sign-up needs only an email and a password. No verification email, no forgot-password email and no university-email check: anyone with an email can sign up. Password resets are done by hand in the database during the PoC.
- The email is trimmed and lower-cased before it is stored or looked up, and is unique (a unique index on `instructor_accounts.email`).
- Passwords are at least 10 characters, with no other complexity rules. They are hashed with argon2id through `@node-rs/argon2` (prebuilt binaries, per ADR-0005), and the plain password is never stored or logged.
- An unknown email and a wrong password get the same 401 `INVALID_CREDENTIALS` body, and both cost one hash check, so neither the body nor the timing reveals which emails have accounts.
- Routes: `POST /api/v1/accounts/sign-up` (201, or 400 `INVALID_REQUEST_BODY`, 409 `EMAIL_ALREADY_REGISTERED`), `POST /api/v1/accounts/sign-in` (200, or 401 `INVALID_CREDENTIALS`), and `GET /api/v1/accounts/me`.

We considered a hosted identity provider. Auth0 (free up to 25,000 monthly active users) and Clerk (free up to 50,000 retained users per app) would both cover the PoC, and either remains an option later. We chose our own accounts because the PoC needs no social login, no MFA and no email sending, and keeping identity in our own MongoDB avoids a third-party dependency in tests and local development.

### 2. Account Token versus Capability Token

Sign-up and sign-in return an **Account Token**: a bearer token that proves which Instructor Account is calling, is not tied to any Game Session, and lasts 12 hours (a teaching day). There are no refresh tokens and no server-side sign-out; a stolen token works until it expires.

- Both kinds are standard HS256 JWTs (ADR-0004), signed by `jose`.
- The Account Token has **its own secret** (`ACCOUNT_TOKEN_SECRET`, or `auth.account_token_secret` in the YAML environment file), loaded by `AppRuntime`, so rotating one secret never invalidates the other kind of token.
- Every token carries a `kind` claim: `"account"` or `"capability"`. A Capability Token is never accepted as an Account Token and an Account Token is never accepted as a Capability Token, even if both secrets were set to the same value. Capability Tokens issued before the claim existed have no `kind` and stay valid as Capability Tokens.
- OpenAPI gains an `AccountAuth` bearer scheme next to `BearerAuth`. Like `BearerAuth` (ADR-0004), it is checked centrally (the `authMiddleware` security handler, with `bearerScheme: "AccountAuth"`) and fails closed: a token that is present but malformed, tampered, expired or of the other kind gets 401 `UNAUTHORIZED_TOKEN`.
- An Account Token is needed for two things only: starting a classroom Game Session, and working with Curriculum Packs (validate, register, release a new version, archive, unarchive). Inside a running game everything keeps using the per-session Capability Token, so a token expiring or a teacher signing out never breaks a class. Learners get no accounts, and solo games stay anonymous.

### 3. A shared Curriculum Pack library

Every signed-in teacher can see and use every pack, release a new Pack Version of any pack, and archive or unarchive any pack except a System Pack. Nothing is ever deleted (ADR-0006 §4 still holds). Each Pack Version records who released it, and archiving records who archived the pack and when, so a surprising archive can be explained and undone. The **author handle** shown for a version is the part of the releasing account's email before the @; it is worked out when the pack is read, not stored.

This replaces ADR-0006 §1: registering a pack needs an Account Token, not an instructor Capability Token, so packs can be prepared before any game starts.

It also updates ADR-0006 §7 (Ownership): a Pack Version's `createdBy` becomes the releasing **account id** instead of an instructor session id. Packs registered before this change keep their old session id, show no author handle ("by unknown"), and can still be versioned or archived by anyone.

### 4. Pack Version pinning

A Game Session records the Pack Version it started with and uses it until the game ends, for everything it reads from the pack (board dealing, assessment and survey). Game setup starts a game on the latest non-archived version. Sessions stored before this change have no pinned version and fall back to the latest version, which is the earlier behaviour.

## Consequences

### Positive

- Teachers can prepare packs before class, and every classroom Game Session has a known instructor.
- Results stay tied to the exact content a class used, even when colleagues release new versions mid-class.
- No external identity service in tests, local development or production.

### Negative

- We own password storage, so a database leak exposes argon2id hashes (not passwords).
- Anyone can sign up and then version or archive any non-system pack. Archives are recorded and reversible, which we accept for the PoC.
- No email means no verification, no self-service password reset, and no proof that a teacher works where they say.

### Follow-ups

- When the PoC ends: verification and forgot-password email, a fresh look at a university-email check, and possibly a move to a hosted provider.
