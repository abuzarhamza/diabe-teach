# 04: Inspect mode (click a control to see its contract)

**What to build:** An "Inspect" toggle. While it is on, a capture-phase document click listener resolves `closest("[id],[data-api-action],.tile")`, blocks the original handler, and opens the matching action's contract (multi-call sequences shown in order). Add `data-api-action` to dynamic buttons without ids where they are rendered (per-chain Valid/Invalid in `renderChains`, `#nrYes`/`#nrNo`, saved-session Start/Edit/Delete). Announce the mode via `aria-live`. Remove the listener when inspect mode is turned off.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Clicking `#submit` in inspect mode shows `submitConceptChain` and does not submit
- [ ] Unmapped controls show a "no API mapping" message instead of failing silently
- [ ] Esc leaves inspect mode
