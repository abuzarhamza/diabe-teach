# 05: Flow legend panel

**What to build:** When the overlay is on, a legend panel lists steps A → H in order with title, actor badge, the screens each happens on, and status. Steps with no element on the current screen are shown dimmed with "on teacher screen" / "on learner screen". Clicking a step briefly flashes every element with that letter on the current page. Operations with no screen yet (assessments, survey, analytics) are listed at the bottom as "no screen yet".

**Blocked by:** 01

**Status:** resolved

Resolved 2026-11-20: done in PR #4 (merge `2976821`: `d4ac9da`, `2433b0f`, `df1b44f`, `b6dda6e`, `72345f9`); see the Comments below.

- [x] Legend appears only while the overlay is on and doesn't cover the board on desktop
- [x] Order, titles, actors and screens come from the catalog `steps`, not hard-coded per page
- [x] Clicking a step flashes matching elements (respecting reduced motion)
- [x] Legend can be collapsed

## Comments

2026-11-17: Implemented. `api-overlay.js` builds a legend (`aside.cc-api-legend`, inside the overlay layer, fixed bottom right, 300px so it stays in the 400px side column on desktop) from `CC_API_CATALOG.steps`: letter, title, actor badge, one status badge per op, and "on this screen" or the step's `screens` ("on teacher screen / learner screen"). Presence is recomputed on every draw (a step is dimmed when no visible `data-api` element resolves to its letter, so it updates as pages re-render). Clicking a step flashes its overlay boxes for 1.6 s (pulse only under `prefers-reduced-motion: no-preference`, steady highlight otherwise), scrolls the first match into view if off-screen, and announces the count in a polite live region. Collapsible (`aria-expanded`); state kept in sessionStorage `cc-api-legend`, default collapsed at <= 920px. Catalog: new `noScreen` list plus ops `submitAssessmentAttempt`, `submitPerceptionSurvey` (implemented; handlers exist, only error codes and the undeclared 400 INVALID_STAGE checked) and `getSessionAnalytics` (specced-only, no handler). Drift test extended (noScreen ops in catalog and spec; step screens valid): 61 passing; eslint/tsc clean. Chrome over http://127.0.0.1 (dark, 1470px): legend on teacher, learner game and lobby; no overlap with the board; G flashed 4 elements, C 4 on lobby; Next phase still advances with the legend open; G dims after advancing (no chains); off removes it, collapse persists. Not verified: reduced-motion rendering (CSS only), light mode, keyboard-only use. On the lobby at ~740px viewport height the open legend overlaps the room code; collapse fixes it. The legend can cover the lower right of the side column (review list, builder) on short viewports.
