# Spec: Bruno API manual testing collection and standalone interactive HTML documentation

**Status:** ready-for-agent

## Problem Statement

Developers, instructors, and reviewers who want to manually explore, test, or demonstrate the Concept-Chain Educational Game Engine API currently have three disconnected artefacts:
- the static OpenAPI contract (`docs/api/openapi.yaml`), which is a 2,300-line YAML file with no runnable request runner or environment state;
- the prototype HTML API catalog overlay (`claudPoc/`), which is designed as an internal UI gap matrix rather than an interactive HTTP client;
- the automated Vitest and Cucumber test suites, which are built for CI verification rather than ad-hoc interactive stepping through a live server.

When someone starts `npm run dev:local` (or tests a deployed Netlify preview) and wants to manually step through a complete journey—signing up an Instructor Account, validating and registering a Curriculum Pack, creating a Classroom Game or Solo Practice Game Session, joining with a room code, advancing phases, submitting and adjudicating a Concept Chain, and submitting Pretest/Posttest Assessment Attempts and the perception survey—they have to hand-craft `curl` commands and manually copy-paste `accountToken`, `instructorToken`, `participantToken`, `sessionId`, `roomCode`, and `chainId` between calls. Furthermore, there is no standalone interactive Bruno API Docs HTML page generated from a Git-tracked Bruno collection.

## Solution

