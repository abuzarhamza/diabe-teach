# Spec: Developer API Overlay for the ConceptChain prototype

Status: ready-for-agent

Research: `RESEARCH.md` (same folder). It has the full UI → API mapping with file and line citations.

## Problem Statement

The ConceptChain prototype (`claudPoc/ConceptChain (Copy).html`) is a single-page, client-only game. It deals the board, checks adjacency, tracks Concept Chains, rules on chains, and keeps the leaderboard, all in browser memory and `localStorage`. The backend already exposes (or specs) a server-authoritative API for Curriculum Packs, Game Sessions, Concept Chain submission, adjudication and standings. Developers wiring the prototype to the backend have no in-page way to see:

- which API operation each panel or button corresponds to;
- the request and response contract (method, path, path params, auth, body, success and error shapes);
- whether that operation is actually implemented, partly implemented, or missing;
- where the running code differs from `docs/api/openapi.yaml`, or where the UI shape differs from the API DTO shape.

Today that knowledge is spread across `openapi.yaml`, Netlify function handlers, ADRs and research notes. People get it wrong when integrating, for example sending flat cell indices where the API wants `GridCoord`, or not knowing that the API has no endpoint for listing submitted chains.

## Solution

Add a floating **"API" button** to the prototype that opens a developer overlay. The overlay is context-aware:

- With nothing selected, it shows the operations relevant to the **current context**: the timer phase (`build` / `explain` / `done`, mapped to `round-N:chain-mapping` / `round-N:peer-adjudication` / `round-N:round-summary`) plus the region in view (game area vs. Session builder `#setup`).
- In **inspect mode**, clicking any UI control (topic select, Create session, Submit chain, Valid/Invalid, Add team, End building, New round, AI Check chains, etc.) shows the contract for that action instead of running it.
- Each entry shows the operationId, METHOD + path, required headers (`x-api-key`, Bearer Capability Token: instructor or participant), path params, request body schema, success response, error codes, and a **status badge**: `implemented` / `partial` / `specced-only` / `missing`.
- Each entry also lists **known deviations** (code vs. spec) and **shape mismatches** (UI state vs. API DTO), plus an example request/response JSON built from the current UI state where it makes sense.
- A **Gaps** tab lists UI actions with no API (e.g. listing submitted chains, more than 2 rounds, timer pause, renaming a team) and API operations with no UI (pretest, posttest, survey, analytics, SSE stream, pack validate/register).

The contract shown is the **openapi.yaml contract plus implementation deviations** (decided with the user). The overlay is a developer aid only. It makes no network calls and does not change game behaviour.

## User Stories

