# 03: Instructor Account `/accounts/me`, sign-in lock, `/packs/validate`, pack conflicts, cross-kind tokens, and `413` in teacher BDD

**What to build:** Expand the teacher account and shared pack library BDD feature to exercise the two previously untested routes (`GET /api/v1/accounts/me` and `POST /api/v1/packs/validate`), cross-kind Capability Token refusals, account sign-up/lock errors, pack registration conflicts, unknown session packs, and the 256 KB body size limit over live HTTP:
1. **`GET /api/v1/accounts/me` and cross-kind Capability Token refusals:**
   - Calling `GET /api/v1/accounts/me` without a token is refused with `401 UNAUTHORIZED_TOKEN`.
   - Calling `GET /api/v1/accounts/me` with a valid Account Token returns `200` with `accountId`, normalized `email`, and `createdAt`.
   - Sending a Game Session's `instructorToken` (a Capability Token) to `GET /api/v1/accounts/me` and `POST /api/v1/packs` is refused on both routes with `401 UNAUTHORIZED_TOKEN`.
2. **Sign-up validation and duplicate email conflict:**
   - Signing up with an invalid email format returns `400 INVALID_REQUEST_BODY` naming `email`.
   - Signing up with a password shorter than 10 characters returns `400 INVALID_REQUEST_BODY` naming `password`.
   - Signing up again with an already-registered email (including uppercase and surrounding spaces) returns `409 EMAIL_ALREADY_REGISTERED`.
3. **Five-strike sign-in lock (`423 ACCOUNT_TEMPORARILY_LOCKED`):**
   - Four consecutive wrong-password sign-in attempts each return `401 INVALID_CREDENTIALS`.
   - The fifth wrong-password attempt locks the Instructor Account and returns `423 ACCOUNT_TEMPORARILY_LOCKED` with `details.lockedUntil`.
   - An immediate sign-in attempt with the *correct* password while locked is also refused with `423 ACCOUNT_TEMPORARILY_LOCKED`.
4. **Curriculum Pack dry-run validation and registration refusals:**
   - Validating a draft Curriculum Pack that has fewer Keyword Cards than `rows × cols` via `POST /api/v1/packs/validate` returns `200` with `valid: false` and an `INSUFFICIENT_CARDS` error.
   - Attempting to register that undersized pack via `POST /api/v1/packs` returns `422 PACK_VALIDATION_FAILED`.
   - Registering the same `packId` and `version` twice returns `409 PACK_ALREADY_EXISTS`.
   - Attempting to register a new Pack Version (`2.0.0`) of the `diabe-teach` System Pack returns `403 PACK_IS_SYSTEM_PACK`.
5. **Unknown pack on session creation (`404`) and oversized payload (`413`):**
   - Starting a Classroom Game with an unknown `packId` returns `404 PACK_NOT_FOUND`.
   - Sending a request body exceeding 256 KB (`262,145` bytes) to `POST /api/v1/packs` with a valid Account Token returns `413 PAYLOAD_TOO_LARGE`.

See spec: `.scratch/bdd-non-happy-path-coverage/spec.md`.

**Blocked by:** None (can start immediately; runs after 02 under the one-agent-at-a-time policy)

**Status:** ready-for-agent

- [ ] BDD teacher-account scenario: `/api/v1/accounts/me` returns `401` unauthenticated, `200` with an Account Token, and `401 UNAUTHORIZED_TOKEN` when given a session Capability Token (and `POST /api/v1/packs` also refuses a Capability Token with `401`)
- [ ] BDD teacher-account scenario: sign-up refuses bad email (`400` naming `email`), short password (`400` naming `password`), and duplicate email with case/whitespace normalization (`409 EMAIL_ALREADY_REGISTERED`)
- [ ] BDD teacher-account scenario: 4 wrong passwords return `401 INVALID_CREDENTIALS`, the 5th returns `423 ACCOUNT_TEMPORARILY_LOCKED` with `details.lockedUntil`, and an immediate sign-in with the right password also returns `423`
- [ ] BDD teacher-account scenario: `/api/v1/packs/validate` returns `200` (`valid: false`, `INSUFFICIENT_CARDS`) on an undersized deck, registering it returns `422 PACK_VALIDATION_FAILED`, re-registering an existing `id@version` returns `409 PACK_ALREADY_EXISTS`, and registering a new version of `diabe-teach` returns `403 PACK_IS_SYSTEM_PACK`
- [ ] BDD teacher-account scenario: creating a session with an unknown `packId` returns `404 PACK_NOT_FOUND`, and sending a >256 KB body returns `413 PAYLOAD_TOO_LARGE`
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (`teacher-account-journey`), lint (≤ 29) and boundaries (≤ 6) are no worse
