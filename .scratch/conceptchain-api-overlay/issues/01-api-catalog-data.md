# 01: Embed the API catalog as JSON in the prototype

**What to build:** Add a `<script type="application/json" id="apiDocCatalog">` block to `claudPoc/ConceptChain (Copy).html` with the declarative catalog described in `../spec.md` → Implementation Decisions → "Catalog as data": `operations` (all 15 OAS operations plus `missing` placeholders such as "list submitted chains"), `actions`, `phases`, `gaps`, and the `globalNotes`. Fill it from `../RESEARCH.md` §2 (contracts with $refs resolved), §3 (status and deviations), and the mapping and gaps sections.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Each operation has: method, path, auth, pathParams, request, response {status, schema}, errors [{status, code}], status badge, deviations[]
- [ ] Each UI action (topic, create session, submit, undo/clear, valid/invalid, add team, end building, timer expiry, new round, AI check, AI examples, leaderboard, board render, saved sessions) maps to ordered operationIds plus shapeMismatches
- [ ] `phases`: build/explain/done → `round-{N}:chain-mapping` / `peer-adjudication` / `round-summary`, plus a `builder` context
- [ ] `gaps.uiWithoutApi` / `gaps.apiWithoutUi` as listed in the research
- [ ] Uses GLOSSARY vocabulary
- [ ] No behaviour change to the page
