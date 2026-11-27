# 04: [FUZZ TESTS] HTTP wrapper & Middy middleware pipeline fuzzing (`tests/fuzz/api-handler-fuzz.test.ts`)

**Category:** Fuzz Testing (`tests/fuzz/`)

**What to build:** Create `tests/fuzz/` (with `tests/fuzz/README.md`) and build `tests/fuzz/api-handler-fuzz.test.ts` using `fast-check` to fuzz the full `wrapLambdaHandler` + `createApiHandler` pipeline across representative endpoints (`signUpInstructor`, `signInInstructor`, `registerCurriculumPack`, `createGameSession`, `joinGameSession`, `transitionSessionPhase`, `submitConceptChain`, `adjudicateConceptChain`, `submitAssessmentAttempt`, `submitPerceptionSurvey`):
- **Arbitrary raw body strings & malformed JSON:** Feed arbitrary Unicode/ASCII strings, truncated JSON, arrays, primitives, and `null` bodies into POST routes and assert the response status is always `400` (`INVALID_REQUEST_BODY`) or `401` (`UNAUTHORIZED_TOKEN`), never `500`.
- **Arbitrary JSON objects & prototype-pollution payloads:** Feed arbitrary nested JSON objects (including `__proto__`, `constructor`, `toString`, `valueOf`, negative integers, `MAX_SAFE_INTEGER`, empty strings, and unexpected properties) with valid auth tokens into all write routes and assert:
  - Status is always a controlled client status (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `413`, `422`, `423`), **never `500 INTERNAL_ERROR`**.
  - Every `4xx` response body is valid JSON containing `{ code, message }` and **never contains a stack trace (`at `), `.ts:` file path, or `node_modules`**.
- **Arbitrary `Authorization` headers & URL path parameters:** Fuzz `Authorization` header strings (random Bearer tokens, non-Bearer prefixes, control characters) and URL path parameters (`:sessionId`, `:roundNumber`, `:chainId`, `:packId`, `:stage`), asserting clean `400`/`401`/`403`/`404` responses and zero unhandled exceptions.

**Blocked by:** 03 (Property-based domain & analytics invariant suite — installs `fast-check`)

**Status:** done

- [x] `tests/fuzz/README.md` and `tests/fuzz/api-handler-fuzz.test.ts` exist and pass in Vitest
- [x] Fuzzes raw body strings, arbitrary JSON objects (including `__proto__`/`constructor` keys), `Authorization` headers, and URL path parameters across the wrapped handlers
- [x] Proves zero `500 INTERNAL_ERROR` responses and zero stack-trace leaks across all generated inputs
