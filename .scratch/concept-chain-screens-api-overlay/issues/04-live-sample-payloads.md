# 04: Live sample payloads from the demo session

**What to build:** Cards show sample requests and responses filled from the live demo session instead of fixed examples: real sessionId, roomCode, phase, `phaseEndsAt`, participant ids, the learner's draft chain as a `GridCoord` path with `stepRationales`, the chain under the cursor for votes and rulings, and current standings. Values the mock can't know (tokens, server-assigned ids before a call) show as placeholders like `<participantToken>`. Samples are labelled "example from demo session". An open card refreshes when the session state changes.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Every step A–H card uses live values where the mock has them, and fixed examples otherwise
- [ ] Building a chain and then hovering "Submit chain" shows that exact path and rationales in the request
- [ ] Hovering a chain's Approve/Reject or vote buttons shows that chain's id and round in the path
- [ ] An open or pinned card updates when the phase changes in another tab
- [ ] Sample builders are pure functions of the session state and can be checked in the existing vitest setup
