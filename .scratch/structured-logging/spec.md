# Spec: Structured logging with pino, a log level set by environment variables, and tested redaction

**Status:** ready-for-agent

## Problem Statement

When something goes wrong in the API, the teacher or developer looking at the logs can't tell what happened, or to whom. As of `1fe961b` on `feat/api-completion`, the API logs in only two places, both with bare `console.*`:
- the generic 500 handler (`unexpectedErrorMiddleware`, `console.error(message, error)`);
- the Netlify v2 wrapper's route-parameter mismatch warning (`console.warn`).

As a result:
- There's no record of which route was called, what it returned, or how long it took. A teacher's "it said something went wrong" can't be matched to a log line.
- Lines from the same request can't be grouped, even though Netlify's log UI and `netlify logs` can filter by request id. Our lines don't carry one.
- Lines are free text, so they can't be filtered by field (for example status, error code or route).
- Nothing sets how much is logged. There's no quiet mode for tests and no verbose mode for debugging, and changing it means editing code.
- Nothing guarantees that secrets stay out of the logs. The API handles Capability Tokens, Account Tokens, passwords and teacher emails. One careless `console.log(event)` would write an `Authorization` header to Netlify's log store.
- Local output under `netlify dev` is hard to read, and tests have no way to check what was logged.

The research note `.scratch/research/netlify-logging-and-log-services.md` (2026-11-20) found the following:
- Netlify already captures stdout from functions, with filters for request id and level, so no outside log service is needed for this proof-of-concept.
- Log Drains are Enterprise-only.
- `pino` is the best fit, writing JSON synchronously to stdout with no worker-thread transport, plus `pino-pretty` for local reading and `pino-test` for assertions.

## Solution

- **One structured logger for the whole API,** behind a small outbound `Logger` port, built on `pino`.
  - It writes one JSON object per line, synchronously, to stdout.
  - Netlify's function logs pick these lines up unchanged.
- **Every request logs one summary line,** with:
  - the route, method, status and duration;
  - the domain error code on refusals;
  - Netlify's request id.