Adopt **Bruno** ([`docs.usebruno.com/api-docs/overview`](https://docs.usebruno.com/api-docs/overview)) as the repository's Git-tracked manual API testing collection and interactive documentation source:

1. **A complete, Git-tracked Bruno collection (`docs/api/bruno/`):**
   - Covers all **21 implemented API endpoints** (`GET /api/health` plus all 20 `/api/v1/*` routes across Instructor Accounts, Curriculum Packs, Game Sessions, Concept Chains & Adjudication, and Assessment Attempts, Perception Survey & Analytics).
   - Organized into **6 domain resource folders (`01` through `06`)** ordered in a natural playable sequence (`seq`) so clicking top-to-bottom in the Bruno Desktop App (or running via the Bruno CLI) walks through an entire Classroom Game and pack-authoring lifecycle without dead ends.
   - Every `.bru` file contains a rich Markdown `docs { ... }` block explaining the endpoint's purpose, required authentication scheme (`AccountAuth`, `BearerAuth` with role, or public + `x-api-key`), path/query/body parameters, and expected success and domain error codes (`ApiErrorCode`).
2. **Automatic token and ID chaining (`script:post-response`) for zero-copy-paste manual testing:**
   - Sign-up and sign-in requests automatically store `accountToken` and `accountId` into Bruno runtime/collection variables.
   - Session creation automatically stores `sessionId`, `roomCode`, and `instructorToken`.
   - Learner join automatically stores `participantId` and `participantToken`.
   - Concept Chain submission automatically stores `chainId` and `activeRoundNumber`.
   - Subsequent requests reference `{{accountToken}}`, `{{instructorToken}}`, `{{participantToken}}`, `{{sessionId}}`, `{{roomCode}}`, and `{{chainId}}` automatically, so a tester never has to copy-paste tokens or IDs between steps.
3. **Safe, secret-free Bruno environments (`docs/api/bruno/environments/`):**
   - `Local Dev.bru`: pre-configured for `http://localhost:8888` (`npm run dev:local` / `npm run dev:prototype`) with placeholder/non-secret variables and safe defaults (`packId: diabe-teach`, `roundNumber: 1`).
   - `Netlify Production.bru`: pre-configured for the deployed Netlify site URL with `apiKey` and tokens declared safely without any real credentials committed to Git (keeping the repository's secret-scanning test suite 100% green).
4. **Standalone interactive Bruno HTML documentation (`docs/api/api-docs.html` & `npm run generate:api-docs`):**
   - Provide an npm script (`npm run generate:api-docs`) that builds the standalone, single-file interactive HTML documentation site from `docs/api/bruno/` using Bruno's official tooling (`@usebruno/cli` / Bruno docs generator), complete with request documentation, environment variables, code snippets, and interactive playground support.
5. **Automated drift & syntax verification in Vitest and live CLI smoke verification:**
   - A Vitest contract test parses every `.bru` file in `docs/api/bruno/` and asserts that:
     - every implemented Netlify Function route (`netlify/functions/*.ts`) and implemented operation in `docs/api/openapi.yaml` has a corresponding `.bru` request file with matching HTTP method and URL path pattern;
     - every `.bru` request file has a non-empty `docs { ... }` markdown block;
     - every JSON request body in the collection validates against our generated OpenAPI request schemas (`request-schemas.generated.ts`);
     - no `.bru` or environment file contains real secrets.

## User Stories

1. As a developer or reviewer opening the repository in the Bruno Desktop App, I want to open `docs/api/bruno/` as a collection and immediately see all 21 implemented endpoints organized in numbered folders, so that I can explore and test the API without importing or configuring anything by hand.
2. As a developer running `npm run dev:local`, I want to select the `Local Dev` environment in Bruno and run requests immediately against `http://localhost:8888`, so that local manual testing works out of the box.
3. As a manual tester walking through the collection top-to-bottom, I want `Sign Up Instructor` and `Sign In Instructor` to automatically save `accountToken` and `accountId` on a `201`/`200` response, so that all `AccountAuth` requests (`GET /accounts/me`, pack registration, pack validation, archive/unarchive, and classroom session creation) work without copying tokens.
4. As a manual tester, I want `Create Game Session` to automatically save `sessionId`, `roomCode`, and `instructorToken` on a `201` response, so that subsequent instructor requests (advancing phase, extending phase, listing chains, adjudicating, viewing standings/analytics, and ending the session) use the newly created Game Session automatically.
5. As a manual tester, I want `Join Game Session` to automatically save `participantId` and `participantToken` using `{{roomCode}}` on a `200` response, so that learner requests (Pretest, Concept Chain submission, peer voting, Posttest, perception survey, and leaving a session) authenticate as the joined learner automatically.
6. As a manual tester, I want `Submit Concept Chain` to automatically save `chainId` on a `201` response, so that `Adjudicate Concept Chain` (both peer vote and Instructor Final Ruling) targets the just-submitted Concept Chain without manual ID copying.
7. As a reader of the API documentation in Bruno or the generated HTML docs, I want every request, folder, and collection root to include rich Markdown `docs` describing the domain concept (using `GLOSSARY.md` terms), authentication requirements (per ADR-0007), request parameters, and possible `ApiErrorCode` responses.
8. As a pack author testing Curriculum Pack endpoints, I want ready-to-run `.bru` requests for `List Curriculum Packs`, `Get Curriculum Pack By ID`, `Validate Curriculum Pack`, `Register Curriculum Pack`, `Archive Curriculum Pack`, and `Unarchive Curriculum Pack` with a valid sample Curriculum Pack payload, so that I can test the shared pack library lifecycle manually.
9. As an instructor testing Game Session controls, I want ready-to-run `.bru` requests for `Create Game Session`, `Get Game Session State`, `Transition Session Phase`, `Extend Session Phase`, and `End Game Session`, so that I can drive a Classroom Game manually.
10. As a learner testing gameplay and assessments, I want ready-to-run `.bru` requests for `Join Game Session`, `Submit Pretest Assessment`, `Submit Concept Chain`, `List Round Chains`, `Adjudicate Concept Chain (Peer Vote)`, `Adjudicate Concept Chain (Instructor Final Ruling)`, `Get Round Standings`, `Submit Posttest Assessment`, `Get Session Analytics`, `Submit Perception Survey`, and `Leave Game Session`.
11. As a developer or external consumer who does not have the Bruno Desktop App installed, I want a standalone interactive HTML documentation file (`docs/api/api-docs.html`) generated by `npm run generate:api-docs`, so that I can browse the collection, read the Markdown docs, inspect code samples, and use the interactive playground in any browser.
12. As a security-conscious maintainer, I want `Local Dev.bru` and `Netlify Production.bru` to contain only placeholder values or secret variable declarations (`vars:secret`), so that `tests/no-committed-secrets.test.ts` passes and no real API key, JWT secret, or MongoDB URI is ever committed.
13. As a developer modifying or adding an API route in the future, I want a Vitest drift test to fail if an implemented route in `netlify/functions/` or `docs/api/openapi.yaml` is missing from `docs/api/bruno/`, lacks a `docs` block, or has a sample JSON body that violates the OpenAPI request schema, so that the Bruno manual testing docs never drift from the real API.
14. As a developer updating documentation, I want `docs/agents/api-architecture.md` to document the Bruno collection layout, environment variables, and `npm run generate:api-docs` command, so that future agents and contributors keep it in sync.

## Implementation Decisions

- **Collection location and structure (`docs/api/bruno/`):**
  - `bruno.json` at `docs/api/bruno/bruno.json` declaring the collection name (`"Diabe-teach Concept-Chain API"`), version `"1"`, type `"collection"`, and ignore list (`node_modules`, `.git`).
  - `collection.bru` at `docs/api/bruno/collection.bru` setting shared headers (`x-api-key: {{apiKey}}`, `Accept: application/json`) and collection-level overview documentation (`docs { ... }`) covering the two token kinds (`AccountToken` vs. `CapabilityToken`, per ADR-0007), the 11-phase Game Session lifecycle, and how to run the collection top-to-bottom.
  - Two environments under `docs/api/bruno/environments/`:
    - `Local Dev.bru`: `baseUrl: http://localhost:8888`, `apiKey: dev-local-api-key`, `packId: diabe-teach`, `customPackId: endocrine-intro`, `roundNumber: 1`, `teacherEmail: rahman.s@aku.edu`, `teacherPassword: correct horse battery`, plus empty runtime variables (`accountToken`, `accountId`, `sessionId`, `roomCode`, `instructorToken`, `participantId`, `participantToken`, `chainId`).
    - `Netlify Production.bru`: `baseUrl: https://diabe-teach.netlify.app`, matching default non-secret variables, and `vars:secret [ apiKey, accountToken, instructorToken, participantToken ]`.
- **Six numbered domain folders (`docs/api/bruno/<NN>-<Folder>/`):**
  - Each folder includes a `folder.bru` with `meta` and `docs` explaining that subsystem:
    1. `01-Health/`:
       - `01-health-check.bru` (`GET {{baseUrl}}/api/health`)
    2. `02-Instructor-Accounts/`:
       - `01-sign-up-instructor.bru` (`POST {{baseUrl}}/api/v1/accounts/sign-up` — captures `accountToken`, `accountId`)
       - `02-sign-in-instructor.bru` (`POST {{baseUrl}}/api/v1/accounts/sign-in` — captures `accountToken`, `accountId`)
       - `03-get-current-account.bru` (`GET {{baseUrl}}/api/v1/accounts/me` — uses `{{accountToken}}`)
    3. `03-Curriculum-Packs/`:
       - `01-list-packs.bru` (`GET {{baseUrl}}/api/v1/packs`)
       - `02-get-pack-by-id.bru` (`GET {{baseUrl}}/api/v1/packs/{{packId}}`)
       - `03-validate-pack.bru` (`POST {{baseUrl}}/api/v1/packs/validate` — uses `{{accountToken}}` and a complete valid 3×3 Curriculum Pack payload)
       - `04-register-pack.bru` (`POST {{baseUrl}}/api/v1/packs` — uses `{{accountToken}}` and registers `{{customPackId}}` `1.0.0`)
       - `05-archive-pack.bru` (`POST {{baseUrl}}/api/v1/packs/{{customPackId}}/archive` — uses `{{accountToken}}`)
       - `06-unarchive-pack.bru` (`POST {{baseUrl}}/api/v1/packs/{{customPackId}}/unarchive` — uses `{{accountToken}}`)
    4. `04-Game-Sessions/`:
       - `01-create-session.bru` (`POST {{baseUrl}}/api/v1/sessions` — uses `{{accountToken}}`, creates a classroom session with `timerConfig`, captures `sessionId`, `roomCode`, `instructorToken`)
       - `02-join-session.bru` (`POST {{baseUrl}}/api/v1/sessions/join` — joins with `{{roomCode}}`, captures `participantId`, `participantToken`)
       - `03-get-session-state.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}` — uses `{{instructorToken}}`)
       - `04-transition-phase.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/phase` — uses `{{instructorToken}}`, `{ "action": "advance" }`)
       - `05-extend-phase.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/phase/extend` — uses `{{instructorToken}}`, `{ "seconds": 60 }`)
    5. `05-Chains-and-Adjudication/`:
       - `01-submit-chain.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/chains` — uses `{{participantToken}}`, submits a valid 4-cell adjacent Concept Chain, captures `chainId`)
       - `02-list-round-chains.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/chains` — uses `{{instructorToken}}`)
       - `03-adjudicate-chain.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/chains/{{chainId}}/adjudicate` — uses `{{instructorToken}}` for `instructor-approve` with `qualityScore` and `feedback`, and documents the `peer-approve`/`peer-reject` payload in `docs`)
       - `04-get-round-standings.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}/rounds/{{roundNumber}}/standings` — uses `{{instructorToken}}`)
    6. `06-Assessments-Survey-and-Lifecycle/`:
       - `01-submit-assessment.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/assessments/{{assessmentStage}}` — defaults `assessmentStage` to `pretest` and documents `posttest` in `docs`, uses `{{participantToken}}` with all 10 `diabe-teach` MCQ answers)
       - `02-get-session-analytics.bru` (`GET {{baseUrl}}/api/v1/sessions/{{sessionId}}/analytics` — uses `{{participantToken}}` or `{{instructorToken}}`)
       - `03-submit-survey.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/survey` — uses `{{participantToken}}` with all 9 Likert items)
       - `04-leave-session.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/leave` — uses `{{participantToken}}`)
       - `05-end-session.bru` (`POST {{baseUrl}}/api/v1/sessions/{{sessionId}}/end` — uses `{{instructorToken}}`)
