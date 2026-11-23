# 09: A signed-in teacher can release a new version of a pack that has a quiz

**What to build:** "Edit → save as new version" works for packs that have an assessment instrument (Pretest and Posttest questions). It needs the full pack, including each question's `correctIndex` and `explanation`, to send back as the new version. As of `93dbb3f`:
- `GET /api/v1/packs/{packId}` reveals those answers only to an instructor **Capability Token**;
- a teacher signed in with an **Account Token** gets them hidden;
- so a new version built from that response is missing the answers and may be refused by validation.

Decide in the API, per ADR-0007's shared library (any signed-in teacher can release a version): a valid Account Token also unlocks the answers on pack reads. Learners, and anonymous callers, must never see them, and the prototype then sends the full pack.

See spec: `.scratch/teacher-login/spec.md`. Found in the ticket 07 report (2026-11-19).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Handler test: with an Account Token, `GET /api/v1/packs/{packId}` returns `correctIndex` and `explanation`; anonymous callers and participant Capability Tokens don't get them
- [ ] Handler test: registering a new version built from that response, with the version bumped, succeeds for a pack that has a quiz
- [ ] Prototype: "save as new version" on Diabe-teach-like content with a quiz succeeds (checked over HTTP or in the browser)
- [ ] OpenAPI documents which callers see the answers
- [ ] Typecheck, vitest, BDD, lint (96) and boundaries (6) are no worse
