# 02: [CONTRACT TESTS] OpenAPI response schema validation suite (`tests/contracts/openapi-response-schemas.test.ts`)

**Category:** Contract Testing (`tests/contracts/`)

**What to build:** Place the `tests/contracts/` folder (with `tests/contracts/README.md`) and build `tests/contracts/openapi-response-schemas.test.ts`, which compiles the `200`/`201` and `4xx` response schemas from `docs/api/openapi.yaml` using `@apidevtools/json-schema-ref-parser` and Ajv 2020-12 and validates the actual HTTP response payloads returned by our route handlers across all 20 implemented `/api/v1/*` operations:
- Dereference `docs/api/openapi.yaml` and compile an Ajv 2020-12 validator for every implemented operation's documented `200`/`201` response schema and `4xx` `ApiErrorResponse` schema.
- Run a complete multi-step API journey through the wrapped route handlers (`signUpInstructor`, `signInInstructor`, `getCurrentInstructorAccount`, `listCurriculumPacks`, `getCurriculumPackById`, `validateCurriculumPack`, `registerCurriculumPack`, `archiveCurriculumPack`, `unarchiveCurriculumPack`, `createGameSession`, `joinGameSession`, `getGameSessionState`, `transitionSessionPhase`, `extendSessionPhase`, `submitConceptChain`, `listRoundChains`, `adjudicateConceptChain`, `getRoundStandings`, `submitAssessmentAttempt` [pretest & posttest], `getSessionAnalytics` [participant & instructor], `submitPerceptionSurvey`, `leaveGameSession`, `endGameSession`) plus representative `4xx` refusals.
- Assert that **every single response body** validates against its OpenAPI response schema in `docs/api/openapi.yaml` (and fix any minor schema drift in `docs/api/openapi.yaml` uncovered by the validator).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `tests/contracts/README.md` and `tests/contracts/openapi-response-schemas.test.ts` exist
- [x] All 20 implemented `/api/v1/*` operations have their `200`/`201` response bodies and `4xx` error bodies validated against compiled `docs/api/openapi.yaml` response schemas via Ajv 2020-12
- [x] Any response schema drift in `docs/api/openapi.yaml` is fixed and `tests/request-schemas-generated.test.ts` + `tests/bruno-collection-drift.test.ts` remain green
