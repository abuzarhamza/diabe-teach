# 01: Every participant can take their own pretest and posttest, and their report uses their own pretest

**What to build:** In a Game Session with many participants, each participant can submit their own Pretest and their own Posttest once each. Another participant's attempt never blocks them. A participant who repeats a stage still gets `ASSESSMENT_ALREADY_SUBMITTED`. The Posttest requires the submitting participant's *own* Pretest, and the Posttest report (answer-key review and metacognitive report) compares against that participant's own Pretest. Loading a session from MongoDB keeps every stored attempt. The aggregate exposes per-participant lookups only; there is no session-wide "the Pretest" accessor.

See spec: `.scratch/per-participant-assessments/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Handler test: two participants each submit a Pretest → both 201
- [x] Handler test: the same participant submits a Pretest twice → `ASSESSMENT_ALREADY_SUBMITTED`
- [x] Handler test: participant B, who has no Pretest, cannot submit a Posttest even though A has one
- [x] Handler test: A and B with different Pretests each get a Posttest report reflecting their own Pretest answers
- [x] Repository contract suite (in-memory + Mongo): several participants' Pretests and Posttests round-trip intact
- [x] No use case reads a session-wide or stage-only assessment lookup
- [x] Cucumber classroom scenario: two participants both complete the Pretest and the Posttest
- [x] Existing tests, BDD and lint baselines unchanged
