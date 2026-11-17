# 03: API button, overlay dialog and Context tab

**What to build:** A floating "API" button and an accessible modal (`apiDoc*` namespace, so it doesn't clash with the existing `#overlay` / `renderOverlay()`). Tabs: Context / All operations / Gaps. The Context tab reads `S.timer.phase` and `S.round` plus an IntersectionObserver on `#setup`, then shows the contextual operations with full contracts, status badges, deviations, and the global notes banner. Hidden in `body.projector`. Overlay state stays out of `S`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Opens and closes via the button, the close button, a backdrop click, or Esc; focus moves into the dialog and returns to the button on close
- [ ] `role="dialog"`, `aria-modal="true"`
- [ ] Shows the UI phase and the API PhaseIdentifier (e.g. `build` ↔ `round-1:chain-mapping`)
- [ ] Refreshes when the phase changes while open (wrap `renderTimer`)
- [ ] All operations tab has a search filter; Gaps tab renders both lists, with "list submitted chains" flagged as top priority
- [ ] Copy buttons for path and JSON
