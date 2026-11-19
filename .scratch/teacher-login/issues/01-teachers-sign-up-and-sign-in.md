# 01: Teachers sign up and sign in with an email and password

**What to build:** A teacher can create an **Instructor Account** with only an email and a password, and sign in with them. Both calls return an **Account Token** that lasts 12 hours. There's no verification email and no university check: anyone with an email can sign up.

- The email is trimmed and lower-cased before it's stored or looked up, and must be unique.
- The password must be at least 10 characters. It's hashed with argon2id through a well-known npm package with prebuilt binaries (ADR-0005), and the plain password is never stored or logged.
- The Account Token is a standard JWT (ADR-0004) signed with **its own secret**, configured through `AppRuntime` and the YAML environment files. A claim marks its kind, so a Capability Token is never accepted as an Account Token, and an Account Token is never accepted as a Capability Token.
- A wrong password and an unknown email get the same 401 response.
- A new OpenAPI security scheme for the Account Token, handled in `OpenApiHttpApp`'s central security handlers. It fails closed: a token that's present but invalid gets 401. The two routes are documented in the OpenAPI file first. Paths and error codes follow the existing `/api/v1` and `ApiErrorResponse` conventions.
- The Instructor Account is stored through a new repository port with in-memory and MongoDB adapters, with a unique index on the email.
- Add the glossary terms **Instructor Account** and **Account Token**. Write a new ADR for own-account login in the PoC, Account Token versus Capability Token, the shared pack library, and Pack Version pinning. It updates ADR-0006's ownership section.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler test: sign-up with a new email returns 201 with an Account Token and the account's id and email
- [ ] Handler test: sign-up with an email already registered, in any letter case and with surrounding spaces, returns 409
- [ ] Handler test: sign-up with a missing or invalid email, or a password under 10 characters, returns 400 and stores nothing
- [ ] Handler test: sign-in with the right password returns an Account Token; a wrong password and an unknown email return the same 401 body
- [ ] Handler test: the returned Account Token is accepted by the new security scheme; a Capability Token is rejected by it, and an Account Token is rejected where a Capability Token is required
- [ ] Repository contract suite (in-memory + Mongo): create and find by email or id round-trip; a duplicate email is refused; the stored record never holds the plain password
- [ ] Cucumber scenario: a teacher signs up, then signs in with the same email and password
- [ ] OpenAPI documents both routes and the Account Token security scheme; the glossary and the new ADR are written
- [ ] Typecheck, vitest, BDD (`npm run test:bdd`, one feature at a time), lint (118) and boundaries (6) are no worse
