# Spec: The API returns the real error code: 403 and 404 under Netlify, and 400 for bad fields

**Status:** ready-for-agent

## Problem Statement

When a request is refused, teachers, learners and developers get an error code that hides the real reason. There are two separate causes.

**1. Under `netlify dev`, a 403 or 404 comes back as a different error.** A function correctly decides "not allowed" (403) or "not found" (404). `netlify dev` treats that response as "maybe there is a page for this" and tries again with `.html` added to the path, for example `/api/v1/packs/abc/archive.html`. On that retry the route parameters are empty, so the handler rejects the request as "missing path parameters" (400 `MISSING_PACK_ID`, or 401). The client only sees the retry's answer. This was seen in these places:
- archive of a System Pack: 403 `PACK_IS_SYSTEM_PACK` arrives as 400 `MISSING_PACK_ID`, found in teacher-login ticket 07 at `93dbb3f`;
- get-standings and list-round-chains: 403 and 404 arrive as 401 "Missing path parameters.", found in list-round-chains ticket 01 at `def5537`.

Every route with a path parameter is exposed: pack by id, archive and unarchive, session state, standings, list and submit chains, adjudicate, transition, assessments and survey. Handler tests never caught it, because they fill in `pathParameters` by hand and never go through Netlify.

Some pack routes still answer with the old `{ error: { code } }` body instead of the standard `{ code, message }` (`ApiErrorResponse`).

**2. Missing or wrongly typed fields crash the server.** The shared pipeline checks that a body is a JSON object, as of api-hardening 01 (`bcab708`). Nothing checks that required fields are present and have the right type. So a missing field fails deep inside the code as 500 `INTERNAL_ERROR`. These cases are known:
- join with no `roomCode`, checked live on 2026-11-19;
- create-session with no or an unknown `mode` or `adjudicationMode`;
- transition and adjudicate with no or an unknown `action`.

Both problems start to hurt as soon as the prototype screens call the real API: Start game, the lobby, and the teacher's in-game buttons. A mistake by the user, or a bug in the screen, shows up as a misleading error.

## Solution

- **Every route reports the real refusal under `netlify dev`.** A 403 is a 403 and a 404 is a 404, with the documented code and the standard `{ code, message }` body. Two fixes work together:
  - stop `netlify dev` from retrying API responses as `.html` pages, if Netlify allows it;
  - read route parameters in **one shared place**, by matching the real URL against the route's `config.path`, so no handler can lose them. A `.html` retry of an API path is never treated as a fresh, broken request.
- **A body that breaks its route's request schema gets 400 `INVALID_REQUEST_BODY`,** naming the field (`details.field`) and the problem, instead of a 500. One validation step in the shared middy chain checks every body against that route's request schema. The schemas are generated from `docs/api/openapi.yaml` at build time, so the code and the contract can't drift apart, and a new route is validated without extra work.

## User Stories

