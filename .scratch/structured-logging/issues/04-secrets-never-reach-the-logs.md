# 04: Secrets never reach the logs

**What to build:**
- **Redaction:** the pino adapter applies `redact` with `remove: true` as a safety net. It covers:
  - `headers.authorization`, `req.headers.authorization`, `*.authorization`;
  - `*.token`, `*.accountToken`, `*.instructorToken`, `*.participantToken`;
  - `*.password`, `*.passwordHash`;
  - `*.email`, `*.body`;
  - `*.mongodbUri`, `*.uri`.
- **Mongo credentials:** a small helper strips `mongodb(+srv)://user:pass@` credentials from any error message before it's logged.
- **Call-site rule:** log ids (`sessionId`, `packId`, `accountId`, `participantId`), never `event`, `headers`, `body` or whole domain objects. Write this rule into the code comments of the port.

See spec: `.scratch/structured-logging/spec.md`. Research: `.scratch/research/netlify-logging-and-log-services.md`.

**Blocked by:** 01 (A logger port backed by pino)

**Status:** resolved

- [x] Test: these values are pushed through `debug`, `info`, `warn`, `error` and `child()`, and the raw output string contains none of them:
  - a real-looking Capability Token and Account Token, and an `Authorization: Bearer …` header;
  - a password and a password hash;
  - a teacher email (`rahman.s@aku.edu`);
  - a request body;
  - a `mongodb+srv://user:pass@…` URI.
- [x] The test is shown failing when the `redact` list is emptied (recorded in the Resolution)
- [x] Helper test: Mongo credentials are stripped from error messages
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- `PinoLogger.create` now sets `redact: { paths: REDACT_PATHS, remove: true }`. `REDACTED_KEYS` holds `authorization`, `token`, `accountToken`, `instructorToken`, `participantToken`, `password`, `passwordHash`, `email`, `body`, `mongodbUri` and `uri`. `REDACT_PATHS` lists each key three times: `key`, `*.key` and `*.*.key`. That is 33 paths, and it includes `headers.authorization` and `req.headers.authorization`.
- **Wildcard depth (checked by running pino 10.4 / `@pinojs/redact` 0.4):** each `*` matches exactly one key. `*.email` removes `{ account: { email } }`, but it removes neither a top-level `email` nor `{ a: { b: { email } } }`. Child bindings follow the same rule. The `@pinojs/redact` README says `*.password` matches "at any level". It does not, at least for top-level keys and for depth 2. So the spec's list on its own (`*.key` plus the two header paths) misses top-level `token`/`email`/`body`/... and `signUp.body.password`. The redaction test fails against that list too. Values nested deeper than two objects, or inside arrays, are not matched. The call-site rule is what covers those.
- `MongoCredentialStripper.strip(text)` (`src/adapters/outbound/mongo-credential-stripper.ts`) removes the `user:pass@` part of `mongodb://` and `mongodb+srv://` URIs. The pino `err` serializer runs it over `message` and `stack`, so a Mongo connection error that reaches `unexpectedErrorMiddleware` is logged without credentials.
- The call-site rule is written in the `LoggerPort` doc comment: log ids and outcomes only, never `event`, `headers`, `body`, whole domain objects or secrets.
- Tests are in `tests/adapters/pino-logger-redaction.test.ts`. The Capability Token and Account Token come from `HmacCapabilityTokenAdapter` and `HmacAccountTokenAdapter`, signed with a random throwaway key. The password hash comes from `Argon2PasswordHasher`. The Mongo user and password are random. All of them are pushed top-level and nested through `debug`/`info`/`warn`/`error`, a `child()` and a grandchild. The raw output must contain none of them, and `Bearer ` must not appear either. A failure reports only 6-character prefixes. A control test (`redactPaths: []`) shows that all 9 values leak without the list. The stripper has 6 cases.

**Proof that the test bites:** with `REDACT_PATHS` replaced by an empty list, "writes none of the secrets..." fails, and so does the depth-list test (2 failed, 8 passed). With the spec's literal one-level list, "writes none..." fails too. Both changes were reverted.

**Checks:** typecheck passes; lint 29; boundaries 6; vitest `--no-file-parallelism` 952 passing (942 + 10), with no intermittent failures; BDD `teacher-account-journey` passes 10/10 scenarios against `dev:local`. The dev log has no email, `Bearer ` or JWT.
