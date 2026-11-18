# 01: Prefactor: the shared demo session takes game settings

**What to build:** The shared in-browser mock of the Game Session API can create a session from settings shaped like `CreateSessionRequest`: `packId`, `timerConfig` (seconds; `null` = teacher-paced; 1–86400 allowed), `seed`, `creatorDisplayName`, plus prototype-only board size and shortest chain. It offers a catalog of built-in Curriculum Packs (the topics from the earlier single-page prototype). Phase deadlines come from the session's `timerConfig` instead of the fixed 5/4-minute timers. Boards are dealt from the chosen pack with a seed, and the same seed, pack and size always give the same board. Called with no settings, it behaves exactly as today, so the teacher, lobby and learner screens and the API overlay keep working unchanged. See `../spec.md` → Implementation Decisions (Packs, Session creation, Board preview and seed, Time allotment fields).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Creating a session with a `timerConfig` gives matching `phaseEndsAt` on entering chain-mapping and peer-review, and `null` for teacher-paced phases
- [x] Out-of-range timer values are rejected with a clear error
- [x] Same seed + pack + board size deals the same board; Round 1 uses the creation seed, Round 2 gets a fresh one
- [x] Chains shorter than the session's shortest chain are rejected with `CHAIN_TOPOLOGY_INVALID`
- [x] Built-in pack catalog available to pages; the default session still uses the Diabetes mellitus pack and today's timers
- [x] Existing overlay tests still pass; new vitest checks cover the above if the mock can be loaded without a DOM (otherwise say so in Comments)
- [x] No visible change on the existing screens

## Comments

2026-11-17: Implemented in `claudPoc/concept-chain/shared.js` only (no page changes). New mock API on `CC` for ticket 02:
- `CC.createSession(settings)` replaces the stored session (like `reset()`) and returns the state. `settings` mirrors `CreateSessionRequest`: `{ packId, mode, adjudicationMode, timerConfig, seed, creatorDisplayName }` plus prototype-only `boardSize` and `minChainLength`. Everything is optional; omitted timer fields use the demo defaults (`CC.DEFAULT_TIMER_CONFIG`: 300 s mapping, 240 s peer review, others `null`), not the API's 20/10 min. Bad input throws `{ code: "INVALID_REQUEST_BODY" | "PACK_NOT_FOUND", message }` with a teacher-readable message (timers must be whole seconds 1-86400 or `null`; unknown timer fields rejected; board size 3..floor(sqrt(keywords)), max 10; shortest chain 2..size²; seed non-empty string).
- `CC.normalizeSettings(settings)` does the same check without saving (use it to validate the form); `CC.settingsOf(state)` reads a session's settings (stored as `state.settings`, beside `session`, so overlay samples are unchanged; sessions stored before this get the defaults).
- `CC.listPacks()`, `CC.getPack(id)`: 15 built-in packs from the earlier prototype's `SETS` (`{ packId, name, group, description, keywords, boardSize, builtIn }`; Diabetes mellitus is `packId: "diabe-teach"`, `CC.DEFAULT_PACK_ID`; others use the old SETS keys). All have 49 keywords, so max board 7×7. Teacher-created packs (ticket 03) still need adding to `listPacks`/`getPack`.
- `CC.dealBoard({ packId, boardSize, seed })` for the board preview; `CC.newSeed()` for Shuffle. Round 1 is dealt with the creation `seed`; Round 2 (or a session with no seed) gets `${sessionId}-r<n>-<time>` as before. `TIMER_FIELDS`, `TIMER_MIN_SEC`, `TIMER_MAX_SEC`, `MIN_BOARD_SIZE` also exported.
- All six `timerConfig` fields are honoured (pretest, trial, mapping, peer review, post-test, survey), including on the initial `pretest`. `submitChain` enforces `minChainLength` with `CHAIN_TOPOLOGY_INVALID` ("A chain needs at least N keywords."; the default 2 keeps today's wording). `topologyError(path, minLength = 2)`.
- `CC.reset()` still makes a default session (ticket 02 should route "Start a new session" to Game setup instead).

Default behaviour unchanged: checked that `dealBoard` gives byte-identical boards to the old `shuffleBoard` for the same seed. New `tests/claudpoc-shared-mock.test.ts` loads shared.js in `node:vm` with a localStorage stub (no DOM needed): 17 tests (timers incl. `null`, range/unknown-field errors, timer fields equal the spec's `SessionTimerConfig`, seed determinism, Round 1 = creation seed and Round 2 fresh, shortest chain, pack catalog, legacy state). With the drift and sample tests: 94 passing; eslint and tsc clean; `node --check` on all scripts. Chrome over http://127.0.0.1: default teacher run to R1 chain mapping (49 tiles, 05:00, 300 s), learner joined in a second tab and submitted a 2-keyword chain, peer review 240 s, overlay on with tags/legend as before, no console errors.

For later tickets: the catalog's `nextState` (D sample) and `createGameSession` sample still use fixed `TIMER_SEC` 300/240; make them read `CC.settingsOf(state).timerConfig` / the form (ticket 05). The learner builder still says "Pick at least two touching keywords" and enables Submit at 2 keywords regardless of `minChainLength` (the mock rejects the submit). Not verified: a non-default session in the browser (covered by vitest only), file:// pages, light mode.
