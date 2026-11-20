# 04: Board preview with Shuffle, fixed rounds and the Round 2 label

**What to build:** Game setup shows a **Board preview**: the board the class will get, dealt from the chosen pack at the chosen size, with a **Shuffle** button that re-deals with a new seed. The preview re-deals when the pack or board size changes, and "Start game" passes the preview's seed so Round 1 uses exactly that board. Time allotment shows **"Rounds: 2"** read-only with the note "Each round gets a freshly shuffled board". On the teacher screen, the phase button at the end of Round 1 reads **"Start Round 2 · new board →"**. There is no reshuffle during a round. See `../spec.md` → Solution 2–3, Implementation Decisions (Board preview and seed, Rounds, Round button wording), user stories 43–49.

**Blocked by:** 02

**Status:** resolved

Resolved 2026-11-20: done in `fe90fcd` (`claudPoc/concept-chain/login.html`, `setup.html`), later wired to the real API in `93dbb3f`; see the Comments below.

- [x] Preview renders with the shared board renderer and matches the chosen pack and size
- [x] Shuffle changes the layout; changing pack or size re-deals
- [x] The teacher screen's and learners' Round 1 board is identical to the last preview
- [x] "Rounds: 2" shown read-only with the fresh-shuffle note
- [x] Round 1 summary → button label "Start Round 2 · new board →"; Round 2 gets a different board

## Comments

2026-11-17: Implemented in `claudPoc/concept-chain/setup.html`, `teacher.html`, `shared.js` (no catalog/overlay changes; ticket 05 tags the preview/Shuffle). Game setup: "Board preview" panel under Choose a pack, drawn with `CC.renderBoard` (read-only) from `CC.dealBoard({ pack, boardSize, seed })`; page-level `seed = CC.newSeed()` on load, "Shuffle ↻" replaces it; changing pack or board size re-renders with the same seed; status note "N×N board from <pack> · shuffled k×. Round 1 starts with exactly this board; Round 2 gets a fresh shuffle." (only rewritten when it changes, so the live region doesn't re-announce on every keystroke). The seed is not remembered across reloads (a reload deals a new preview). `readForm` now sends `seed` in the settings, so "Start game" creates the session with it. Time allotment has a read-only "Rounds: 2" fieldset with "Each round gets a freshly shuffled board…"; Summary shows "Rounds 2 · a fresh board each". `shared.js`: `CC.nextPhaseLabel(phase)` ("Start Round 2 · new board →" from `round-1:round-summary`, otherwise "Start <next> →", `null` after Completed); teacher.html's phase button uses it. Fix from ticket 03: teacher header no longer says "pack pack" (adds " pack" only when the name doesn't already end in "pack"). Tests: 2 new in `tests/claudpoc-shared-mock.test.ts` (preview after Shuffle → Round 1 board `toEqual` the preview, still the same at R1 summary, Round 2 differs; button labels); 115 claudpoc tests pass, eslint/tsc clean, `node --check` on shared.js and the inline scripts. Chrome over http://127.0.0.1 (dark, 1470px): preview 49 tiles for Diabetes; Shuffle changed the layout; Thyroid re-dealt with the same seed; 5×5 re-dealt to 25 tiles; Shuffle again; Start game → teacher and a joined learner tab both had the exact last-preview board (same seed and tile order) at R1 chain mapping; R1 Summary button read "Start Round 2 · new board →"; Round 2 board differed on both; a saved pack "Endocrine review pack" showed once; no console errors. Not verified: light mode, narrow viewports, keyboard-only Shuffle, overlay toggle visually (drift test only), file:// pages.