1. As a frontend developer, I want an "API" button always visible on the prototype, so that I can open the API overlay from any state.
2. As a frontend developer, I want the overlay to open without disturbing game state, so that I can inspect mid-round without losing progress.
3. As a frontend developer, I want the overlay to close with Esc, a close button, or a click on the backdrop, so that it is quick to dismiss.
4. As a frontend developer, I want the overlay to show which operations apply to the current timer phase, so that I know what the backend expects at this point in a Gameplay Round.
5. As a frontend developer, I want the phase shown in both UI terms (`build`) and API `PhaseIdentifier` terms (`round-1:chain-mapping`), so that I can translate between them.
6. As a frontend developer, I want an inspect mode in which clicking a control shows its API contract instead of running it, so that I can explore the mapping action by action.
7. As a frontend developer, I want inspect mode to block the original click handler, so that inspecting "Submit chain" doesn't actually submit.
8. As a frontend developer, I want inspect mode to work for dynamically created controls (per-chain Valid/Invalid buttons, `#nrYes`/`#nrNo`, saved-session buttons), so that no action is missing from the mapping.
9. As a frontend developer, I want every entry to show the operationId and METHOD + path, so that I can find it in `openapi.yaml`.
10. As a frontend developer, I want path params listed with their types and allowed values (e.g. `roundNumber` ∈ {1,2}), so that I build URLs correctly.
11. As a frontend developer, I want the required auth listed (`x-api-key`, and an instructor or participant Bearer Capability Token), so that I attach the right headers.
12. As a frontend developer, I want the request body schema with `$ref`s resolved into concrete fields, so that I don't need to read through the YAML.
13. As a frontend developer, I want the success response schema and status code, so that I know what to parse.
14. As a frontend developer, I want the possible error status codes and `ApiErrorCode` values, so that I can handle failures (e.g. 409 `PHASE_CLOSED_FOR_SUBMISSIONS`, 422 `CHAIN_TOPOLOGY_INVALID`).
15. As a frontend developer, I want a status badge (implemented / partial / specced-only / missing) on each operation, so that I don't integrate against something that doesn't exist yet.
16. As a frontend developer, I want known code-vs-spec deviations listed per operation (e.g. GET session state requires Bearer in code, pack register returns `{packId, version, warnings}`), so that I'm not surprised at runtime.
17. As a frontend developer, I want a global note that all routes need `x-api-key` when `API_KEY` is set and that there is no CORS (serve via `netlify dev`), so that my first call works.
18. As a frontend developer, I want UI-to-DTO shape mismatches shown per action (flat cell index → `GridCoord {row, col}`; `links[]` → `narrativeExplanation` / `stepRationales`; team index → `participantId`; `pending/valid/invalid` → `pending-review/approved/rejected`), so that I write correct mappers.
19. As a frontend developer, I want an example request built from the live UI state (e.g. the current chain as a `submitConceptChain` body), so that I can copy a realistic payload.
20. As a frontend developer, I want a copy-to-clipboard button on example JSON and on the path, so that I can paste into curl or code.
21. As a frontend developer, I want the "Start session" action shown as an ordered sequence (createGameSession → joinGameSession per team → transitionSessionPhase), so that I understand that multi-call flows have an order.
22. As a frontend developer, I want "Board render" to show that it needs `getGameSessionState.activeBoard` and that the field is currently never returned, so that I know the board must stay client-dealt for now.
23. As a frontend developer, I want "End building" and timer expiry mapped to `transitionSessionPhase {action:"advance"}` with a note that the server never auto-advances, so that I keep the client timer driving transitions.
24. As a frontend developer, I want Valid/Invalid mapped to `adjudicateConceptChain` instructor-approve/reject, with notes that `feedback` is required and the verdict locks, so that I collect feedback and disable re-ruling.
25. As a frontend developer, I want AI "Check chains" mapped to `adjudicateConceptChain {action:"ai-evaluate"}` with a note that the current implementation is a placeholder (always approves, score 75, no per-link data), so that I don't rely on its output.
26. As a frontend developer, I want the leaderboard mapped to `getRoundStandings`, with notes on the missing pending count and missing `cumulativeRationaleScore`, so that I know what to compute client-side.
27. As a frontend developer, I want the topic select mapped to `listCurriculumPacks` + `getCurriculumPackById`, so that I can replace the hardcoded `SETS`.
28. As a frontend developer, I want "Add team" mapped to `joinGameSession`, with a note that each team needs its own participant token, so that I store tokens per team.
29. As a frontend developer, I want "New round" mapped to `transitionSessionPhase` with a note that only 2 rounds exist and there's no reshuffle, so that I limit the UI.
30. As a frontend developer, I want a Gaps tab listing UI actions with no API, so that I know what needs backend work or stays client-only.
31. As a backend developer, I want the Gaps tab to list API operations with no UI (assessments, survey, analytics, SSE, pack validate/register, archive/unarchive), so that I can see which endpoints have no consumer yet.
32. As a backend developer, I want "list submitted chains" flagged as the most important missing API, so that it is prioritised (it blocks multi-device facilitation).
33. As a product owner, I want the overlay to use GLOSSARY terms (Curriculum Pack, Keyword Card, Concept Chain, Instructor Final Ruling, Capability Token), so that developers learn the domain language.
34. As a developer, I want the overlay catalog checked against `openapi.yaml` in an automated test, so that it can't silently drift when the spec changes.
35. As a developer, I want the overlay to have no effect when closed (no extra listeners running, nothing added to `S`), so that `claude.hot` snapshots and gameplay are unaffected.
36. As a developer, I want the overlay to work in projector mode too, or be explicitly hidden there, so that it never covers the projected board unintentionally.
37. As a developer, I want the overlay to be keyboard accessible (focus trap, `aria-modal`, labelled button), so that it meets the prototype's existing a11y level.
38. As a developer, I want a filter/search box across all operations, so that I can jump to any operation even when it isn't contextual.
39. As a developer, I want each entry to link (by name) to its OAS line range and handler file from the research, so that I can jump to the source of truth.

## Implementation Decisions

- **Scope of change:** Only the prototype HTML is changed (plus tests). No backend, OpenAPI or domain changes. The overlay stays self-contained in the single HTML file, consistent with the prototype being a standalone page.
- **Naming:** The page already has `renderOverlay()` and `#overlay` for the SVG chain lines. The new feature must use a different namespace (e.g. `apiDoc` / `#apiDoc*` ids) to avoid collisions.
- **Catalog as data:** All mapping knowledge goes in one declarative catalog object embedded in the page, kept separate from the rendering code. Two keyed collections:
  - `operations` keyed by operationId: `{method, path, pathParams, auth, requestSchema, successStatus, responseSchema, errors[], status: "implemented"|"partial"|"specced-only"|"missing", deviations[], sourceRefs}`. Includes placeholder entries for missing APIs (e.g. a proposed "list submitted chains") with status `missing` and no operationId claim against the spec.
  - `actions` keyed by UI action id (DOM id, or a `data-api-action` attribute added to dynamic buttons): `{label, operations: operationId[] (ordered for sequences), shapeMismatches[], exampleBuilder?}`.
  - `phases` mapping `S.timer.phase` → API `PhaseIdentifier` template + contextual operationIds; a `builder` context for `#setup`.
  - `gaps`: `{uiWithoutApi[], apiWithoutUi[]}`.
  Shape sketch:
  ```
  operations[opId] = { method, path, auth: ("apiKey"|"instructor"|"participant")[], pathParams, request, response: {status, schema}, errors: [{status, code}], status, deviations: string[] }
  actions[actionId] = { label, ops: opId[], mismatches: string[], example?: (S) => object }
  ```