- **Packages & HTML Docs Generation (`npm run generate:api-docs`):**
  - Per ADR-0005 ("Use popular npm modules first"), install official Bruno packages in `devDependencies` (`@usebruno/cli` and/or `@usebruno/lang` / `@usebruno/api-docs-core` as supported on Node 24) rather than writing a bespoke `.bru` parser.
  - Add `"generate:api-docs"` to `package.json` to generate `docs/api/api-docs.html` from `docs/api/bruno/` (with all environments included so the interactive switcher works in the browser).

## Testing Decisions

- **What makes a good test:**
  - Verify external contract guarantees: every `.bru` file parses cleanly with Bruno's official language parser, every implemented route in `netlify/functions/` and `docs/api/openapi.yaml` is represented in the Bruno collection with matching method and path, every request body satisfies our compiled Ajv OpenAPI request schemas, every file has rich documentation, and the generated HTML documentation file is non-empty and up to date.
- **Seams and modules under test:**
  - **Contract & drift test (`tests/bruno-collection-drift.test.ts`):**
    - Parses every `.bru` file under `docs/api/bruno/` (using `@usebruno/lang` or Bruno's parser).
    - Asserts a 1-to-1 match between the 21 implemented routes (`GET /api/health` + 20 `/api/v1/*` routes in `netlify/functions/*.ts` and `docs/api/openapi.yaml`) and the `.bru` request files.
    - Validates every JSON `body:json` block in the `.bru` files against the compiled Ajv validator for that route's `operationId` (`src/adapters/inbound/http/request-schemas.generated.ts`) after substituting template placeholders like `{{roomCode}}`.
    - Asserts every `.bru` request file and `folder.bru`/`collection.bru` contains a non-empty `docs` section.
    - Asserts `docs/api/api-docs.html` exists and contains every route title and environment name.
  - **Secret guard test (`tests/no-committed-secrets.test.ts`):**
    - Continues to scan all tracked files (including `docs/api/bruno/**` and `docs/api/api-docs.html`) to guarantee zero leaked keys or credentials.
- **Prior art:**
  - `tests/claudpoc-api-catalog-drift.test.ts` (route drift checks against `openapi.yaml`);
  - `tests/adapters/netlify-toml-redirects.test.ts` (scanning `netlify/functions/*.ts` route declarations);
  - `tests/adapters/generated-request-schemas.test.ts` (Ajv 2020-12 schema validation against `openapi.yaml`);
  - `tests/no-committed-secrets.test.ts`.

## Out of Scope

- Replacing `docs/api/openapi.yaml` (OpenAPI remains the canonical schema contract and source for `npm run generate:request-schemas`).
- Replacing the Cucumber BDD test suite (`npm run test:bdd`) with `bru run` in CI (the Bruno collection is for manual testing and interactive API documentation, while Cucumber remains the automated BDD test runner).
- Documenting the unimplemented `GET /api/v1/sessions/{sessionId}/stream` SSE endpoint as an active request (it is marked `x-implemented: false` in `openapi.yaml`).

## Further Notes

- **Reference:** Bruno API Docs Overview — [`https://docs.usebruno.com/api-docs/overview`](https://docs.usebruno.com/api-docs/overview).
- **Related decisions:**
  - ADR-0005 (Adopt battle-tested npm packages first: `@usebruno/*`);
  - ADR-0007 (Two distinct bearer token kinds: `AccountToken` vs. `CapabilityToken`).
