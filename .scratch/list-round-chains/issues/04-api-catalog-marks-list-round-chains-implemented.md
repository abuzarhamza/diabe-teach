# 04: The prototype API catalog marks list-round-chains as implemented

**What to build:** The Concept Chain prototype's API overlay stops showing "list a round's chains" as a gap:

- `listRoundChains` becomes **implemented**, with its real auth (an instructor or participant Capability Token) and a sample response that includes the display names;
- its "missing" deviation is dropped, and its errors list 400/401/403/404;
- the screen notes for the teacher's review list, the learner's class chains and my chains, and the roster's per-learner counts now point at this route. They keep the remaining gaps: no learner roster endpoint, and no stream, so screens poll.

The screens themselves are **not** wired to the route in this ticket; they stay on the browser fake.

See spec: `.scratch/list-round-chains/spec.md`.

**Blocked by:** 02 (Listed chains show learner and voter display names), 03 (Learners see classmates' chains from peer-adjudication on)

**Status:** ready-for-agent

- [ ] The prototype API catalog drift and sample tests pass with `listRoundChains` implemented
- [ ] The overlay on the teacher and learner screens no longer lists list-round-chains as missing; the roster and stream gaps are still shown
- [ ] The catalog's visibility note matches ticket 03's rule
- [ ] Typecheck, vitest, lint and boundaries are no worse
