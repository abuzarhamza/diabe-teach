# 06: Game setup "Don't make me think" redesign

**What to build:** rework the Game setup layout so a teacher can start a normal lesson in one click and never has to work anything out. Use three numbered steps (1 Pick a topic, 2 How long?, 3 Start), with step 3 always on screen. Make each timer one dropdown, put board size and shortest chain under a closed "More options", show pack cards with the name only, keep the preview small, and replace the summary list with one plain sentence. What gets sent (`CreateSessionRequest`), remembered settings, the pack editor's behaviour and the API overlay tags stay the same. See `../spec.md` → Solution 2 (revised 2026-11-18), Implementation Decisions (Game setup layout, revised 2026-11-18), user stories 52–64.

**Blocked by:** 02, 03, 04, 05

**Status:** resolved

Resolved 2026-11-20: done in `fe90fcd` (`claudPoc/concept-chain/login.html`, `setup.html`), later wired to the real API in `93dbb3f`; see the Comments below.

- [x] "Start game" is visible without scrolling at 1366×850 and stays on screen while scrolling
- [x] Steps are numbered 1 Pick a topic, 2 How long?, 3 Start
- [x] Timers are single dropdowns including "No timer – I'll move them on"; a remembered off-list value is kept
- [x] Board size and shortest chain are under a closed "More options"; shortest chain is a 2–6 dropdown
- [x] Pack cards show the name (plus "Yours" on own packs); "+ New pack" is the last card; level and objective are marked optional
- [x] Preview is capped at about 360px; the chosen pack's word count and description show once; "See all N words" is closed by default
- [x] "Rounds: 2" box, pack count, keyword panel and summary list are gone; one summary sentence sits by Start
- [x] Every `data-api` key still resolves; the createGameSession sample is unchanged; claudpoc tests pass

## Comments

2026-11-18: Implemented in `claudPoc/concept-chain/setup.html`, plus a small fix in `api-overlay.js`.
- **Layout:** numbered steps 1 Pick a topic / 2 How long? / 3 Start. The Start box is `position: sticky` inside a full-height right column, so it stays on screen even with More options open.
- **Timers:** dropdowns of 3, 4, 5, 8, 10 or 15 min, or "No timer – I'll move them on" (value `paced` → `null`). A remembered off-list value is added to the list. 4 min was added because it is the default review time.
- **More options:** a closed `<details>` with Board (N × N) and "Chains need at least" (2–6, plus a remembered off-list value).
- **Pack cards:** name only, with a "Yours" tag on own packs and the word count and description in a hover title. "+ New pack" is the last card.
- **Preview:** capped at 440px, not 360px, because 4×4 tiles at 360px broke most words. The chosen pack's line reads "name · N words · group (or description)", with a closed "See all N words".
- **Removed:** the Rounds box, the pack count, the keyword panel and the summary `<dl>`. The summary is now one sentence.
- **Start errors** name what to fix.
- **Overlay fix:** the overlay now redraws on scroll and when a `<details>` opens or closes. Its boxes are placed at page coordinates, so the sticky Start box had left its A tag behind.
- **Unchanged:** `data-api` keys and the overlay context shape (`mappingMinutes`/`mappingPaced`, …), so the createGameSession sample is the same.
- **Tests:** 151 claudpoc tests pass; `node --check` passes on the inline script.
- **Checked in Chrome** at 1470×742 over http://localhost:8000: Start is at y≈553 without scrolling and stays visible when scrolled to the bottom; the page is 1,236px tall, down from 2,014px; "No timer" shows in the summary; "+ New pack" opens the editor with focus in the paste box; the overlay's Start game card shows 300/240 s and the seed; Start game opens the teacher screen with packId ipediabetes, timers 300/240, board 4, shortest chain 5; no console errors.
- **Not verified:** light mode, narrow screens, keyboard-only use.
- **Known:** `api-overlay.js` line 33 has a pre-existing blanket `eslint-disable` lint error.

2026-11-18 (follow-up): the user missed the small "More options" link entirely, though they liked the numbered steps 1–3. It is now a bordered **"Board & chain length"** box in step 2. When closed, it shows the current values ("4 × 4 board · chains of 5+ words") and an outlined "Change ▾" button that reads "Done ▴" when open. The marker is hidden, the box has a focus ring, and the Start error that pointed to "More options" now names the new box. Checked in Chrome: it opens and closes, the values follow the dropdowns, and the overlay is unaffected. Known: at a 798px-tall window, opening the box pushes Start just below the fold (bottom at 833px) until the teacher scrolls or presses Done.
