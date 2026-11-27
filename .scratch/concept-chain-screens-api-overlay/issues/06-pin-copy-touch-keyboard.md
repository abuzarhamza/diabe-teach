# 06: Pin, copy, touch and keyboard polish

**What to build:** Clicking or tapping a tag pins its card open (the only way to open a card on touch screens). A pinned card has copy buttons for the path, sample request and sample response, closes with Esc or a close button, and returns focus to its tag. Cards stay inside the viewport. Outline, tag and badge colors meet contrast in light and dark mode, and reads vs. writes are distinguishable without color (solid vs. dashed).

**Blocked by:** 01

**Status:** resolved

Resolved 2026-11-20: done in PR #4 (merge `2976821`: `d4ac9da`, `2433b0f`, `df1b44f`, `b6dda6e`, `72345f9`); see the Comments below.

- [x] Tags are focusable buttons labelled with step and operation
- [x] Pinned card is a non-modal dialog; Esc closes it and focus returns to the tag
- [x] Copy buttons put the exact JSON or path on the clipboard and confirm with a short message
- [x] Cards reposition to stay on screen near edges and on small screens
- [x] Checked by hand in light and dark mode on a desktop and a narrow (phone-width) window

## Comments

2026-11-17: Implemented in `api-overlay.js` and `shared.css` only. Tags are now `<button>`s in the overlay layer, labelled e.g. "Step C: Watch session (getGameSessionState, streamGameSessionEvents), Teacher and learner. Show API card" with `aria-haspopup="dialog"`/`aria-expanded`, and kept per key (`<data-api>#<n>`) across re-renders so focus survives redraws. Because they live in the layer, they come after the page in Tab order. Hover or focus on an element or its tag shows a tooltip card that now takes no pointer events, so it can't swallow clicks. Click, tap, Enter or Space on a tag pins the card: `role="dialog"` `aria-modal="false"`, focus moves into it, with a × button and copy buttons for path, sample request and response body (`navigator.clipboard`, with an `execCommand` fallback for file://). The button says "Copied", and a `role=status` line announces it. Esc or × closes the card and puts focus back on the tag without reopening its tooltip. The pinned card re-renders when its HTML changes (live samples) and keeps focus on the same button. Placement: large elements (wider than 50% of the viewport or taller than 60%, e.g. the board) put the card over their own top-left corner under the tag, not beside them over other panels. The card is clamped and scrollable within the viewport. Fixes reported earlier: the legend is capped at `min(55vh,560px)` and starts collapsed below 801px height (lobby at 742px: the legend's top is at 322px, the room code ends at 178px). Legend flash now also outlines the page elements (`data-api-flash`, removed after 1.6s). Dimmed legend steps use the muted text color instead of opacity .55, which was 2.3:1. Contrast (computed): tags 6.6-8.8:1, outlines on the background 5.9-8.8:1, status badges 5.0-6.9:1 in light and dark. Drift test: 61 passing; eslint/tsc clean. Chrome over http://127.0.0.1, with light/dark forced by rewriting the `prefers-color-scheme` media rules at runtime: on the teacher screen at 1470px, Tab to a tag, Enter pins it, Tab to Copy response, Enter, Esc closes and focus is back on the tag. The pasted clipboard matched the shown JSON body exactly, and a Copy path call was recorded. Board pin in dark mode stays inside the board. × closes. In a 390px iframe (window min width is 500), lobby (dark) and teacher board cards stay inside 8..382px. The C flash outlined 6 elements and then cleared. No console errors. Not verified: a real touch device (tap tested by mouse click only), screen-reader announcements, reduced-motion rendering, learner game screen at 390px, file:// clipboard fallback. For ticket 04: `opHtml` still calls `op.sample(CC.get(), {})`. Copy buttons copy whatever request or response `sample` returns, so the copied text follows live samples automatically. A pinned card refreshes on every redraw, so a `sample` must be cheap and deterministic, or the card will rebuild each frame.

