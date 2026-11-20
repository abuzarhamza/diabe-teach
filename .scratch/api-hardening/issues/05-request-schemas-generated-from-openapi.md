# 05: Request schemas are generated from openapi.yaml (prefactor)

**What to build:** A build-time script resolves `docs/api/openapi.yaml` (with `$ref`s resolved) into a committed module of JSON Schemas for each operation's request body, keyed by operationId. Nothing at runtime uses the module yet, and `openapi.yaml` is still not read at runtime. A test regenerates the module in memory and fails if the committed copy is stale. Where the contract is wrong about what the code really accepts, fix `openapi.yaml`, for example `stepRationales` is documented as objects but used as strings. List each such fix in the Resolution.

See spec: `.scratch/api-hardening/spec.md`.

**Blocked by:** None (can start immediately; run after 04 so only one agent works at a time)

**Status:** resolved

- [x] An npm script regenerates the schema module, using a well-known OpenAPI/`$ref` resolver package (ADR-0005), with no hand-written parser
- [x] Test: the committed module matches a fresh generation, and fails when `openapi.yaml` changes without regenerating
- [x] Every operation with a request body has a schema in the module
- [x] Contract fixes, such as `stepRationales`, are listed in the Resolution
- [x] Typecheck, vitest, lint and boundaries are no worse

## Resolution (2026-11-19)

- `npm run generate:request-schemas` runs `scripts/generate-request-schemas.ts`: it parses `docs/api/openapi.yaml` with `yaml`, resolves `$ref`s with `@apidevtools/json-schema-ref-parser` (new devDependency; circular refs refused) and writes `src/adapters/inbound/http/request-schemas.generated.ts`: `requestBodySchemas[operationId] = { required, schema }` for all 11 operations with a body, plus `RequestBodyOperationId`. Nothing imports it at runtime yet.
- Dialect: OpenAPI 3.1, so the output is JSON Schema 2020-12 for `ajv/dist/2020` with `discriminator: true`. The generator drops `discriminator.mapping` (Ajv rejects it; the `oneOf` branches pin `action` with `enum`/`const`) and the annotations `example`, `xml` and `externalDocs`, and refuses the 3.0 keyword `nullable`. `ajv` is now a direct devDependency (it was transitive); ticket 06 should move it to `dependencies`. The generated file is ignored by eslint.
- `tests/request-schemas-generated.test.ts`: committed file equals a fresh generation; an edited contract is detected as stale; every operation with a body has a schema; no `$ref` is left; every schema compiles in Ajv strict mode; `nullable` is refused.
- Contract fixes in `openapi.yaml`:
  - `StepRationale` is a plain string (it was a `{ fromCoord, toCoord, rationale }` object); submit-chain, `ConceptChain` and the Mongo schema all use `string[]`. Affects the submit-chain request and the chain in list-round-chains.
  - `SubmitChainRequest` documents the optional `keywordIds: string[]` that submit-chain reads and stores.
  - Sign-in has its own `SignInRequest` (no `required`, no `minLength: 10`, no `format: email`), because the route documents 401 `INVALID_CREDENTIALS` for a missing field or wrong password; reusing sign-up's `AccountCredentialsRequest` would have turned those into 400 under ticket 06.
  - `AdjudicateChainRequest` gets `type: object` next to its `oneOf`/`discriminator` (Ajv strict mode requires it).
- Left for ticket 06 (contract wins, so these become 400 there): `path` with fewer than 2 cells (today 422 `CHAIN_TOPOLOGY_INVALID`), empty `narrativeExplanation` (accepted today), missing `action` on transition/adjudicate (defaulted today). `format: email` on sign-up needs `ajv-formats` and checks the untrimmed email; the test compiles with `validateFormats: false`.
- Not fixed: the prototype (`claudPoc/concept-chain/api-catalog.js` and its samples test) still builds `stepRationales` as objects and lists the old deviation.
- Checks: typecheck passes; vitest 638 passing (631 + 7); lint 59; boundaries 6.

