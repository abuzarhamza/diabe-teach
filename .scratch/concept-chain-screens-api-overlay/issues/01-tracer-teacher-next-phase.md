# 01: Tracer bullet: API overlay on the teacher's "Next phase" button (step D)

**What to build:** On the teacher screen, an "API overlay" toggle in the header turns the overlay on and off. When it's on, the "Next phase" button gets a dashed outline and a "D 👩‍🏫" tag, and hovering or focusing it shows a card with the `transitionSessionPhase` contract: METHOD + path, auth, a fixed sample request and response, error codes, status badge and known deviations. Clicking the button still advances the phase. This slice creates the shared catalog module (pure data) and the shared overlay module, and the `openapi.yaml` comparison test covering the one catalog entry. See `../spec.md` → Solution, Implementation Decisions, Testing Decisions.

**Blocked by:** None (can start immediately)

**Status:** resolved

Resolved 2026-11-20: done in PR #4 (merge `2976821`: `d4ac9da`, `2433b0f`, `df1b44f`, `b6dda6e`, `72345f9`); see the Comments below.

- [x] Toggle button in the teacher header with `aria-pressed`; off by default
- [x] "Next phase" is marked with a declarative attribute; the overlay finds it by that attribute only
- [x] Dashed outline + "D" tag with teacher badge, drawn in a separate layer that doesn't shift the page layout
- [x] Hover and keyboard focus show the card; moving away hides it
- [x] Card: operationId, `POST /api/v1/sessions/{sessionId}/phase`, Bearer instructor token, sample `{ "action": "advance" }`, sample `200 { state }`, 401/403/404/409, status badge, deviations (re-checked against current code)
- [x] Clicking "Next phase" with the overlay on still advances the phase; tags survive the re-render
- [x] Turning the overlay off removes the layer and its listeners; demo session data is never touched
- [x] Vitest drift test parses `docs/api/openapi.yaml` and checks the catalog entry's operationId, method, path and error statuses; it passes

## Comments

2026-11-17: Implemented. New `claudPoc/concept-chain/api-catalog.js` (pure data, global `CC_API_CATALOG`) and `api-overlay.js` (global `CCOverlay`; toggle injected into `header.top`), overlay CSS appended to `shared.css`, and `tests/claudpoc-api-catalog-drift.test.ts` (5 passing; verified it fails when path or an error status drifts). Teacher "Next phase" marked `data-api="D" data-api-io="write"`. Later tickets: add `steps`/`operations`/`gaps`/`targets` entries and `data-api` (`<letter>`, `<letter>.<detail>`, `gap.<key>`) + `data-api-io` (`write`|`read`) attributes; `operations[].sample(session, ctx)` is already called if present. Checked in Chrome (served over http://127.0.0.1, dark mode): toggle, outline, tag, hover/focus card, Next phase advances with tag intact, off removes layer, demo data unchanged. Deviations re-checked against code: new findings vs RESEARCH.md: advancing from `completed` returns 200 unchanged (no 409); Round Summary/Completed report `phaseEndsAt == phaseStartedAt` instead of null; timer config is now honoured after create (RESEARCH §3.3 stale); CONCURRENT_UPDATE_CONFLICT retry implemented. Tags are non-focusable spans for now (focusable buttons/pin are ticket 06); persistence is ticket 03.
