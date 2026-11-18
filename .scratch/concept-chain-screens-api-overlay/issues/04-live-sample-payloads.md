# 04: Live sample payloads from the demo session

**What to build:** Cards show sample requests and responses filled from the live demo session instead of fixed examples: real sessionId, roomCode, phase, `phaseEndsAt`, participant ids, the learner's draft chain as a `GridCoord` path with `stepRationales`, the chain under the cursor for votes and rulings, and current standings. Values the mock can't know (tokens, server-assigned ids before a call) show as placeholders like `<participantToken>`. Samples are labelled "example from demo session". An open card refreshes when the session state changes.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [x] Every step A–H card uses live values where the mock has them, and fixed examples otherwise
- [x] Building a chain and then hovering "Submit chain" shows that exact path and rationales in the request
- [x] Hovering a chain's Approve/Reject or vote buttons shows that chain's id and round in the path
- [x] An open or pinned card updates when the phase changes in another tab
- [x] Sample builders are pure functions of the session state and can be checked in the existing vitest setup

## Comments

2026-11-17: Implemented. `api-catalog.js` now gives every A-H operation a pure `sample(state, ctx)` that returns `{ path?, request?, response? }`: live sessionId/roundNumber/chainId in the path, PublicSessionState from the mock (without `activeBoard`, matching the backend), the draft chain converted to a GridCoord `path` + `stepRationales` (same conversion as `submit()`), peer votes and rulings for the chain under the cursor (including the typed comment, feedback and score), the next phase for D, and standings in the PlayerRoundStanding shape. Server-assigned values stay as placeholders (`<chainId>`, `<submittedAt>`, `<votedAt>`, tokens). With no draft or chain it falls back to the fixed example body. Also new: `catalog.phases`. `api-overlay.js`: `CCOverlay.setContext(fn)` (pages register plain data: participant gets `{ participantId, draft, voteNotes }`, teacher `{ rulings }`, lobby `{ participantId }`); ctx also gets `variant` and `chainId` from the nearest `[data-api-chain]` (added to the chain `<article>`s on teacher and participant). The card shows the filled path with the template underneath, and the "example from demo session" label now goes on each part that is live. Cards refresh on `input`/`change` and `storage` events as well as on re-renders. Bug fix: the overlay checked `window.CC`, but `const CC` is not a window property, so `sample` was never called before this ticket. New `tests/claudpoc-api-catalog-samples.test.ts` (16 tests: draft → request, vote/ruling paths and bodies, the placeholder when no chain is under the cursor, standings, phase order equal to the spec's enum, determinism/no mutation for every sample). Full suite: 277 passing; eslint/tsc clean. Chrome over http://127.0.0.1: the Submit card showed exactly the built path, links and story; Challenge and Reject showed the hovered chain's id and round 1, with the comment and feedback/score; a pinned C.timer card switched to `round-1:peer-adjudication` after Next phase was clicked in the teacher tab; Reject still locked the chain; D/H/A/G.verdict and lobby C.count cards were live; no console errors. Not verified: light mode, narrow/touch viewports, round 2, file:// pages.