1. As a teacher, I want archiving a System Pack to tell me "this is a built-in pack", so that I understand why it was refused.
2. As a teacher, I want archiving a pack that no longer exists to tell me "pack not found", so that I can refresh my list.
3. As a teacher, I want archiving an already archived pack, or unarchiving one that isn't archived, to tell me so (409), so that a double click is harmless and clear.
4. As a teacher, I want opening a pack that doesn't exist to return "pack not found", so that Game setup can show a sensible message.
5. As a learner, I want opening a session that doesn't exist to say "session not found", not "missing path parameters", so that I know the link or room is wrong.
6. As a learner, I want using a token from another session to say "forbidden" (403), so that I understand I'm in the wrong game.
7. As a teacher, I want standings and chain lists for a session I don't own to be refused with 403, so that the screen can explain it.
8. As a developer, I want the same error codes under `netlify dev` as in the handler tests and in production, so that what I debug locally is what users get.
9. As a developer, I want every error body to have the standard `{ code, message }` shape, so that the screens read errors in one way.
10. As a developer, I want route parameters taken from the real URL in one shared place, so that a new route can't make this mistake again.
11. As a developer, I want handler tests to build requests the way the real Netlify wrapper does, so that a lost route parameter fails a test.
12. As a developer, I want BDD scenarios that check the real 403, 404 and 409 codes through `netlify dev`, so that the routing layer is tested end to end.
13. As a learner, I want joining with no room code to say "roomCode is required" (400), so that the screen can point at the empty field.
14. As a learner, I want joining with a room code that isn't text to return 400 naming `roomCode`, so that a screen bug is easy to spot.
15. As a teacher, I want Start game with no adjudication mode, or an unknown one, to return 400 naming `adjudicationMode`, so that I know which setting to fix.
16. As a teacher, I want Start game with an unknown `mode` to return 400 naming `mode`.
17. As a teacher, I want a phase change with no `action`, or an unknown one, to return 400 naming `action`.
18. As a teacher or learner, I want a ruling or vote with no `action`, or an unknown one, to return 400 naming `action`.
19. As a teacher, I want pack registration with missing required pack fields to return 400 naming the field, rather than a 500. Rules about the pack's content still return 422 `PACK_VALIDATION_FAILED`.
20. As a developer, I want no write route to return 500 for any body that is valid JSON but breaks its OpenAPI request schema, so that 500 always means a real server bug.
21. As a developer, I want the request schemas generated from `docs/api/openapi.yaml`, so that changing the contract changes validation, with no second copy to keep in step.
22. As a developer, I want a check that fails when the generated schemas are out of date with `openapi.yaml`, so that nobody forgets to regenerate them.
23. As a developer, I want a new route to get body validation just by declaring its OpenAPI operation, so that hardening is the default.
24. As a client developer, I want a request with no valid token to get 401 before its body is validated, as it already is for JSON parsing, so that unauthenticated callers learn nothing about the schemas.
25. As a client developer, I want the 400 body to list the failing field and a short reason, without any stack trace or library internals, so that it's safe to show and easy to act on.
26. As a developer, I want the prototype's API catalog to stop listing these as deviations once they're fixed, so that the overlay shows the truth.

## Implementation Decisions

**Route parameters and the `netlify dev` retry**

- **Investigate first.** Confirm the retry mechanism under `npm run dev:local`: which statuses trigger it, and whether the second request reaches the function. Find out whether a deployed site behaves the same way (it may not). Record what was found in the ticket.
- **Stop the retry where Netlify allows it,** through a `netlify.toml` setting or a response header on API responses. Use it only if it is a documented Netlify behaviour; otherwise skip it and rely on the next point.
- **One shared source of route parameters, in the Netlify v2 → Lambda wrapper.**
  - Each function's `config.path` (for example `/api/v1/sessions/:sessionId/rounds/:roundNumber/chains`) is matched against the request URL with a well-known path-matching package, per ADR-0005; `path-to-regexp` is already in the dependency tree.
  - The result fills `pathParameters`.
  - `context.params` stays as a cross-check.
  - A `.html` suffix on an `/api/` path is never treated as a new request with empty parameters.
  - Handlers keep reading `event.pathParameters`, and stop doing their own "missing parameter" guessing beyond a final safety check.
- **The wrapper needs each route's `config.path`.** Each function passes it in (for example `wrapLambdaHandler(handler, config)`), or exports both from one place, so that the path is declared once.
- **Error bodies.** The pack routes that still send `{ error: { code } }` switch to the standard `ApiErrorResponse` `{ code, message, details? }`. Domain errors already go through `domainErrorMiddleware`, so the remaining hand-written error bodies are removed.

**Request body validation**

