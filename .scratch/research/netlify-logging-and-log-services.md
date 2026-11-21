# Netlify Function Logging and Log Services

**Date:** 2026-11-20 (all pages below were read on this date)
**Author:** Research Agent
**Status:** Research complete. Sections 1–7 are sourced facts; the recommendation is in section 8, kept separate. Sections 6 and 7 (Node logging packages, local testing) were added later on the same day.

---

## Executive Summary

**Do we need another service? Not yet.** For a proof-of-concept, Netlify's built-in function logs are enough. They capture `console.*` output, offer a real-time tail and historical search in the UI and through `netlify logs`, filter by log level and request ID, and output JSON Lines. The limits are short retention (at least 24 hours, 7 days "for certain pricing plans"), no alerting, and no error grouping.

**Log Drains are Enterprise-only.** On Free, Personal or Pro, the only way to ship logs elsewhere is from inside the function, using the vendor's SDK or HTTP ingest. Netlify Functions v2 provide `context.waitUntil()`, which lets the function flush logs after the response is sent.

**Packages (section 6):**
- **pino** is the only candidate that has all of these built in: JSON output, path-based `redact`, child loggers, bundled TypeScript types, active releases, and documented serverless advice (use `sync: true`).
- **winston:** JSON and child loggers, but no built-in redaction.
- **bunyan:** last release January 2021.
- **consola** and **loglevel:** console-style loggers with no structured JSON output.
- **`@middy/input-output-logger`:** logs the whole event (including headers and body) by default, so it is unsuitable here.

**Local testing (section 7):**
- **Readable output:** pipe output through the `pino-pretty` CLI (`netlify dev | pino-pretty`). `netlify dev` runs each v2 function in a `worker_threads` Worker and pipes the worker's stdout to the parent process (verified in the netlify-cli source).
- **Unit tests:** pass the logger a test destination stream: `pino-test`'s `sink()`, or a plain `Writable` that collects lines. Assert on the parsed JSON, and assert that secret values never appear in the raw output.
- **Local backend without a cloud account:** Sentry Spotlight (`npx @spotlightjs/spotlight`, no account needed) is the light option. A Loki + Grafana Docker stack starts 8 containers, which is too heavy for this machine.

**Recommendation (section 8):**
- **Now:** use `pino` writing structured JSON to stdout, with `redact` for secrets and `context.requestId` on every line.
- **When retention, cross-invocation search or alerting starts to matter:** add **Axiom** (free: 500 GB/month, 30-day retention, 1 user), flushed via `context.waitUntil`. Axiom is also a native Netlify Log Drain destination, so it fits a later upgrade.
- **Sentry** is the complement for error alerting and grouping. It is not a log store, though it now also ingests logs.
- **Package set:**
  - prod: `pino`
  - dev: `pino-pretty`, `pino-test`
  - later: `@axiomhq/js`

---

## 1. How logging works for Netlify Functions

### 1.1 Where `console.log` goes
- Netlify "captures `console.log()` statements from your function code", along with the start of each invocation and log statements from Background Functions ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- The page does not say how `console.error` / `console.warn` are treated separately. The level filters below suggest a level is attached, but the docs don't explain how it is derived. **Unclear.**

