# 05: Flow legend panel

**What to build:** When the overlay is on, a legend panel lists steps A → H in order with title, actor badge, the screens each happens on, and status. Steps with no element on the current screen are shown dimmed with "on teacher screen" / "on learner screen". Clicking a step briefly flashes every element with that letter on the current page. Operations with no screen yet (assessments, survey, analytics) are listed at the bottom as "no screen yet".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Legend appears only while the overlay is on and doesn't cover the board on desktop
- [ ] Order, titles, actors and screens come from the catalog `steps`, not hard-coded per page
- [ ] Clicking a step flashes matching elements (respecting reduced motion)
- [ ] Legend can be collapsed