- **Every other line written during a request carries that request id,** so all of a request's lines can be pulled up together.
- **Unexpected errors** log the error class, message and stack, on the server only. That part is unchanged.
- **Environment variables control verbosity and format:**
  - `LOG_LEVEL` picks the minimum level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` or `silent`;
  - `LOG_PRETTY=true` gives human-readable output, but only under `netlify dev`.
  - Defaults suit each place:
    - deployed: `info`, JSON;
    - local dev: `debug`, readable;
    - tests: `silent`.
- **Secrets never reach the logs.** No call site logs a token, password, email, `Authorization` header, raw body or connection string. A `redact` list in pino acts as a safety net, and a test proves it by feeding in real-looking secrets and searching the raw output for them.
- **Tests can check logs** through an in-memory sink, using `pino-test`.

## User Stories

1. As a developer investigating a teacher's report, I want every request to log its route, method, status and duration, so that I can find the failing call.
2. As a developer, I want refused requests to log the domain error code (for example `PACK_IS_SYSTEM_PACK`), so that I can tell a rule refusal from a bug without reading code.
3. As a developer, I want every line written during a request to carry Netlify's `requestId`, so that I can filter the Netlify UI or `netlify logs` to one request.
4. As a developer, I want each line to be one JSON object with stable field names, so that I can filter with `netlify logs --json` and `jq`.
5. As a developer, I want each line to carry `level`, `time` and `msg`, so that the Netlify level filter and time ordering work.
6. As a developer, I want unexpected 500 errors to log the error class, message and stack, so that I can debug them. The client still gets only the generic `INTERNAL_ERROR`.
7. As a developer, I want the route-parameter mismatch warning to come from the same logger, with the request id, so that it shows up next to its request.
8. As a developer, I want to set `LOG_LEVEL=debug` on a deployed site without changing code, so that I can turn up detail while investigating.
9. As a developer, I want `LOG_LEVEL=warn` to drop the per-request `info` lines, so that a noisy site can be quietened.
10. As a developer, I want `LOG_LEVEL=silent` to turn all logging off, so that the test output stays clean.
11. As a developer, I want an invalid `LOG_LEVEL` (for example `verbose`) to fall back to `info` and log one warning saying so, so that a typo never crashes a function or silences logs.
12. As a developer running `npm run dev:local`, I want readable, coloured lines by default, so that I can follow requests in the terminal.
13. As a developer, I want `LOG_PRETTY=false` to give me raw JSON locally, so that I can test `jq` filters before a deploy.
14. As a developer, I want `LOG_PRETTY=true` to be ignored outside `netlify dev`, so that a copied environment variable can't slow down production or change its log format.
15. As a developer, I want the BDD runner and vitest to log at `silent` unless I ask otherwise, so that test output shows only test results.
16. As a developer debugging a failing test, I want to set `LOG_LEVEL=debug` for one run, so that I see the API's logs.
17. As a developer, I want the log settings documented in `.env.dev.yaml.example` and the architecture doc, so that I can find them.
18. As a teacher, I want my password, my email and my login token never written to logs, so that my account is safe even if logs leak.
19. As a learner, I want my Capability Token never written to logs, so that nobody can take over my seat in a game.
20. As a developer, I want a test that fails if any known secret appears in log output, so that a future careless log call is caught before it ships.
21. As a developer, I want request and response bodies never logged, so that pack content, chain narratives and assessment answers stay out of the logs.
22. As a developer, I want ids (`sessionId`, `packId`, `accountId`, `participantId`) logged instead of personal data, so that I can still correlate events.
23. As a developer, I want the MongoDB connection string never logged, even on connection errors, so that database credentials don't leak.
24. As a developer, I want logging to add no measurable delay and lose no lines when a function finishes, so that serverless shutdown doesn't drop logs.
25. As a developer writing a new route, I want request logging and the request id to come for free from the shared wrapper and middy chain, so that I don't have to remember them.
26. As a developer writing a use case, I want to receive the logger through dependency injection (the `Logger` port), so that domain and application code never import pino and the boundary rules stay green.
27. As a developer writing tests, I want to give a handler an in-memory log sink and check its lines with `pino-test`, so that log behaviour is tested like any other output.
28. As a developer, I want the wrapper and middleware to fall back to a silent logger when none is given, so that existing handler tests keep passing without changes.

## Implementation Decisions

**Packages**
- **`pino`** goes in `dependencies`. **`pino-pretty`** and **`pino-test`** go in `devDependencies`.
- No pino transports (worker threads) anywhere. They can lose lines, and netlify dev already runs functions in worker threads (see the research note, section 7).
- `@middy/input-output-logger` is not used, because by default it logs whole requests, including the `Authorization` header.
- No outside log service. Axiom stays a documented later option (research note, section 8).

**Logger port (hexagonal)**
- An application-layer port `LoggerPort` with `debug`, `info`, `warn` and `error`. Each takes `(fields: object, msg: string)`.
- Plus `child(fields)`, which returns a logger that adds those fields to every line.
- Domain and application code depend only on the port. pino lives in one outbound adapter (`PinoLogger`), and `npm run lint:boundaries` must stay green.
- A `SilentLogger` (no-op) adapter is the default when no logger is given, so existing tests need no change.
- `AppRuntime` builds the production logger once per function instance and provides it in `ProductionDependencies`.

**Destination**
- Production: `pino.destination({ dest: 1, sync: true })`, with `sync: true` explicit.
- Pretty mode: `pino-pretty` used in-process as a synchronous stream (`pretty({ sync: true, colorize: true })`), never as a transport.
- `pino-pretty` is a devDependency. The pretty branch is only reached under `NETLIFY_DEV=true`, and loads `pino-pretty` dynamically. A deployed bundle without it therefore never fails, and if it can't be loaded the logger falls back to JSON.

**Base fields**
- Every line has pino's `level`, `time` and `msg`.
- The base adds `service: "diabe-teach-api"`.
- Remove pino's default `pid` and `hostname` (`base` override); they mean nothing in serverless.
- Levels are written as labels (`formatters.level`) so Netlify's level filter reads them. The agent checks this in the Netlify UI or `netlify logs`, and if it's unclear, says so in the ticket.

**Request correlation and the summary line**
- `wrapLambdaHandler(handler, config)` makes one child logger per invocation, with `{ requestId: context.requestId, route: config.path, method }`, and passes it on the event (for example `event.logger`) to the middy chain and handlers.
- When the invocation ends, it writes one `info` line, `"request completed"`, with `status`, `durationMs` and, on a domain error, `errorCode`.
- 5xx responses log at `error`, 4xx at `info`. A 4xx is an expected refusal, not an incident.
- Under netlify dev, the `.html`/`.htm` retries from `fac7912` still produce lines. Each retry is a separate invocation and is logged as one; no extra handling.

**Existing call sites**
- `unexpectedErrorMiddleware` logs `error` with `{ err }`, through pino's standard error serializer (class, message, stack), plus the summary line's fields. Its `log` injection becomes the logger.
- The wrapper's parameter-mismatch `console.warn` becomes `logger.warn({ pathname }, "route parameters from URL and context.params disagree; using the URL")`.
- After the change, no `console.*` is left in `src/` or `netlify/`. Scripts are exempt.
- A lint rule enforces this: ESLint `no-console` as an error for `src/**` and `netlify/**`.

**Environment variables**

| Variable | Values | Default | Notes |
|---|---|---|---|
| `LOG_LEVEL` | `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `silent` | `info` deployed; `debug` under `NETLIFY_DEV=true`; `silent` under vitest and BDD | Any other value → `info` plus one `warn` line naming the bad value |
| `LOG_PRETTY` | `true`, `false` | `true` under `NETLIFY_DEV=true`, otherwise `false` | Ignored, so JSON is kept, unless `NETLIFY_DEV=true`. This is the same guard style as `DEV_DISABLE_API_KEY` |

- The settings are read in `AppRuntime.loadEnvConfig` next to the other settings, with the same precedence as today: a real environment variable wins over `.env.dev.yaml` for local runs.
- Add `logging.level` and `logging.pretty` to `.env.dev.yaml.example`, with placeholder-safe values.
- Tests: vitest's setup sets `LOG_LEVEL=silent` unless the variable is already set. The BDD runner passes `LOG_LEVEL=silent` to `dev:local` unless it's set. `npm run dev:local` passes nothing, so the local default (`debug`, pretty) applies.
- `netlify.toml` sets no `LOG_LEVEL`, so the deployed default stays `info`. The Netlify UI can override it per site or per deploy context.

**Redaction (safety net, not permission)**
- Call sites log ids and outcomes only, never `event`, `headers`, `body` or whole domain objects.
- pino `redact`, with `remove: true`, as the backstop:
  - `headers.authorization`, `req.headers.authorization`, `*.authorization`
  - `*.token`, `*.accountToken`, `*.instructorToken`, `*.participantToken`
  - `*.password`, `*.passwordHash`
  - `*.email`
  - `*.body`
  - `*.mongodbUri`, `*.uri`
- MongoDB connection errors are logged with the error message after stripping any `mongodb(+srv)://…@` credentials. A small helper is tested.

**Docs**
- `docs/agents/api-architecture.md` gains a short "Logging" section: the port, the summary line, the env variables, the "never log" list, and `netlify logs --json | jq` examples.
- The research note is linked from the spec and the doc.

## Testing Decisions

- **What a good test checks:** behaviour, meaning the JSON lines that come out for a given request or call. It doesn't check pino internals or which function produced a line.
- **Logger adapter unit tests** (an in-memory sink plus `pino-test`):
  - **Levels:** `LOG_LEVEL` filtering at each level; `silent` writes nothing; an invalid level falls back to `info` with one warning.
  - **Fields:** base fields (`service`, label `level`, `time`, `msg`), and no `pid` or `hostname`.
  - **Child loggers:** `child()` fields appear on every line.
  - **Pretty mode:** off unless `NETLIFY_DEV=true`; when on, the output isn't JSON.
- **Redaction test:**
  - Logs objects containing a real-looking Capability Token, Account Token, `Authorization: Bearer …` header, password, password hash, teacher email (`rahman.s@aku.edu`), request body and `mongodb+srv://user:pass@…` URI, through every logger method and through `child()`.
  - Then asserts on the raw output string that none of those values appears.
  - This test must fail if the `redact` list is emptied. The agent shows that in the ticket.
- **Wrapper and middleware tests** (a handler with an injected sink logger):
  - a 200 request writes one `request completed` line with `requestId`, `route`, `method`, `status` and `durationMs`;
  - a domain refusal (for example 403 `PACK_IS_SYSTEM_PACK`) logs `errorCode` at `info`;
  - an unexpected error logs at `error` with the `err` class, message and stack, while the HTTP body stays the generic `INTERNAL_ERROR`, as in `tests/functions/bad-request-body.test.ts`;
  - a route-parameter mismatch logs `warn` with the request id;
  - existing handler tests pass unchanged with the default `SilentLogger`.
- **Config tests:** `AppRuntime.loadEnvConfig` resolves `LOG_LEVEL` and `LOG_PRETTY` from env, then from YAML, then from the defaults, with the `NETLIFY_DEV` guard on pretty mode.
- **Lint:** `no-console` errors in `src/**` and `netlify/**`; the lint baseline is no worse than 29.
- **Local check, recorded in the ticket:**
  - under `npm run dev:local`, a request prints a readable line with the request id;
  - with `LOG_PRETTY=false`, it prints JSON that `jq` parses.
- **BDD:** no new scenarios, because logs aren't visible over HTTP. All 5 features must still pass, one per process, with `LOG_LEVEL=silent`.
- **Prior art:**
  - `tests/adapters/lambda-to-v2-wrapper.test.ts`;
  - `tests/functions/bad-request-body.test.ts`;
  - `tests/no-committed-secrets.test.ts` (the style of the secret-pattern checks).
- **Running the checks:** typecheck passes, vitest (`--no-file-parallelism`) is green, boundaries no worse than 6, and BDD runs one feature at a time.

## Out of Scope

- Shipping logs to an outside service (Axiom, Better Stack, Datadog and the rest), Netlify Log Drains, and `context.waitUntil` flushing. These are the research note's "later" options.
- Error tracking and alerting (Sentry), and Sentry Spotlight.
- Metrics, tracing and OpenTelemetry.
- Logging in the prototype pages (`claudPoc/`) and in `scripts/`.
- Audit logs of teacher actions (who archived a pack, and so on). The domain already records `archivedBy` and similar.
- Log sampling, and per-route levels.

## Further Notes

- **Sources:**
  - `.scratch/research/netlify-logging-and-log-services.md`: section 1 (Netlify function logs), section 3 (no outside service needed), section 6 (package comparison), section 7 (local testing and the transport gotcha) and section 8 (the recommendation);
  - its unverified items, notably whether Netlify parses JSON fields and whether `pino-test` works under vitest. The first ticket should confirm `pino-test` with vitest, and fall back to a plain `Writable` sink if it doesn't.
- **Related decisions:**
  - ADR-0005 (npm-first: pino, pino-pretty, pino-test);
  - ADR-0002 (hexagonal boundaries: the logger is a port);
  - ADR-0007 (the token kinds that must never be logged).
- **Lessons from earlier efforts:**
  - netlify dev runs each v2 function call in its own worker thread (`b6b5924`);
  - it retries 403/404 as `.html` (`fac7912`).

  Both affect what local logs look like, not production.
- **Open for the user:**
  - the default levels;
  - whether 4xx summaries should be `info` or `debug`;
  - the `service` name.
