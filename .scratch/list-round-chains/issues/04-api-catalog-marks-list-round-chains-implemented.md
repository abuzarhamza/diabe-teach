# 04: The prototype API catalog marks list-round-chains as implemented

**What to build:** The Concept Chain prototype's API overlay stops showing "list a round's chains" as a gap:

- `listRoundChains` becomes **implemented**, with its real auth (an instructor or participant Capability Token) and a sample response that includes the display names;
- its "missing" deviation is dropped, and its errors list 400/401/403/404;
- the screen notes for the teacher's review list, the learner's class chains and my chains, and the roster's per-learner counts now point at this route. They keep the remaining gaps: no learner roster endpoint, and no stream, so screens poll.

The screens themselves are **not** wired to the route in this ticket; they stay on the browser fake.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** 02 (Listed chains show learner and voter display names), 03 (Learners see classmates' chains from peer-adjudication on)

**Status:** resolved

- [x] The prototype API catalog drift and sample tests pass with `listRoundChains` implemented
- [x] The overlay on the teacher and learner screens no longer lists list-round-chains as missing; the roster and stream gaps are still shown
- [x] The catalog's visibility note matches ticket 03's rule
- [x] Typecheck, vitest, lint and boundaries are no worse

## Resolution (2026-11-19)

`claudPoc/concept-chain/api-catalog.js`: `listRoundChains` is now `implemented`, with instructor and participant auth, errors 400/401/403/404, notes on display names, ordering, empty rounds and ticket 03's visibility rule, and no deviations. Its sample adds `participantDisplayName` / `voterDisplayName`, sorts by `submittedAt` then `chainId`, and shows only the learner's own chains up to that round's chain-mapping. The `C.review`, `C.classChains`, `C.myChains` and `C.roster` notes point at the route, keeping the no-roster-endpoint and no-stream (poll) gaps. The screens still use the browser fake. A new sample test covers names and visibility. Checks: typecheck passes, vitest 599 passing (596 + 3), lint 92, boundaries 6. The overlay was not opened in a browser.
