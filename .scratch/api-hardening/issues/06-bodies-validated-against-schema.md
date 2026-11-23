# 06: Missing or wrongly typed fields return 400 naming the field

**What to build:** A body that is valid JSON but breaks its route's request schema (a missing required field, a wrong type, an unknown enum value) gets **400 `INVALID_REQUEST_BODY`** with `details.field` (the JSON path) and `details.reason` (short and safe, for example "is required" or "must be one of …"), never a 500. One Ajv step in `createApiHandler` does this: it runs after auth and the JSON object check, uses the generated schema for the route's declared operationId, and is skipped for routes with no body. Domain rules keep their own codes (422 `PACK_VALIDATION_FAILED`, 422 `CHAIN_TOPOLOGY_INVALID`, 409 phase errors). Raw Ajv text is never passed through.

See spec: `.scratch/api-hardening/spec.md`. Supersedes api-hardening 02.

**Blocked by:** 05 (Request schemas are generated from openapi.yaml)

**Status:** resolved

- [x] Handler tests: join with no `roomCode`, or a non-string one, returns 400 naming `roomCode`
- [x] Handler tests: create-session with an unknown `mode` or `adjudicationMode`, and transition or adjudicate with a missing or unknown `action`, return 400 naming the field
- [x] A parameterised test over every documented write route: removing each required field returns 400 naming it, never 500
- [x] On token-protected routes, a bad body with no token still returns 401
- [x] No 400 body contains a stack trace, a file path or raw Ajv wording
- [x] Every route declares its operationId to `createApiHandler`, so a new route is validated automatically
- [x] The API overlay catalog's matching deviation lines are removed
- [x] BDD: join with no room code returns 400 through `netlify dev`
- [x] Typecheck, vitest, BDD (one feature per process), lint and boundaries are no worse

## Resolution (2026-11-19)

- **Validator:** `requestBodySchemaMiddleware` (`src/adapters/inbound/http/middy/request-body-schema.middleware.ts`) runs in `createApiHandler` after auth and the JSON object check. One Ajv 2020-12 instance (`discriminator`, no `format` checks, no defaults, first error only) compiles the generated schema of the route's operationId once. A request with no body is checked as `{}`. Failures throw `MalformedRequestBodyError` → 400 `INVALID_REQUEST_BODY` with `details: { field, reason }` in our own words (`field` like `roomCode`, `timerConfig.pretestSec`, `path[1].row`; `reason` like "is required", "must be one of: advance, jump", "must not be empty"). Allowed values are listed from `enum`/`const`, through `oneOf` and the adjudicate discriminator.
- **operationId:** `createApiHandler(rawHandler, authOptions, operationId)`; the third argument is required and typed `ApiOperationId`. The generator now also emits `apiOperationIds` (every operation in `openapi.yaml`). A test checks that each `netlify/functions/<route>.ts` declares the operationId whose path and method match its `config`.
- **ajv** moved to `dependencies`.
- **Defaults applied:** chain path under 2 cells → 400 (2–3 cells stay 422 `CHAIN_TOPOLOGY_INVALID`); empty `narrativeExplanation` → 400; email format stays with the domain (padded mixed-case email still signs up, an invalid one is still 400 `field: email` from the domain).
- **Behaviour changes clients will notice:** transition and adjudicate no longer default a missing `action` (400); instructor rulings need a non-empty `feedback`, and `qualityScore` must be 1–10; survey Likert values outside 1–5 or non-integer are 400 (was 422 `INVALID_SURVEY_RESPONSE`); invalid `timerConfig` keeps 400 but `details` is now `{ field: "timerConfig.<name>", reason }` (was `{ field: "<name>", value }`); pack register and validate with a missing/mistyped required field are 400 (register was 422, validate was 200 with a report; rule problems still go to 422 / the 200 report); sign-in with a non-string email/password is 400.
- **Tests:** `tests/functions/request-body-schema.test.ts` (every write route: each required field removed, each top-level field mistyped → 400 naming it; 401 before body checks; no Ajv wording, paths or stacks; named cases; operationId declarations). Existing tests updated for the changes above. New BDD scenario in `classroom-session-journey.feature`: join without a room code → 400 naming `roomCode`.
- **Docs:** `BadRequestError` and the sign-in 400 in `openapi.yaml` describe schema failures. The prototype API catalog's `stepRationales` samples are strings, the fixed deviations (unvalidated mode/adjudicationMode, missing roomCode 500, stepRationales objects, empty narrative, unenforced feedback/qualityScore, defaulted `action` on adjudicate and transition) are removed, and 400 `INVALID_REQUEST_BODY` is listed on the routes that lacked it.
- **Checks:** typecheck passes; vitest 784/784 (`--no-file-parallelism`); lint 59; boundaries 6; BDD one feature per process against `npm run dev:local`: classroom-session-journey 19/19, solo-session-journey 8/8, assessment-journey 6/6, survey-journey 5/5, teacher-account-journey 10/10.

