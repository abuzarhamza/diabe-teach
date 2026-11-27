---
name: verify-diabe-teach-api
description: "Launch, health-check and drive the diabe-teach HTTP API (Netlify Functions v2 on localhost:8888 with in-memory MongoDB) the way a teacher or learner client does, and capture redacted request/response evidence in .verification/. Use to prove an API change works in the running app (not just in unit or BDD tests): teacher accounts, curriculum packs, classroom session lifecycle, concept chains and adjudication, assessments, survey and analytics."
---

# Verify the diabe-teach API

diabe-teach is a concept-chaining classroom game. The surface a user touches is the **HTTP API**: 24 routes, one Netlify Functions v2 file per route in `netlify/functions/<route>.ts`, each with its own `config.path` and `method`. The contract is `docs/api/openapi.yaml`, but the code is what runs; where they disagree, trust the response and note the mismatch. `web/` is only an empty Vite scaffold as of `37e2b89`, so there is no UI to drive yet. Terms such as Game Session, Concept Chain and Instructor Final Ruling are defined in `GLOSSARY.md`.

Every helper lives in `.agents/skills/verify-diabe-teach-api/scripts/`. Run them from the repo root. Below, `vapi` is shorthand for `node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts`. Define it as a function at the start of every shell call, because shell state does not persist between calls. A function works in both bash and zsh, but `V="node …"; $V` does not work in zsh, which doesn't word-split variables.

```bash
vapi() { node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts "$@"; }
```

## Rules

- **One dev server, one agent.** Port 8888 holds one instance. `launch.sh` refuses to start when the port is taken. Never drive an instance this run did not start, because another agent's BDD run may be using it.
- **Run checks one at a time.** Don't run BDD, Bruno or vitest suites at the same time as a verification run.
- **Never `pkill`.** Stop the server with `scripts/cleanup.sh` (which calls `npm run dev:local:stop`).
- **Don't edit source while the server is running.** netlify dev reloads functions in the middle of a run, and requests then time out after 30 s.
- **Never print or copy the API key.** The real key is in `.env.dev.yaml` (and in `tests/integration/test-config.yaml`). `vapi` loads it through `AppRuntime.loadEnvConfig()` and redacts it from all evidence. Don't `cat` those files.

## Launch

```bash
.agents/skills/verify-diabe-teach-api/scripts/launch.sh [run-id]
```

This runs `npm run dev:local` in the background. That script starts MongoMemoryServer, seeds the `diabe-teach` System Pack, then runs `netlify dev` on `http://localhost:8888`. Expect 30 to 120 s on a cold start. `launch.sh` creates `.verification/<run-id>/` (default id: the UTC timestamp) and writes the id to `.verification/CURRENT`. It saves the dev:local PID to `<run-dir>/dev-local.pid` and stdout to `<run-dir>/dev-local.stdout.log`.

**Ready** means `launch.sh` printed `DEV READY http://localhost:8888` and exited 0. dev:local prints that line only after every function in `netlify/functions/` has logged `Loaded function <name>` and a real route (`GET /api/v1/packs`) answers something other than 404. Port 8888 starts answering 404 before that, so an open port does not mean ready. Each launch gets an empty database. The only seeded data is the `diabe-teach` pack: there are no accounts, no sessions and no custom packs.

If it prints `LAUNCH FAILED` or `LAUNCH TIMED OUT`, read the tail it prints and `.netlify/dev-local.log`, then run cleanup before you retry. MongoMemoryServer has once stalled on start. If that happens again, relaunch with `MONGOMS_DEBUG=1` set.