- **Validator:** a body-schema step in `createApiHandler`, after `authMiddleware` and `jsonObjectBodyMiddleware`, before the handler. It uses **Ajv**, the standard JSON Schema validator, which is already in the dependency tree and follows ADR-0005.
- **Schema source:** generated from `docs/api/openapi.yaml` at build time, with `$ref`s resolved, into a module keyed by operationId. The generated file is committed. A test fails when it is stale, by regenerating it in memory and comparing. `openapi.yaml` is still not read at runtime, so the architecture doc's rule holds.
- **Which schema applies:** each route declares its operationId to `createApiHandler`, and the chain looks up that operation's request schema. Routes without a request body skip this step.
- **Error:** 400 `INVALID_REQUEST_BODY`, with `details.field` (the JSON path of the first failing field) and `details.reason` (a short, safe reason such as "is required", "must be one of …" or "must be a string"). Ajv's raw error objects and messages are not passed through verbatim.
- **Boundary with domain rules:** the schema catches shape problems (missing field, wrong type, unknown enum value). Domain rules keep their own codes, for example 422 `PACK_VALIDATION_FAILED`, 422 `CHAIN_TOPOLOGY_INVALID` and 409 phase errors.
- **Where the spec and the code disagree:**
  - **If the code is right,** fix `openapi.yaml`. For example, `stepRationales` is documented as objects but is used as strings.
  - **If the code accepts something the contract forbids,** the contract wins, and the change is listed in the ticket.
- **Order inside the chain:** an auth failure stays 401 before any body check (from api-hardening 01).

## Testing Decisions

- **What a good test checks:** external behaviour only, meaning the status code and response body for a given request, never which middleware produced them.
- **Route parameters:**
  - **BDD (through `netlify dev`):**
    - archiving the System Pack returns 403 `PACK_IS_SYSTEM_PACK`;
    - archiving an unknown pack returns 404 `PACK_NOT_FOUND`;
    - archive twice returns 409, and unarchive twice returns 409, each with a `{ code, message }` body;
    - `GET` an unknown pack returns 404;
    - an unknown session's state returns 404;
    - another session's token on standings and on list-round-chains returns 403.
  - **Wrapper unit test:** a `Request` plus a `config.path` produces the right `pathParameters`, including when `context.params` is empty, and a `.html` retry of an API path doesn't produce empty parameters.
  - **Handler test support:** a helper that builds events through the real wrapper. The existing hand-built `pathParameters` events move to it over time.
  - **Prior art:** `tests/functions/bad-request-body.test.ts`, the BDD pack scenarios in `teacher-account-journey.feature`, and `tests/integration/support/http-client.ts`.
- **Body validation:**
  - a parameterised handler test over every documented write route, where a body missing each required field, or with a wrong type or enum value, returns 400 naming that field, and never 500;
  - named cases: join with no `roomCode`; create-session with an unknown `mode` or `adjudicationMode`; transition and adjudicate with a missing or unknown `action`;
  - with no token, a bad body still returns 401 on token-protected routes;
  - no 400 body contains a stack trace, a file path or raw Ajv wording;
  - a test fails when the generated schemas don't match `openapi.yaml`;
  - prior art: `tests/functions/bad-request-body.test.ts`.
- **Running the checks:** typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process: `npm run test:bdd <feature>`), lint (baseline 92) and boundaries (baseline 6) must be no worse.

## Out of Scope

- Validating responses against OpenAPI.
- Validating query strings and path parameters against schemas. Only route parameter *extraction* is in scope; a bad `roundNumber` is already a 400.
- Removing the remaining forced `netlify.toml` redirects on session and account routes. That's a separate backlog item, though the investigation may show it to be related.
- Request size limits, and changes to error codes other than those listed here.
- Wiring the prototype screens to the real API.

## Further Notes

- This spec covers two existing tickets:
  - `.scratch/teacher-login/issues/08-archive-errors-under-netlify-dev.md`, whose scope is widened here to every `:param` route (see its 2026-11-19 comment);
  - `.scratch/api-hardening/issues/02-missing-required-fields-return-400.md`.

  The to-tickets step should replace them with tickets under `.scratch/api-hardening/issues/` and mark the originals as superseded.
- Related ADRs:
  - ADR-0005: npm-first dependencies, hence Ajv and `path-to-regexp`;
  - ADR-0004: OpenAPI and security handlers, superseded in part; `openapi.yaml` is the contract but is not read at runtime;
  - ADR-0007: two token kinds; the 401 ordering is unchanged.
- Recommended order: route parameters first, because the BDD checks for body validation go through `netlify dev` and need the real error codes.
