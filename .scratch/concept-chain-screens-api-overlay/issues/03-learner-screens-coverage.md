# 03: Learner screens coverage (steps B, C, E, F, H) and persistence across pages

**What to build:** The join form, lobby and learner game screen get the toggle and tags: join form (B `joinGameSession`, card notes keeping `participantId` + `participantToken`); lobby classmates, timeline and phase pill (C, classmates pointing to the `participant.joined` stream event); learner board, timer, phase pill, classmates' chains and My chains (C); chain builder + "Submit chain" (E `submitConceptChain`); Approve/Challenge (F `adjudicateConceptChain` peer votes); round results (H). The overlay's on/off state is kept in tab-scoped storage so it survives join → lobby → game redirects.

**Blocked by:** 01

**Status:** resolved

Resolved 2026-11-20: done in PR #4 (merge `2976821`: `d4ac9da`, `2433b0f`, `df1b44f`, `b6dda6e`, `72345f9`); see the Comments below.

- [x] Each element listed above has the right letter, actor badge and read/write outline
- [x] Submit card lists 409 `PHASE_CLOSED_FOR_SUBMISSIONS` and 422 `CHAIN_TOPOLOGY_INVALID`
- [x] Peer vote card notes learners can't vote on their own chain (403) or a locked chain (409)
- [x] "Not you? Join again" is untagged
- [x] Turning the overlay on in the join form keeps it on in the lobby and the game screen after automatic redirects
- [x] Drift test covers every non-missing operation used on these screens and passes

## Comments

2026-11-17: Implemented. Tags: join form `B` (write); lobby phase pill `C.phase`, "N joined" `C.count`, classmates `C.classmates` (points to `participant.joined`), timeline `C.timeline` (all read); learner phase pill `C.phase`, timer `C.timer`, board `C.board`, classmates' chains `C.classChains` and My chains `C.myChains` (read, red: need missing `listRoundChains`), builder panel `E.builder` + Submit `E` (write), Approve/Challenge `F.approve`/`F.challenge` (write, variants `peer-approve`/`peer-challenge`, which override `auth` to participant and carry their own errors/notes/deviations), locked ruling `G.verdict` (read), round results `H` (read). "Not you? Join again", "Show on board", Undo/Clear untagged. Catalog: steps B, E, F; ops `joinGameSession`, `submitConceptChain`. Overlay: toggle goes into every `header.top` and every `[data-api-toggle]` (join view has one), kept in sync; on/off persisted in sessionStorage key `cc-api-overlay`. `placeCard` now never covers its element (below, above, right, left, else shorter scrollable card), since a focus card clamped over the join form swallowed the Join click. Fixed a pre-existing participant.html bug: `.panel`/`.col` `display:flex` overrode `hidden`, so the empty game header showed under the join form and the join form under the game (page-scoped `[hidden]{display:none !important}`). Drift test covers teacher/participant/lobby: 53 passing; eslint and tsc clean. Chrome over http://127.0.0.1 (dark mode): overlay on in join form stays on after join → lobby → game (teacher advanced in another tab); submit, vote, ruling, round summary all work with tags kept. New findings vs RESEARCH.md: join 404 code is `ROOM_CODE_NOT_FOUND` and join is accepted in any phase; submit now checks the path roundNumber against the active round (RESEARCH stale), needs >= 4 cells, accepts empty narrative, returns 403 for instructor/other-session tokens (undeclared); peer votes are not rejected on own chain, are appended (not replaced), aren't phase-gated, and never produce a peer-consensus verdict. Not verified: light mode, keyboard-only flow, narrow/touch viewports, hover on every card (Submit card errors checked via catalog/test, not visually).
