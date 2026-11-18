# 05: Live example request payloads

**What to build:** Example builders per action that turn live `S` into an illustrative API body. For example, the `submitConceptChain` body is `S.chain` indices → `GridCoord {row, col}` using `S.size`, and `S.links` → `narrativeExplanation` / `stepRationales`. The adjudicate body is instructor-approve with a `feedback` placeholder; join is `{roomCode, displayName: team name}`. Label each example "illustrative: keywordIds unavailable in prototype".

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Builders are pure functions of `S` and never mutate it
- [ ] Examples come with a copy button
