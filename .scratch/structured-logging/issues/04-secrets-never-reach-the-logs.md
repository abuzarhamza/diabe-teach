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

**Status:** ready-for-agent

- [ ] Test: these values are pushed through `debug`, `info`, `warn`, `error` and `child()`, and the raw output string contains none of them:
  - a real-looking Capability Token and Account Token, and an `Authorization: Bearer …` header;
  - a password and a password hash;
  - a teacher email (`rahman.s@aku.edu`);
  - a request body;
  - a `mongodb+srv://user:pass@…` URI.
- [ ] The test is shown failing when the `redact` list is emptied (recorded in the Resolution)
- [ ] Helper test: Mongo credentials are stripped from error messages
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 29) and boundaries (≤ 6) are no worse
