# 02: Full teacher screen coverage (steps A, C, D, G, H + gaps)

**What to build:** Every API-bound element on the teacher screen is tagged and has a card: room code and "Reset session"/"Start a new session" (A `createGameSession`); phase steps, timer, board and roster (C `getGameSessionState` / `streamGameSessionEvents`, solid "read" outline); the review list (C, flagged red as needing the missing "list round chains" endpoint); per-chain Approve/Reject (G `adjudicateConceptChain` instructor ruling); standings (H `getRoundStandings`); "+1 min" tagged as a gap with no API. Catalog statuses and deviations are re-checked against the current backend code.

**Blocked by:** 01

**Status:** resolved

Resolved 2026-11-20: done in PR #4 (merge `2976821`: `d4ac9da`, `2433b0f`, `df1b44f`, `b6dda6e`, `72345f9`); see the Comments below.

- [x] Each element listed above has the right letter, actor badge, and read (solid) or write (dashed) outline
- [x] Dynamically rendered chain cards get tags and keep them after re-renders (new chains, rulings)
- [x] Review list card shows status `missing` in the bad color and names the proposed endpoint
- [x] Approve/Reject card notes `feedback` is required and the ruling locks the chain (409 `ADJUDICATION_LOCKED_BY_INSTRUCTOR`)
- [x] Board card notes `activeBoard` is specced but not returned by the backend; timer card explains `phaseEndsAt` null and the 5 s grace period
- [x] "Add sample learners & chains" is untagged (demo only)
- [x] Drift test covers every non-missing operation used on this screen and passes

## Comments

2026-11-17: Implemented. `teacher.html` tags: room code `A.roomCode` (read), Reset session / Start a new session `A` (write), Next phase `D` (switches to `A` at Completed, where it creates a new session), "N joined" `C.count`, phase steps `C.phase`, timer `C.timer`, board `C.board`, roster `C.roster`, review list `C.review` (all read), Approve/Reject `G.approve`/`G.reject` (write, in the chain-card template), locked ruling `G.verdict` (read), standings `H` (read), "+1 min" `gap.extend`. "Add sample learners & chains" untagged. Catalog: steps A, C, G, H; ops createGameSession, getGameSessionState, streamGameSessionEvents (specced-only), listRoundChains (missing, proposed GET `.../rounds/{roundNumber}/chains`), adjudicateConceptChain, getRoundStandings; gap `extend`; targets. Module API additions (ticket 03 should reuse): `operations[op].variants[name] = { request?, response?, errors?, notes? }` picked by `variant` on a step or target (G uses `instructor-approve`/`instructor-reject`; F can add `peer-approve`/`peer-challenge`); any element whose resolved ops include a `missing` op is drawn red with "· missing API". Drift test now also checks targets, variant errors and every `data-api` key in teacher.html (`describe.each(["teacher.html"])`, add lobby/participant there in 03); 31 passing, fails on an unknown key. Chrome check over http://127.0.0.1 (dark mode): all tags, read/write outlines, red review list and roster, cards for review, Reject, timer, board, +1 min, standings; tags kept after seeding chains, ruling and switching filters; full phase run to Completed and new session works; no console errors. New status findings vs RESEARCH.md: create rejects bad timerConfig with 400 but doesn't validate `mode`/`adjudicationMode`; all sessions start in `pretest`; error bodies now use the ApiErrorResponse shape; adjudication isn't phase-gated, ignores the path roundNumber, and an unknown action returns 200 unchanged; state has no participant list (roster has no source); standings omit learners with no approved chain and have consecutive ranks for ties. Not verified: light mode, keyboard focus on the dynamic G buttons, narrow viewports.
