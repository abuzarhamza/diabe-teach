# 03: Standalone interactive Bruno HTML docs (`npm run generate:api-docs`), Vitest drift/schema guard, and architecture docs

**What to build:** Wire up standalone HTML documentation generation from `docs/api/bruno/`, add the automated Vitest drift and schema contract suite, verify the collection live against `npm run dev:local`, and document the setup in `docs/agents/api-architecture.md`:
1. **Standalone interactive HTML documentation (`npm run generate:api-docs` -> `docs/api/api-docs.html`):**
   - Add `"generate:api-docs"` to `package.json` to generate `docs/api/api-docs.html` from `docs/api/bruno/` (using `@usebruno/cli` `bru docs generate` if available in the published CLI, or `@usebruno/lang` / Bruno's collection loader into a self-contained Bruno API Docs HTML playground with environment switcher, search, markdown docs, code snippets, and live "Try It" execution).
   - Commit the generated `docs/api/api-docs.html`.
2. **Vitest drift, syntax, and schema contract test (`tests/bruno-collection-drift.test.ts`):**
   - Parses `collection.bru`, both `environments/*.bru`, all 6 `folder.bru` files, and all 21 request `.bru` files under `docs/api/bruno/` using Bruno's official `@usebruno/lang` parser (`bruToJsonV2` / `envToJson`).
   - Asserts a 1-to-1 match between the 21 implemented endpoints (`GET /api/health` + all 20 `/api/v1/*` routes in `netlify/functions/*.ts` and `docs/api/openapi.yaml`) and the 21 `.bru` request files (matching HTTP method and normalized route path).
   - Validates every JSON request body in the `.bru` files against our compiled Ajv 2020-12 request schemas (`src/adapters/inbound/http/request-schemas.generated.ts`) after substituting template placeholders (e.g. `{{customPackId}}`, `{{packId}}`, `{{roomCode}}`).
   - Asserts every `.bru` request file, `folder.bru`, and `collection.bru` has a non-empty `docs` section.
   - Asserts `docs/api/api-docs.html` exists and includes every endpoint name and both environment names (`Local Dev`, `Netlify Production`).
3. **Architecture documentation (`docs/agents/api-architecture.md`):**
   - Add a short section on the Bruno Manual Testing Collection & Interactive HTML Docs (`docs/api/bruno/`, `docs/api/api-docs.html`, `npm run generate:api-docs`, and `tests/bruno-collection-drift.test.ts`).

See spec: `.scratch/bruno-api-docs/spec.md`.

**Blocked by:** 02 (Game Sessions, Concept Chains & Adjudication, and Assessments, Survey & Lifecycle)

**Status:** done

- [x] `npm run generate:api-docs` generates `docs/api/api-docs.html` cleanly from `docs/api/bruno/`
- [x] `tests/bruno-collection-drift.test.ts` passes: all `.bru` files parse via `@usebruno/lang`, all 21 implemented routes match 1-to-1 with `netlify/functions/*.ts` and `docs/api/openapi.yaml`, all JSON request bodies pass Ajv request schema validation, all `.bru` files have `docs`, and `docs/api/api-docs.html` is up to date
- [x] `tests/no-committed-secrets.test.ts` passes 3/3
- [x] `docs/agents/api-architecture.md` documents `docs/api/bruno/`, `npm run generate:api-docs`, and the drift test
- [x] Full sequential verification: `npm run typecheck`, `npx vitest run --no-file-parallelism`, `npm run test:bdd` (against `dev:local`, followed by `dev:local:stop`), `npm run lint` (≤ 29), and `npm run lint:boundaries` (≤ 6)

## Resolution

- Added `scripts/generate-bruno-api-docs.ts` and `"generate:api-docs"` in `package.json`, invoking `@usebruno/cli` (`bru docs generate --all-envs --output docs/api/api-docs.html`) to build the standalone interactive HTML documentation at `docs/api/api-docs.html`.
- Added `tests/bruno-collection-drift.test.ts` (7 tests) verifying that all `.bru` files parse cleanly via `@usebruno/lang`, match all 21 implemented routes 1-to-1 against `netlify/functions/*.ts` and `docs/api/openapi.yaml`, include non-empty `docs` blocks and `script:post-response` variable chaining, pass compiled Ajv 2020-12 request schema validation, and keep `docs/api/api-docs.html` complete.
- Documented the Bruno collection and `npm run generate:api-docs` workflow in Section 9 of `docs/agents/api-architecture.md`.