- **Context detection (non-invasive):**
  - Phase: read the global `S` (`S.timer.phase`, `S.round`) when the overlay opens. Optionally wrap `renderTimer()` so an open overlay refreshes when the phase changes.
  - Region: an IntersectionObserver on `#setup` decides game vs. builder context.
  - Inspect mode: a capture-phase `click` listener on `document` that resolves `event.target.closest("[id], [data-api-action], .tile")`, calls `preventDefault` + `stopImmediatePropagation`, and opens the matching action. It is added only while inspect mode is on and removed afterwards.
  - Dynamic buttons with no ids (per-chain Valid/Invalid, saved-session Start/Edit/Delete) get a `data-api-action` attribute where they are rendered. This is the only edit to existing render functions.
- **State isolation:** Overlay state lives in its own closure, never in `S`, because `claude.hot` snapshots `S`.
- **Contract source of truth:** Contracts are written from `docs/api/openapi.yaml` with `$ref`s resolved by hand into the catalog. Implementation deviations come from `RESEARCH.md` §3. The catalog is static (no runtime YAML fetch), so the page keeps working when opened as a file.
- **Example payloads:** Built from live state, e.g. the current chain `S.chain` (flat indices) converted to `GridCoord[]` using `S.size`, and `S.links` joined into `narrativeExplanation`. Labelled "illustrative: keywordIds unavailable in prototype".
- **Global notes banner:** Base path `/api/v1`, `x-api-key` header when `API_KEY` is set, no CORS (serve via `netlify dev`), and that the runtime does not validate requests against OAS.
- **UI:** A floating bottom-right "API" button; a modal with tabs **Context**, **All operations** (searchable), and **Gaps**; an "Inspect" toggle; status badges colour-coded. Hidden in `body.projector` mode.
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, focus moves into the dialog and returns to the button on close, Esc closes, inspect mode is announced via `aria-live`.

## Testing Decisions

- **Good tests check external behaviour only:** what a user sees in the DOM after clicking, and whether the catalog agrees with the spec. They don't check internal function names or the catalog's internal layout beyond its documented keys.
- **Seam 1: DOM behaviour (highest seam).** Load `claudPoc/ConceptChain (Copy).html` into jsdom with scripts enabled, using vitest with a per-file `jsdom` environment (add `jsdom` as a devDependency, per the npm-first policy). Assertions:
  - The API button exists and opens a dialog.
  - Context tab in the initial `build` phase lists `submitConceptChain` and `transitionSessionPhase` and shows `round-1:chain-mapping`.
  - After "End building", the context changes to peer-adjudication operations.
  - In inspect mode, clicking `#submit` shows the `submitConceptChain` contract (POST path, Bearer participant, `GridCoord` mismatch note) and does **not** add a chain to `#chains`.
  - Clicking a per-chain Valid button in inspect mode shows `adjudicateConceptChain` instructor-approve.
  - The Gaps tab lists "list submitted chains" as missing.
  - Esc closes the overlay; game state is unchanged after open/close.
  The test must stub `window.claude` (absent outside the host) and anything else jsdom lacks (e.g. IntersectionObserver).
- **Seam 2: catalog ↔ OpenAPI drift.** Extract the catalog from the page (the catalog lives in a `<script type="application/json" id="apiDocCatalog">` block so the test can parse it without running page JS). Parse `docs/api/openapi.yaml` with the existing `yaml` dependency. Assert that:
  - every catalog operation not marked `missing` has an operationId that exists in OAS with the same method and path;
  - every OAS operation appears in the catalog (either mapped to an action or listed in `gaps.apiWithoutUi`);
  - each catalog operation's error codes are a subset of the OAS response codes.
- **Prior art:** `tests/app-runtime-yaml-integration.test.ts` (YAML parsing in tests), `tests/functions/*.test.ts` (vitest style). There is no existing jsdom/DOM test; this adds the first.
- **Not tested:** visual styling or clipboard behaviour (manual check in a browser).

## Out of Scope

- Actually wiring the prototype to call the API (fetch calls, tokens, session lifecycle). The overlay documents; it does not integrate.
- Fixing any backend gap or deviation it reveals (missing list-chains endpoint, `activeBoard`, SSE, auth differences, response shape drift). Those need their own specs.
- Changing `docs/api/openapi.yaml`.
- Building the missing pretest/posttest/survey UI screens.
- Generating the catalog automatically from OAS at runtime or at build time.
- Refreshing generated OpenWiki pages (regenerated through the normal process).

## Further Notes

- `AGENTS.md` describes an `OpenApiHttpApp` / single `api.ts` router that does not exist in the current code (ADR-0005 moved to one Netlify function per route). The overlay's global banner should reflect the real runtime. Consider fixing `AGENTS.md` separately.
- `.scratch/api-implementation-gaps/RESEARCH.md` is out of date on assessments; refresh it separately.
- When backend gaps close, update the catalog status. The drift test catches spec changes, but not implementation-status changes.
