# 15: The prototype and the tracker match the finished API

**What to build:**
- **Prototype:**
  - the fake screens store `stepRationales` as strings;
  - the obsolete "chain should be finalized" BDD step is deleted;
  - `claudPoc/ConceptChain (API overlay).html` shows the standard register error body;
  - the prototype catalog's board and `activeBoard` notes match the API.
- **Tracker:** every `.scratch/*/issues/*.md` whose work is verifiably done gets `Status: resolved`, with a one-line dated pointer to the commit or route. List the ones you can't verify in the Resolution for the user; don't guess.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 01–14 and server-owned-board 03 (it tidies after everything else)

**Status:** resolved

- [x] Prototype fake screens and catalog tests pass
- [x] No ticket for finished work still says ready-for-agent; unverifiable ones are listed
- [x] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse

## Resolution (2026-11-20)

- **Prototype:** the fake screens (`claudPoc/concept-chain/shared.js`, `participant.html`, `teacher.html`) store and show `stepRationales` as strings, and the catalog test's demo chain does too. The unused "the chain should be finalized with score {int}" step is deleted from `tests/integration/step-definitions/assertions.steps.ts`.
- **`claudPoc/ConceptChain (API overlay).html`:** register/validate auth is the Account Token, the register error body is the standard `ApiErrorResponse` (old `{ error: { code } }` drift removed), validate returns `{ valid, errors, warnings }` with `{ path, code, message }` items, `stepRationales` is `string[]`, and the "seed ignored" / "activeBoard never returned" / "no reshuffle" drift is gone.
- **`claudPoc/concept-chain/api-catalog.js`:** the sample state carries `packVersion` and an `activeBoard` (BoardGridView); `getGameSessionState` is `implemented` with no deviations; the board-size, board-preview and `C.board` notes say the server deals the board (since `5964cdb`); the live samples project the demo board as a BoardGridView (and `null` / a new board on transitions). The unlimited `eslint-disable` in `api-catalog.js` and `shared.js` now names the rules it disables.
- **`jump` without `targetPhase`:** now 400 `INVALID_REQUEST_BODY` (`details.field: "targetPhase"`) instead of a 200 with no change; the contract already listed 400 for this route, and `targetPhase`'s description now says it is required with `jump` (request schemas regenerated). Handler test in `tests/functions/transition-phase.test.ts`.
- **Node 24:** `wiki/18-deploying-diabe-teach-to-netlify.md` and `.github/workflows/openwiki-update.yml` (generated `openwiki/` not touched).
- **Tracker:** 42 tickets closed with a dated pointer: assessment-submission 01-07, perception-survey 01-07, concept-chain-screens-api-overlay 01-06, concept-chain-teacher-login-and-game-setup 01-06, local-integration-testing 01-07 (they had no Status line), p0-game-session-endpoints 03-08 resolved; middy-simplification 01-03 set to wontfix (superseded by discrete-domain-functions-middy, `3c5f131`). `done`/`completed` statuses left as they are.
- **Left open for the user:**
  - `teacher-login/09` (Account Token does not unlock pack answers yet): genuinely open.
  - `conceptchain-api-overlay/01-06`: can't verify. The specified embedded JSON catalog in `ConceptChain (Copy).html`, inspect mode, HTML drift test and jsdom tests don't exist; `ConceptChain (API overlay).html` and the later concept-chain-screens-api-overlay effort cover similar ground, so they are probably superseded. Your call.
- Checks: typecheck passes; lint 29; boundaries 6; vitest (`--no-file-parallelism`) 908 passed (+1 new test, no intermittent failures); BDD all 5 features pass, one per process, against `dev:local`.
