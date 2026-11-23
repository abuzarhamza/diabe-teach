# 01: A bad request body never returns a stack trace

**What to build:** Any `/api/v1` request whose body can't be read as JSON (malformed JSON, a body sent without `Content-Type: application/json`, or a body of the wrong shape, such as an array or a string) gets a clean **400 `INVALID_REQUEST_BODY`** in the standard `ApiErrorResponse` shape. The response never contains a stack trace, file path or library message.

On routes that need a token, a request with no valid token gets **401 first**, whatever its body, so unauthenticated callers learn nothing about how bodies are parsed.

As of `8a1e968`, a pack request sent with `curl -d` and no `Content-Type: application/json` returned a stack trace instead of 401, because the JSON body parser runs before the auth check. This was found in the teacher-login ticket 05 report, logged in `.scratch/session-phase-deadlines/wiki/environment-backlog.md`. The earlier API overlay review (`claudPoc/concept-chain/api-catalog.js`) also lists "malformed JSON is not mapped to 400 INVALID_REQUEST_BODY" as a deviation on several routes.

Fix it once, in the shared middleware chain (middy), not route by route. The aim is that a new route gets this behaviour without doing anything.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler tests, over a representative set of routes (one pack write, sign-up, create-session, submit-chain, transition-phase): malformed JSON, a missing JSON content type, and a non-object body each return 400 `INVALID_REQUEST_BODY` with no `stack` and no file path in the body
- [x] Handler test: on a route that needs a token, a bad body with no token returns 401, not 400
- [x] A test fails if any error response body contains a stack trace, for example by checking for `at ` frames or `.ts:` paths across the error-path tests
- [x] Unexpected server errors return 500 with a generic message and no stack; the stack is only logged
- [x] OpenAPI declares the 400 response on the routes that accept a body
- [x] Typecheck, vitest, BDD (`npm run test:bdd`), lint (100) and boundaries (6) are no worse

## Resolution

**2026-11-19.** Every route now builds its handler with `createApiHandler` (`src/adapters/inbound/http/middy/api-handler.ts`), one shared middy chain: `authMiddleware` runs first, then `jsonObjectBodyMiddleware` (`@middy/http-json-body-parser`, then a "must be a JSON object" check), then on error `domainErrorMiddleware` and finally `unexpectedErrorMiddleware` (generic 500 `INTERNAL_ERROR`, stack only logged). Routes that need a token pass `tokenRequired`, so a missing token is a 401 before the body is read. A request with no body is still allowed through. Handlers no longer call `JSON.parse` themselves. OpenAPI now declares 400 `BadRequestError` on every route with a body and lists `INTERNAL_ERROR`; the four "malformed JSON is not mapped" deviations are removed from `claudPoc/concept-chain/api-catalog.js`. Tests: `tests/functions/bad-request-body.test.ts` (58 cases, each error body checked for stack frames and source paths). Typecheck, vitest (524), BDD (5/5), lint (96) and boundaries (6) are unchanged or better.
