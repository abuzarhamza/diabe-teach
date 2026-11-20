# 15: The prototype and the tracker match the finished API

**What to build:**
- **Prototype:**
  - the fake screens store `stepRationales` as strings;
  - the obsolete "chain should be finalized" BDD step is deleted;
  - `claudPoc/ConceptChain (API overlay).html` shows the standard register error body;
  - the prototype catalog's board and `activeBoard` notes match the API.
- **Tracker:** every `.scratch/*/issues/*.md` whose work is verifiably done gets `Status: resolved`, with a one-line dated pointer to the commit or route. List the ones you can't verify in the Resolution for the user; don't guess.

See spec: `.scratch/api-completion/spec.md`.

**Blocked by:** 01–14 and server-owned-board 03 (it tidies after everything else)

**Status:** ready-for-agent

- [ ] Prototype fake screens and catalog tests pass
- [ ] No ticket for finished work still says ready-for-agent; unverifiable ones are listed
- [ ] Typecheck, vitest (`--no-file-parallelism`), BDD (one feature per process), lint (≤ 49) and boundaries (≤ 6) are no worse