### 1.2 Viewing logs
- **UI:** *Cloud compute > Functions*, then pick a function. It shows the published deploy by default. Branch deploys and Deploy Previews can be searched by number. Team Owners and Developers also see logs in the *Function logs* tab of the Netlify Drawer ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- **CLI:** `netlify logs` shows "the last 10 minutes of activity from functions, edge functions, and the server" by default ([Function logs](https://docs.netlify.com/build/functions/logs/)). Options:
  - `--follow` / `-f` for a live tail.
  - `--since` (duration such as `1h`, or ISO 8601) and `--until` for history.
  - `--function <name>` to pick a function.
  - `--source functions|edge-functions|deploy|server`.
  - `--level trace|debug|info|warn|error|fatal`.
  - `--json` outputs "logs as JSON Lines".
  - Example: `netlify logs --since 24h --level error --level fatal`.

### 1.3 Real-time vs historical
- **UI:** the default view is a live tail labelled *Real-time*. Date filters: *Last hour*, *Last day*, *Last 7 days*, *Custom* ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- **CLI:** `--follow` cannot be combined with `--since` / `--until` (same page).

### 1.4 Retention per plan
- Function logs page: "Logs are retained for at least 24 hours of function activity, even after a new function deployment. This log retention period increases to 7 days for certain pricing plans." It does **not** name the plans ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- Logs overview: function and edge function logs cover "up to 7 days of activity (retention duration depends on your pricing plan)" ([Logs](https://docs.netlify.com/manage/monitoring/logs/)).
- Pricing page plans:
  - Free: $0
  - Personal: $9/month, lists "1-day observability"
  - Pro: $20/month, lists "30-day analytics & metrics"
  - Enterprise: custom pricing, lists "Log drains"
  - The page as fetched shows **no per-plan function-log retention row** ([Pricing](https://www.netlify.com/pricing/)).
- The Free vs Personal comparison also has no log-retention row ([Personal vs Free](https://www.netlify.com/pricing/personal-vs-free/)).
- **Unverified:** a search-engine snippet attributed a table to the pricing page: Functions logs "24-hour history" on Free, "7-day" on Personal and Pro, and "Full history" on Enterprise. I could not see that table when fetching the page, so treat it as **unconfirmed**.
- **Observability** (request/function insights, with search over "any text in function and edge function logs"):
  - Available on credit-based plans (Free, Personal, Pro, Business, Enterprise), but not on legacy plans.
  - Time window: Free past 24 h, Personal past 24 h, Pro past 7 days, Enterprise past 30 days ([Observability overview](https://docs.netlify.com/manage/monitoring/observability/overview/)).
  - The pricing page says "1-day observability" for Personal, which matches.

### 1.5 Size and line limits
- **Lambda compatibility mode:** "historical function log output is limited to 4 KB total per invocation. If a log's output exceeds 4 KB, only the last 4 KB of the log is retained" ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- **Log Drains:** a single entry is limited to 700 KB (same page). The Log Drains page also says function log output is "limited to 4 KB total per invocation" ([Log Drains](https://docs.netlify.com/manage/monitoring/log-drains/)).
- No limits are stated for native v2 functions outside Lambda compatibility mode, and no line-count limit is documented. **Unclear.**
- This repo exports native v2 handlers. Our own `wrapLambdaHandler` is not Netlify's `withLambda()` compatibility wrapper, so the 4 KB rule *probably* does not apply. That is an inference, not something the docs state.

### 1.6 Structured logs and levels
- **Filtering:** the UI text filter matches "request ID, message, or log level", and the CLI has `--level` ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- **JSON parsing:** the docs do not say whether a JSON log line written by the function is parsed into fields. Only free-text matching is documented, plus `--json` output from the CLI. **Assume JSON lines are searchable as text, not as fields.**

---

## 2. Netlify Log Drains

Source for this section: [Log Drains](https://docs.netlify.com/manage/monitoring/log-drains/).

- **What it is:** "Netlify batches the site's log records from our CDN and build system and posts them to an endpoint in JSON/NDJSON format in near real-time."
- **Plans:** "This feature is available on Enterprise plans." A Team Owner must set it up. This matches the pricing page, which lists "Log drains" only under Enterprise ([Pricing](https://www.netlify.com/pricing/)).
- **Native destinations:**
  - Datadog
  - New Relic
  - Axiom
  - Azure Monitor
  - Sumo Logic
  - Splunk Observability Cloud
  - Logflare
  - Amazon S3 (Gzip files)
  - General HTTP endpoints (JSON or NDJSON)
  - Better Stack and Grafana Cloud are **not** listed natively. They could only be reached through the generic HTTP option.
- **Log types:**
  - Site traffic
  - Functions ("function invocations"; Background Functions output is not supported)
  - Edge functions
  - Server
  - Deploys
  - WAF
- **Other notes:**
  - A PII-exclusion option drops fields such as `client_ip` and `user_agent` from traffic and WAF logs.
  - Configuration changes take effect in about 5 minutes.
- **Vendor side:** Axiom confirms its Netlify integration is a Log Drain: "only available for Netlify customers on enterprise-level plans where Log Drains are supported" ([Axiom: Netlify](https://axiom.co/docs/apps/netlify)).

---

## 3. Do we need to post logs to another service?

### 3.1 When Netlify's built-in logs stop being enough
These points are inferred from the limits above:

| Need | Built-in? |
|---|---|
| Debugging a request now or today | Yes: real-time tail, last hour/day, request-ID filter |
| Looking back more than 24 h to 7 days | No: retention ceiling is 7 days (§1.4) |
| Querying JSON fields (e.g. count of `code=PACK_NOT_FOUND`) | Not documented: text match only |
| Alerting (notify on 5xx spike) | Not documented for function logs |
| Error grouping, stack traces, release tracking | No: that is error-tracking territory (Sentry) |

### 3.2 Without Log Drains: ship from the function
- **Options:** the vendor's SDK or HTTP ingest. Examples:
  - Axiom `@axiomhq/js` or `@axiomhq/pino`
  - Better Stack `@logtail/node` plus `@logtail/pino`
  - New Relic Log API: `POST https://log-api.newrelic.com/log/v1`, `Api-Key` header, JSON, max 1 MB per POST ([New Relic Log API](https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/))
  - Datadog: `POST https://http-intake.logs.datadoghq.com/api/v2/logs` ([Datadog Logs API](https://docs.datadoghq.com/api/latest/logs/))
  - Grafana Loki: `POST /loki/api/v1/push`, which takes JSON or protobuf ([Loki HTTP API](https://grafana.com/docs/loki/latest/reference/loki-http-api/))
- **Serverless gotcha: flush before the function is frozen.**
  - Pino: "Asynchronous logging in AWS Lambda functions will tend to cause delayed or lost log messages … For Lambda deployments, it's recommended to always use a destination with `sync: true`" ([pino asynchronous.md](https://github.com/pinojs/pino/blob/main/docs/asynchronous.md)).
  - Pino transports run "in a separate worker thread" and "boot asynchronously" ([pino transports.md](https://github.com/pinojs/pino/blob/main/docs/transports.md)). So a worker-thread transport such as `@axiomhq/pino` or `@logtail/pino` with a `target` is risky in a function. Neither Axiom's pino README nor its guide discusses serverless ([axiom-js pino README](https://github.com/axiomhq/axiom-js/blob/main/packages/pino/README.md), [Axiom pino guide](https://axiom.co/docs/guides/pino)).
  - Better Stack says the worker-thread transport can lose the last logs on serverless. It recommends `pino(new LogtailStream(logtail))` plus `await logtail.flush()` before returning (requires `@logtail/pino` ≥ 0.5.12) ([Better Stack: Pino](https://betterstack.com/docs/logs/javascript/pino/)).
  - The Axiom JS client "automatically batches events in the background", and the docs say "call `flush()` only before your app exits" ([Axiom JavaScript guide](https://axiom.co/docs/guides/javascript)). In a function, "exit" means the end of each invocation.
  - Sentry documents `flush(timeout?)`, which drains the queue and keeps the client usable ([Sentry APIs: flush](https://docs.sentry.io/platforms/javascript/guides/express/configuration/apis/#flush)).
- **`context.waitUntil` in Netlify Functions v2 does exist** ([Functions API](https://docs.netlify.com/build/functions/api/)):
  - "implements the `ExtendableEvent.waitUntil` standard. It allows you to extend the function's execution until the given Promise it completed, without blocking the response to the client … such as emitting analytics events or dispatching logs."
  - It is available for functions deployed on or after **March 20, 2025**.
  - The billed and reported duration includes the async work.
  - The function can still run only "until its execution time limit".
  - The docs do not say whether `waitUntil` is exposed through Netlify's `withLambda()` compat wrapper. That does not matter here: our `wrapLambdaHandler` receives the native v2 `Context` (`src/adapters/inbound/http/lambda-to-v2-wrapper.ts`), so we could call `context.waitUntil(client.flush())` there, next to `afterInvocation`.

---

## 4. Candidate services

Free-tier figures come from each vendor's own pricing or limits page, read 2026-11-20.

| Service | Free tier | Netlify fit | Node SDK | POC fit |
|---|---|---|---|---|
| **Axiom** | Personal plan: 500 GB/month ingest, 30-day retention, **1 user**, 3 datasets, 256 fields/dataset, 10 GB-hours/month query compute ([limits](https://axiom.co/docs/reference/limits), [pricing](https://axiom.co/pricing)). Next tier: Axiom Cloud, $25/month plus usage. | Native Log Drain destination, but only on Enterprise ([Netlify](https://docs.netlify.com/manage/monitoring/log-drains/), [Axiom](https://axiom.co/docs/apps/netlify)) | `@axiomhq/js` (batching, `flush()`), `@axiomhq/pino` (worker transport); Node ≥ 20 | Strong: generous retention and volume. The 1-user limit means no shared access on free. |
| **Better Stack (Telemetry, ex-Logtail)** | 3 GB logs retained for 3 days; 100,000 exceptions/month; 10 monitors and 1 status page ([pricing](https://betterstack.com/pricing)) | Not a native drain; no Netlify page found | `@logtail/node` + `@logtail/pino`; the only vendor here with **documented serverless flush** ([docs](https://betterstack.com/docs/logs/javascript/pino/)) | Good DX, but 3-day retention is barely more than Netlify's own logs |
| **Sentry** | Developer plan: 1 user, 5k errors, 5 GB logs, 5M spans, 30-day lookback ([pricing](https://sentry.io/pricing/)). The page doesn't state the period for errors and logs; assumed monthly. | Netlify's old Sentry-integration URL now redirects to the generic Extensions index, which doesn't list Sentry ([Netlify extensions](https://docs.netlify.com/integrations/sentry-integration/)), so there's no current Netlify-documented integration | `@sentry/node`; `Sentry.logger.*` (SDK ≥ 9.41.0; on by default from 10.71.0); `consoleLoggingIntegration` ([Sentry logs](https://docs.sentry.io/platforms/javascript/guides/node/logs/)) | **Error tracking** (grouping, stack traces, alerts), which differs from log search. Best complement, not a substitute. |
| **Datadog** | "up to five Basic hosts with 1-day metric retention." The pricing page does not say logs are in the free tier. Logs cost from $0.10/GB ingest plus $1.70 per million events indexed (15-day retention) ([pricing](https://www.datadoghq.com/pricing/)). | Native Log Drain (Enterprise) | HTTP intake ([API](https://docs.datadoghq.com/api/latest/logs/)) | Poor for a free POC: logs appear to be paid only. Not confirmed from the page. |
| **New Relic** | 100 GB/month ingest, 1 full platform user plus unlimited basic users, default retention "at least 8 days". Ingest stops when you exceed the cap ([pricing](https://newrelic.com/pricing)). | Native Log Drain (Enterprise) | Log API over HTTP ([docs](https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/)) | Workable, but a heavier, APM-oriented product |
| **Grafana Cloud (Loki)** | Logs: 50 GB/month, 14-day retention; 3 active users; 10k metric series ([pricing](https://grafana.com/pricing/)) | Not a native drain | Loki push API ([docs](https://grafana.com/docs/loki/latest/reference/loki-http-api/)). `pino-loki` is community-maintained; its npm page returned 403, so it's unverified. | Good free volume and multiple users, but you write labels and queries yourself (LogQL) |
| **Logflare** | Free "Project" tier: 12,960,000 events/month, retention "up to 3 days", rate-limited to 5 events/s on average. "Logflare is now part of Supabase" ([pricing](https://logflare.app/pricing)). | Native Log Drain (Enterprise) | HTTP | Weak: 3-day retention and the rate limit |

No other vendor showed a strong Netlify fit in primary sources. The natively listed Azure Monitor, Sumo Logic and Splunk are all Enterprise-drain-only and not free-tier oriented, so they were not evaluated.

---

## 5. What to log and what NOT to log (sourced facts that inform section 8)
- **Redaction:** pino's `redact` option takes paths (wildcards allowed) to censor or `remove` values. It adds about 2% overhead without wildcards, and noticeably more with them. "Path strings must not originate from user input" ([pino redaction.md](https://github.com/pinojs/pino/blob/main/docs/redaction.md), [pino api.md](https://github.com/pinojs/pino/blob/main/docs/api.md)).
- **Destination:** the default is `pino.destination(1)` (stdout) ([pino api.md](https://github.com/pinojs/pino/blob/main/docs/api.md)). Child loggers share the parent's stream, and a `mixin` runs on every log call (same page).
- **Request ID:** `context.requestId` is "A string containing the Netlify request ID", e.g. `01FDWR77JMF2DA1CHF5YA6H07C` ([Functions API](https://docs.netlify.com/build/functions/api/)). The repo already copies it into `event.requestContext.requestId` and `lambdaContext.awsRequestId` (`src/adapters/inbound/http/lambda-to-v2-wrapper.ts`). The Netlify UI filter matches request IDs ([Function logs](https://docs.netlify.com/build/functions/logs/)).
- **PII:** the Log Drains PII toggle covers only traffic and WAF fields, so it does not protect anything the function itself writes ([Log Drains](https://docs.netlify.com/manage/monitoring/log-drains/)).

---

## 6. Node logging packages

### 6.1 Registry data (read 2026-11-20)
- Weekly downloads are for 2026-11-13 → 2026-11-19, from `https://api.npmjs.org/downloads/point/last-week/<pkg>`. The npm website itself returned 403 to the fetcher.
- Latest versions and release dates come from `https://registry.npmjs.org/<pkg>` (`dist-tags.latest` and `time`).
- "TS types" means the `types` field of the latest published `package.json`.

| Package | Latest (date) | Weekly downloads | TS types |
|---|---|---|---|
| `pino` | 10.4.0 (2026-10-02) | 81,857,132 | bundled (`pino.d.ts`) |
| `winston` | 3.19.0 (2025-12-07) | 37,612,023 | bundled (`index.d.ts`) |
| `bunyan` | 1.8.15 (**2021-01-08**) | 5,705,273 | none; needs `@types/bunyan` (1.8.11, 2023-11-07) |
| `consola` | 3.4.2 (2025-03-18) | 69,046,445 | bundled |
| `loglevel` | 1.9.2 (2024-09-06) | 34,502,977 | bundled (`@types/loglevel` is marked a deprecated stub) |
| `pino-pretty` | 13.2.0 (2026-10-04) | 37,334,762 | bundled |
| `pino-test` | 2.0.0 (2026-03-12) | 93,626 | bundled |
| `@axiomhq/js` | 2.0.0 (2026-08-04) | 1,027,160 | bundled |
| `@axiomhq/pino` | 2.0.0 (2026-08-04) | 211,205 | bundled |
| `@axiomhq/logging` | 0.4.1 (2026-09-09) | 244,975 | bundled |
| `@sentry/node` | 11.16.0 (2026-11-20) | 60,130,250 | bundled |
| `@spotlightjs/spotlight` | 4.12.1 (2026-10-26) | 144,070 | n/a (dev tool) |
| `@middy/input-output-logger` | 7.9.2 (2026-08-27) | 522,700 | bundled |
| `pino-loki` (community, `Julien-R44/pino-loki`) | 3.0.0 (2025-12-14) | 333,784 | — |

Download counts include transitive installs. For example, `consola` is pulled in by many build tools, so its count is not a measure of direct logger adoption. That is an inference.

### 6.2 Feature comparison

**pino** ([README](https://github.com/pinojs/pino/blob/main/README.md), [api.md](https://github.com/pinojs/pino/blob/main/docs/api.md), [asynchronous.md](https://github.com/pinojs/pino/blob/main/docs/asynchronous.md))
- **JSON:** NDJSON by default.
- **Performance:** "In many cases, Pino is over 5x faster than alternatives." The project's own [benchmarks](https://github.com/pinojs/pino/blob/main/docs/benchmarks.md) give basic averages of pino 114.8 ms, winston 270.2 ms and bunyan 377.4 ms. These are vendor-run, and the page states no N, date or hardware.
- **Redaction:** built in (`redact` paths, `censor`, `remove`).
- **Child loggers:** `logger.child({...})`.
- **Serverless:**
  - The default destination is `pino.destination(1)` (stdout), and `pino.destination`'s documented default is `sync: false`.
  - The Lambda guidance is to "always use a destination with `sync: true`".
  - Transports run in worker threads and "boot asynchronously" ([transports.md](https://github.com/pinojs/pino/blob/main/docs/transports.md)).
  - Bundling pino with transports needs extra worker files and `__bundlerPathsOverrides` ([bundling.md](https://github.com/pinojs/pino/blob/main/docs/bundling.md)). That is another reason to avoid transports in functions.

**winston** ([README](https://github.com/winstonjs/winston/blob/master/README.md))
- **JSON:** `format.json` is the default format.
- **Child loggers:** `logger.child({ requestId })`. The README warns `.child` "is likely to be bugged if you're also extending the `Logger` class".
- **Redaction:** none built in. A custom format can only drop whole entries.
- **Flushing:** a `finish` event fires "when all logs have flushed to all transports after the stream has been ended".
- **Performance:** no claim of its own.

**bunyan** ([README](https://github.com/trentm/node-bunyan/blob/master/README.md))
- **JSON:** "A log record is one line of `JSON.stringify`'d output."
- **Child loggers:** `log.child`.
- **Redaction:** none. Serializers can whitelist fields.
- **Maintenance:** status is "Stable"; 2.x lives on a `beta` tag. The last stable release was 2021 (§6.1).
- **Sync/async:** not documented.

**consola** ([README](https://github.com/unjs/consola/blob/main/README.md))
- **JSON:** no built-in JSON reporter; the README only shows a custom reporter calling `JSON.stringify`.
- **Child loggers:** `withTag` / `create` / `withDefaults`.
- **Redaction:** none.
- **Testing:** `mockTypes` for Jest/Vitest.
- **Levels:** `CONSOLA_LEVEL`.
- **Focus:** pretty CLI output.

**loglevel** ([README](https://github.com/pimterry/loglevel/blob/main/README.md))
- **Stated purpose:** "Minimal lightweight simple logging for JavaScript".
- **JSON / redaction:** neither built in; it passes arguments through to `console`.
- **Child loggers:** named loggers via `getLogger`, plus a `methodFactory` plugin hook.
- **Types:** included.

**Node `console` / `node:util` `debuglog`**
- **`console`:** "neither consistently synchronous … nor … consistently asynchronous" ([console](https://nodejs.org/api/console.html)). On POSIX, writes to files and TTYs are synchronous and writes to pipes are asynchronous ([process I/O note](https://nodejs.org/api/process.html#a-note-on-process-io)).
- **Testing:** `new Console({ stdout, stderr })` writes to any stream, which is useful in tests.
- **`util.debuglog(section)`:** writes to stderr only when `NODE_DEBUG` contains the section; otherwise it is a no-op ([util](https://nodejs.org/api/util.html)).
- **Gaps:** neither gives JSON output, redaction or child loggers.

### 6.3 Companion packages
- **`pino-pretty`** ([Readme](https://github.com/pinojs/pino-pretty/blob/master/Readme.md)):
  - "It is recommended to use `pino-pretty` with `pino` by piping output to the CLI tool: `node app.js | pino-pretty`."
  - "We recommend against using `pino-pretty` in production … install … as a development dependency."
  - Options: `--minimumLevel`, `--ignore`, `--levelFirst`.
  - Synchronous use: `pino(pretty({ sync: true }))` is "the only supported way" with Jest.
  - It formats lines that look like ndjson log lines.
- **Axiom:**
  - `@axiomhq/pino` is a worker-thread pino transport ([README](https://github.com/axiomhq/axiom-js/blob/main/packages/pino/README.md)).
  - `@axiomhq/js` is a client whose events are "automatically batch[ed] … in the background", with `flush()` ([guide](https://axiom.co/docs/guides/javascript)).
  - `@axiomhq/logging` ([README](https://github.com/axiomhq/axiom-js/blob/main/packages/logging/README.md)) is a separate `Logger` with `AxiomJSTransport` and `ConsoleTransport({ prettyPrint })`, plus optional Standard-Schema validation of fields.
  - All three require Node ≥ 20.
  - None of the Axiom pages read documents serverless use or redaction. **Gap.**
- **Sentry:**
  - `Sentry.pinoIntegration()` instruments pino in-process. It supports pino `>=8 <11`, with `log.levels` and `error.levels` options ([Sentry pino integration](https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/pino/)).
  - pino's docs say it needs SDK v10.18.0+ ([transports.md](https://github.com/pinojs/pino/blob/main/docs/transports.md#sentry-native-sdk-integration)).
  - `consoleLoggingIntegration` captures `console` calls ([Sentry logs](https://docs.sentry.io/platforms/javascript/guides/node/logs/)).
  - `beforeSendLog` can scrub a log or drop it by returning `null` ([options](https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/)).
- **`@middy/input-output-logger`** ([docs](https://middy.js.org/docs/middlewares/input-output-logger/), [published source](https://unpkg.com/@middy/input-output-logger@7.9.2/index.js)):
  - It "Logs the incoming request (input) and the response (output)".
  - The default logger is `console.log(JSON.stringify(message))` of `{ event }` and `{ response }`.
  - In this repo `event` is the API Gateway-shaped object, so it includes `headers.authorization` and `body`. That conflicts with section 5.
  - The `omitPaths` / `mask` options exist, but they are opt-in.

---

## 7. Testing and viewing logs locally

### 7.1 Readable logs during `netlify dev`
- **How `netlify dev` runs functions:** the netlify-cli JS runtime spawns `new Worker(workerURL, …)` for functions with `runtimeAPIVersion === 2`. Other functions are invoked directly via `lambda-local` ([netlify-cli runtimes/js/index.ts](https://github.com/netlify/cli/blob/main/src/lib/functions/runtimes/js/index.ts)).
- **Where worker output goes:** a worker's `process.stdout` is "piped to the parent thread's `process.stdout`" unless `stdout: true` is passed ([worker_threads](https://nodejs.org/api/worker_threads.html#workerstdout)). netlify-cli does not pass it, so function JSON lines reach the terminal.
- **Docs gap:** Netlify's docs do not describe this; the [Manage functions](https://docs.netlify.com/api-and-cli-guides/cli-guides/manage-functions/) page does not say where logs print.
- **Options for readable output:**
  1. **Pipe (documented by pino-pretty):** `npm run dev:local | npx pino-pretty`. Non-log lines from the CLI are mixed in. pino-pretty only formats lines that look like log lines, but whether it passes other lines through unchanged was not stated in the excerpt read. **Unverified.**
  2. **Transport (`transport: { target: 'pino-pretty' }`):**
     - This would start a pino worker inside netlify-cli's per-invocation worker.
     - pino warns transports boot asynchronously and can drop logs if the thread exits first ([transports.md](https://github.com/pinojs/pino/blob/main/docs/transports.md)). pino's exit-flush hook only runs `if (!opts.sync && isMainThread)` ([lib/tools.js](https://github.com/pinojs/pino/blob/main/lib/tools.js)), so it does not run inside a worker.
     - It also needs bundling support (§6.2).
     - Avoid it.
  3. **In-process stream:** `pino(pretty({ sync: true }))` when `process.env.LOG_PRETTY === '1'`. This is synchronous and has no worker. The `pretty()` stream API is documented in the pino-pretty Readme. `LOG_PRETTY` / `LOG_LEVEL` are our own env names, not a pino or Netlify convention.
- **Environment variables:** `netlify dev` loads env vars for the `dev` or `all` contexts ([Local development](https://docs.netlify.com/api-and-cli-guides/cli-guides/local-development/)), so `LOG_LEVEL=debug` can be set there.

### 7.2 Asserting on logs in vitest
- **`pino-test`** ([README](https://github.com/pinojs/pino-test/blob/main/README.md)):
  - API: `sink()` returns a Transform destination; `once(stream, expected)` and `consecutive(stream, expected[])` return Promises.
  - The README's examples use `node:test` only. It should work under vitest because the helpers are promise-based, but that is an inference, not documented.
  ```ts
  const stream = pinoTest.sink();
  const logger = pino(stream);
  logger.info("hello world");
  await pinoTest.once(stream, { msg: "hello world", level: 30 });
  ```
- **No extra dependency:** pass any `Writable` as the pino destination (pino accepts a stream; [api.md](https://github.com/pinojs/pino/blob/main/docs/api.md)), collect the chunks, then `JSON.parse` each line.
- **For code that still uses `console`:**
  - `vi.spyOn(console, 'error').mockImplementation(() => {})` ([vitest vi](https://vitest.dev/api/vi.html)), then `vi.restoreAllMocks()` / `mockRestore()`.
  - Better: inject the log function, as `unexpectedErrorMiddleware(log)` already allows. Then no global spy is needed.

### 7.3 Testing redaction
The pattern below is not from any single doc; it combines the APIs above:

```ts
const lines: string[] = [];
const logger = pino({ redact: { paths: [...], remove: true } },
  new Writable({ write(c, _e, cb) { lines.push(c.toString()); cb(); } }));
logger.info({ headers: { authorization: "Bearer cap_SECRET" }, email: "t@example.org" }, "x");
const raw = lines.join("");
expect(raw).not.toContain("cap_SECRET");
expect(raw).not.toContain("t@example.org");
```

- Assert on the **raw string**, not only on parsed fields, so values nested under unexpected keys are caught too.
- Run the same assertion through the real `createApiHandler` chain with a request carrying a token, to cover the 500 path in `unexpectedErrorMiddleware`.
- Note that redact paths are case-sensitive ([redaction.md](https://github.com/pinojs/pino/blob/main/docs/redaction.md)). Lower-case header keys first; the repo's wrapper already does this.

### 7.4 Local backends without a cloud account

| Option | Weight | Notes |
|---|---|---|
| Plain stdout + `pino-pretty` / `jq`, or `netlify logs --json` for deployed functions | none | Covers the POC |
| **Sentry Spotlight** | 1 Node process (`npx @spotlightjs/spotlight`, UI on `localhost:8969`, Docker image optional) | "You don't need a Sentry account"; uses the placeholder DSN `https://spotlight@local/0` and `SENTRY_SPOTLIGHT=1`; has a Logs tab ([getting started](https://spotlightjs.com/docs/getting-started/), [site](https://spotlightjs.com/)). Requires adding `@sentry/node`. |
| **Grafana Loki quick start** | **Heavy:** Docker plus Compose, **8 containers** (minio, flog, Loki backend/write/read, nginx gateway, Grafana, Alloy); no RAM figure given ([Loki quick start](https://grafana.com/docs/loki/latest/get-started/quick-start/quick-start/)) | Not recommended on this machine |
| **Axiom** | — | No local or dev mode found in the Axiom pages read. The practical equivalent is a separate dev dataset on the free account (opinion). **Unverified** whether Axiom offers anything local. |
| **Sentry without DSN** | — | "If this is not set, the SDK will not send any events" ([options](https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/)), so local/test runs can simply omit the DSN. |

---

## 8. Recommendation for this repo (opinion, not sourced fact)

1. **Logger: `pino`, writing JSON to stdout synchronously.**
   - Use `pino(pino.destination({ dest: 1, sync: true }))`, following pino's Lambda advice. Make `sync: true` explicit rather than relying on the default.
   - Use no worker-thread transport, and keep `pino-pretty` out of production. For local `netlify dev`, it's fine to pipe output to `pino-pretty`.
   - Put it behind a small outbound `Logger` port, in line with the hexagonal rules, so that `unexpectedErrorMiddleware` and `warnOnParamMismatch` stop calling `console.*` directly. `unexpectedErrorMiddleware` already takes an injectable `log` function.
2. **Correlation:** make one child logger per invocation in `wrapLambdaHandler`:
   - `{ requestId: context.requestId, route: config.path, method }`
   - Log one summary line at the end: `status`, `durationMs`, `errorCode` (the DomainError `code`).
   - Handlers then filter in the Netlify UI and CLI by request ID.
3. **Never log:**
   - `Authorization` header values
   - Capability and Account Tokens, or anything that looks like a token
   - Passwords
   - Teacher emails
   - Raw request bodies
   - Full `headers` objects
   - MongoDB connection strings
   - Back this up with `redact: { paths: ['headers.authorization', '*.token', '*.password', '*.email', 'req.headers.authorization'], remove: true }`. Treat that list as a safety net, not permission to log objects wholesale.
   - Log identifiers instead: pack ID, session ID, account ID. Use a hash if correlation by email is ever needed.
   - For 500s, log the error class, message and stack on the server only, as today.
4. **Service: none for now.** Netlify's built-in logs plus `netlify logs --json` cover a POC. When more than ~1–7 days of history, field queries or alerts are needed, add **Axiom**:
   - Why: it has the largest free retention × volume of the candidates (30 days, 500 GB). It is a native Netlify Log Drain destination, so an Enterprise move would need no vendor change. It has an official JS client.
   - How: send through the `@axiomhq/js` client (not the worker-thread pino transport), via a pino stream that calls `axiom.ingest`, and register `context.waitUntil(axiom.flush())` in `wrapLambdaHandler` so the flush doesn't delay responses.
   - Caveat: Axiom's free plan has only 1 user. If several people need access, Grafana Cloud (3 users, 14 days) is the free alternative.
   - Add Sentry's free Developer plan separately only if error *alerting* becomes a need.
5. **Package set:**
   - **prod:** `pino` only. Not winston, which lacks redaction; not bunyan, which has had no release since 2021; not consola or loglevel, which don't produce structured JSON.
   - **dev:** `pino-pretty` (CLI pipe, or an in-process `pretty({ sync: true })` behind an env flag) and `pino-test`. An injectable `Writable` sink is fine too.
   - **later:** `@axiomhq/js` (direct client and `flush()`). Prefer it over `@axiomhq/pino`, which is a worker transport, and over `@axiomhq/logging`, a second logger API at 0.x.
   - **avoid:** `@middy/input-output-logger`. If ever used, it must have `logger: false` in prod or a strict `omitPaths` list.
6. **Local testing:**
   - Unit-test the logger port with a sink stream. Include a redaction test that injects a real-looking Capability Token, Account Token, password and teacher email, then asserts on the raw output.
   - Read local output via `| pino-pretty`.
   - Skip local log backends. Try Spotlight only if Sentry is adopted.

---

## Sources (all read 2026-11-20)

### Netlify
- Function logs: https://docs.netlify.com/build/functions/logs/
- Logs overview: https://docs.netlify.com/manage/monitoring/logs/
- Log Drains: https://docs.netlify.com/manage/monitoring/log-drains/
- Observability overview: https://docs.netlify.com/manage/monitoring/observability/overview/
- Functions API (Context, `requestId`, `waitUntil`): https://docs.netlify.com/build/functions/api/
- Pricing: https://www.netlify.com/pricing/
- Personal vs Free: https://www.netlify.com/pricing/personal-vs-free/
- Extensions index (old Sentry integration URL): https://docs.netlify.com/integrations/sentry-integration/

### Vendors
- Axiom pricing: https://axiom.co/pricing
- Axiom limits: https://axiom.co/docs/reference/limits
- Axiom Netlify app: https://axiom.co/docs/apps/netlify
- Axiom pino guide: https://axiom.co/docs/guides/pino
- Axiom JavaScript guide: https://axiom.co/docs/guides/javascript
- axiom-js READMEs: https://github.com/axiomhq/axiom-js/blob/main/packages/pino/README.md, https://github.com/axiomhq/axiom-js/blob/main/packages/js/README.md
- Better Stack pricing: https://betterstack.com/pricing
- Better Stack Pino docs: https://betterstack.com/docs/logs/javascript/pino/
- Sentry pricing: https://sentry.io/pricing/
- Sentry Node logs: https://docs.sentry.io/platforms/javascript/guides/node/logs/
- Sentry APIs (`flush`): https://docs.sentry.io/platforms/javascript/guides/express/configuration/apis/#flush
- Datadog pricing: https://www.datadoghq.com/pricing/
- Datadog Logs API: https://docs.datadoghq.com/api/latest/logs/
- New Relic pricing: https://newrelic.com/pricing
- New Relic Log API: https://docs.newrelic.com/docs/logs/log-api/introduction-log-api/
- Grafana pricing: https://grafana.com/pricing/
- Loki HTTP API: https://grafana.com/docs/loki/latest/reference/loki-http-api/
- Logflare pricing: https://logflare.app/pricing

### pino
- api.md: https://github.com/pinojs/pino/blob/main/docs/api.md
- asynchronous.md: https://github.com/pinojs/pino/blob/main/docs/asynchronous.md
- transports.md: https://github.com/pinojs/pino/blob/main/docs/transports.md
- redaction.md: https://github.com/pinojs/pino/blob/main/docs/redaction.md

### Node logging packages and local testing (added 2026-11-20)
- **npm registry and downloads API:**
  - Metadata: `https://registry.npmjs.org/<pkg>`
  - Weekly downloads: `https://api.npmjs.org/downloads/point/last-week/<pkg>`
  - Packages checked: pino, winston, bunyan, consola, loglevel, pino-pretty, pino-test, @axiomhq/js, @axiomhq/pino, @axiomhq/logging, @sentry/node, @spotlightjs/spotlight, @middy/input-output-logger, pino-loki, @types/bunyan, @types/loglevel
- **pino:**
  - README: https://github.com/pinojs/pino/blob/main/README.md
  - benchmarks: https://github.com/pinojs/pino/blob/main/docs/benchmarks.md
  - bundling: https://github.com/pinojs/pino/blob/main/docs/bundling.md
  - lib/tools.js: https://github.com/pinojs/pino/blob/main/lib/tools.js
- **pino-pretty:** https://github.com/pinojs/pino-pretty/blob/master/Readme.md
- **pino-test:** https://github.com/pinojs/pino-test/blob/main/README.md
- **winston:** https://github.com/winstonjs/winston/blob/master/README.md
- **bunyan:** https://github.com/trentm/node-bunyan/blob/master/README.md
- **consola:** https://github.com/unjs/consola/blob/main/README.md
- **loglevel:** https://github.com/pimterry/loglevel/blob/main/README.md
- **Node.js:**
  - console: https://nodejs.org/api/console.html
  - process I/O note: https://nodejs.org/api/process.html#a-note-on-process-io
  - util.debuglog: https://nodejs.org/api/util.html
  - worker_threads: https://nodejs.org/api/worker_threads.html
- **Axiom:** @axiomhq/logging README: https://github.com/axiomhq/axiom-js/blob/main/packages/logging/README.md
- **Sentry:**
  - pino integration: https://docs.sentry.io/platforms/javascript/guides/node/configuration/integrations/pino/
  - options: https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/
- **Spotlight:** https://spotlightjs.com/, https://spotlightjs.com/docs/getting-started/
- **Middy input-output-logger:**
  - docs: https://middy.js.org/docs/middlewares/input-output-logger/
  - source: https://unpkg.com/@middy/input-output-logger@7.9.2/index.js
- **netlify-cli JS runtime:** https://github.com/netlify/cli/blob/main/src/lib/functions/runtimes/js/index.ts
- **Netlify:**
  - Local development: https://docs.netlify.com/api-and-cli-guides/cli-guides/local-development/
  - Manage functions: https://docs.netlify.com/api-and-cli-guides/cli-guides/manage-functions/
- **vitest `vi`:** https://vitest.dev/api/vi.html
- **Grafana Loki quick start:** https://grafana.com/docs/loki/latest/get-started/quick-start/quick-start/

### Unverified / gaps
- Netlify function-log retention for each plan (only "24 h, 7 days for certain plans" is confirmed).
- Whether Netlify parses JSON log lines into fields.
- Whether the 4 KB per-invocation cap applies to native v2 functions.
- Whether Datadog's free tier includes logs.
- The maintainer and serverless behaviour of `pino-loki` (npm page returned 403).
- Sentry free-tier periods (assumed monthly).
- Whether `pino-test` works under vitest; its README only shows `node:test`.
- Whether `pino-pretty` passes non-log lines (netlify-cli's own output) through unchanged.
- Whether Axiom offers any local or dev mode.
- Spotlight's Node log capture: the getting-started Node example doesn't show the logs integration.
- The pino benchmarks have no stated N, date or hardware, and are vendor-run.
- Download counts include transitive installs.