Teardown is covered in [Cleanup](#cleanup).

## Doctor

Run this first, and again whenever something looks off. It only reads.

```bash
vapi doctor
```

It checks that port 8888 has a listener, that `.netlify/dev-local.log` contains `DEV READY` and an in-memory `mongodb://127.0.0.1` URI (so the instance came from dev:local and not from plain `netlify dev` against the remote cluster), that `GET /api/health` returns 200, that `GET /api/v1/packs` with the key returns 200 and lists `diabe-teach`, and that the same request without the key returns 401 (the key is enforced and the loaded key is correct). It prints `git HEAD` and the listener PIDs, and writes `<run-dir>/doctor.json`. Drive only after `DOCTOR HEALTHY`.

If the no-key check fails, the server was started with `npm run dev:prototype` (key off). That server is not ours: don't drive it.

## Drive

There are three ways to drive the API, in order of preference.

1. **`vapi req`** (main harness). Each call sends one HTTP request the way a client would, saves one evidence file, and can check the status and error code and save response fields for later calls.

   ```bash
   vapi req <feature> <label> <METHOD> <path> \
     [--auth <var>] [--json '<body>' | --bru-body <file.bru>] [--no-key] \
     [--expect <status>] [--expect-code <ApiErrorCode>] [--expect-field <dot.path>=<value>]... \
     [--save <var>=<dot.path>]...
   ```

   - `{{var}}` in the path or body is replaced from `<run-dir>/vars.json`. `--save accountToken=accountToken` stores a response field there, and `--auth accountToken` sends `Authorization: Bearer <that value>`. `vapi vars` lists the saved names.
   - `--expect-field accountId={{accountId}}` compares a response field (as a string) with a literal or a saved var. Use it to prove that a later read shows what an earlier write did.
   - The command exits 1 when an expectation fails. Its output is `PASS|FAIL <status> <METHOD> <path> -> <evidence file>` followed by the redacted body.
   - Pass `--json` for every POST that has a body, even an empty `'{}'`. The body is sent with `Content-Type: application/json`. `--bru-body docs/api/bruno/<folder>/<request>.bru` reuses that Bruno request's `body:json` block (its `{{vars}}` are filled the same way), so long bodies such as a pack definition don't have to be pasted. `vapi set name=value` puts a literal value into vars, for example `vapi set customPackId=endocrine-intro`.
2. **`vapi bruno <feature> <folder>`** runs one folder of the Bruno collection (`docs/api/bruno/01-Health` … `06-Assessments-Survey-and-Lifecycle`) against the running server and saves Bruno's JSON report, with the key and tokens redacted, as `<run-dir>/<feature>/bruno-<folder>.json`. It only covers the happy path, and its pre-request scripts advance phases or create new sessions behind your back. Use it as a smoke check, not as proof of a sub-feature. `npm run test:bruno` runs the whole collection but saves no evidence.
3. **BDD** (`npm run test:bdd <feature>`, with features in `tests/integration/features/`) is the regression suite. It needs the same server. Run one feature per run, and never in the middle of a verification run.

**Auth model (ADR-0007).** Every `/api/v1/*` call needs `x-api-key`, which `vapi` adds for you. There are two kinds of bearer token, and a route that wants one refuses the other with `401 UNAUTHORIZED_TOKEN`:

- **Account Token** (teacher): returned by sign-up and sign-in. Needed for `/accounts/me`, pack validate/register/archive/unarchive, and creating a `classroom` or `study-rct` session.
- **Capability Token** (per session): `instructorToken`, returned by create-session, and `participantToken`, returned by join (or by a `solo` create). Needed for every `/api/v1/sessions/:sessionId/*` route.

**Routes** (the method and path come from each function's `config`):

| Feature | Method and path |
|---|---|
| health | `GET /api/health` (no key needed) |
| accounts | `POST /api/v1/accounts/sign-up`, `POST /api/v1/accounts/sign-in`, `GET /api/v1/accounts/me` |
| packs | `GET /api/v1/packs[?includeArchived=true]`, `GET /api/v1/packs/:packId`, `POST /api/v1/packs/validate`, `POST /api/v1/packs`, `POST /api/v1/packs/:packId/archive`, `POST /api/v1/packs/:packId/unarchive` |
| sessions | `POST /api/v1/sessions`, `POST /api/v1/sessions/join`, `GET /api/v1/sessions/:sessionId`, `POST /api/v1/sessions/:sessionId/phase`, `POST /api/v1/sessions/:sessionId/phase/extend`, `POST /api/v1/sessions/:sessionId/leave`, `POST /api/v1/sessions/:sessionId/end` |
| chains | `POST` and `GET /api/v1/sessions/:sessionId/rounds/:roundNumber/chains`, `POST /api/v1/sessions/:sessionId/rounds/:roundNumber/chains/:chainId/adjudicate`, `GET /api/v1/sessions/:sessionId/rounds/:roundNumber/standings` |
| assessment | `POST /api/v1/sessions/:sessionId/assessments/:stage`, `POST /api/v1/sessions/:sessionId/survey`, `GET /api/v1/sessions/:sessionId/analytics` |

`GET /api/v1/sessions/:sessionId/stream` is in the OpenAPI spec but deferred: there is no function for it, so don't try to verify it.

The step-by-step recipes are in the feature map, [`features/README.md`](features/README.md). Pick the feature, check its preconditions, and run its bullets in order.

## Evidence

Everything goes under `.verification/<run-id>/`. That folder is git-ignored, and cleanup never deletes it.

| File | What it shows |
|---|---|
| `doctor.json` | instance identity: git HEAD, listener PIDs, statuses and checks |
| `<feature>/NN-<label>.json` | one request and response: method, URL, headers with the key and bearer value replaced by the var name, body, status, response body, expectations, `PASS`/`FAIL` verdict |
| `<feature>/bruno-<folder>.json` | Bruno report, when you used `vapi bruno` |
| `dev-local.stdout.log`, `dev-local.log` | the server's own log, with one pino line per request (copied at cleanup) |

Every value whose key ends in `Token`, and the API key wherever it appears, is replaced by `<redacted …>`. The live tokens stay only in `vars.json`, and cleanup deletes that file.

What counts as proof:

- **Use the real user path.** Drive the public routes with the real auth. There are no test-only endpoints. Don't use `DEV_DISABLE_API_KEY` or `dev:prototype`, and don't call use cases or repositories directly.
- **Capture the action and the resulting state.** Every write needs a later read that shows what changed: sign-up, then sign-in and `GET /accounts/me`; a phase advance, then `GET /sessions/:id`; a chain ruling, then the chain list and standings. A 2xx on the write alone is not proof.
- **Check side effects from a second point of view.** For example, a learner's `participantToken` sees what the instructor's write changed, and an archived pack disappears from the default list and reappears with `includeArchived=true`.
- **Prove error paths by their `code`.** Use `--expect-code` with the `ApiErrorCode` (for example `EMAIL_ALREADY_REGISTERED`), not only the status. Under netlify dev a 403 or 404 used to come back as a misleading 401 or 400 "missing path parameters" (netlify dev retries the request as `<path>.html`). A mismatched code is a finding, not noise.
- **No mocks.** The only stand-in is the in-memory MongoDB, which replaces Atlas behind the same mongoose adapter.
- Report a step you could not reach with the command you tried and the precondition that was missing. Don't count it as verified through some other path.

## Cleanup

```bash
.agents/skills/verify-diabe-teach-api/scripts/cleanup.sh
```

The script copies `.netlify/dev-local.log` into the run dir, then sends SIGTERM to the PID that `launch.sh` recorded (dev:local also stops its netlify process group and MongoMemoryServer). Next it runs `npm run dev:local:stop` to sweep any leftovers and check the port, prints `PORT 8888 FREE`, deletes `<run-dir>/vars.json`, and lists the evidence files it kept. Run it after every run, including failed and aborted ones, so no processes or ports are left behind. The in-memory database disappears with the server, so there is no data to clean up.

If you are confirming by hand, `lsof -ti tcp:8888 -sTCP:LISTEN` printing nothing means the port is free.

## Helpers

| Script | How to call it |
|---|---|
| `scripts/launch.sh` | `.agents/skills/verify-diabe-teach-api/scripts/launch.sh [run-id]` |
| `scripts/vapi.ts` | `node --import tsx .agents/skills/verify-diabe-teach-api/scripts/vapi.ts init [run-id] \| doctor \| req … \| bruno <feature> <folder> \| set name=value \| vars` |
| `scripts/cleanup.sh` | `.agents/skills/verify-diabe-teach-api/scripts/cleanup.sh` |

`vapi.ts` is deliberately a thin wrapper over `fetch`. It exists so the API key never appears on a command line or in a transcript. For anything it can't do, reuse the Bruno collection rather than writing new tooling.

## Keeping the map honest

When a route, body or error code changes, update the matching file in `features/` in the same change. Use `/maintain-verification-skill` to bring the map back in line with the app.
