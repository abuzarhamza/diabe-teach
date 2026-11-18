# 06: jsdom behaviour tests for the overlay

**What to build:** Add `jsdom` as a devDependency. Add a vitest file with `// @vitest-environment jsdom` that loads the HTML with scripts enabled, stubs `window.claude` and `IntersectionObserver`, and covers the scenarios in `../spec.md` → Testing Decisions → Seam 1.

**Blocked by:** 03, 04, 05

**Status:** ready-for-agent

- [ ] Initial context shows chain-mapping operations; after End building it shows peer-adjudication operations
- [ ] Inspecting `#submit` shows the contract and `#chains` is unchanged
- [ ] Inspecting a per-chain Valid button shows `adjudicateConceptChain` instructor-approve
- [ ] Gaps tab lists "list submitted chains" as missing
- [ ] Game state `S` is identical before and after open/close
