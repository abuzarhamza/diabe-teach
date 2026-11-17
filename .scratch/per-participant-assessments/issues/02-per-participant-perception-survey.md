# 02: Every participant can submit their own feedback survey

**What to build:** Each participant can submit their own perception survey once; another participant's response never blocks them. A participant who repeats it still gets `SURVEY_ALREADY_SUBMITTED`. Survey responses are stored per participant; in MongoDB they become a list field. A stored document in the legacy shape (a single `surveyResponse` object, no list) loads as a one-element list, and writes always use the new list field. `SURVEY_ALREADY_SUBMITTED` is added to the OpenAPI `ApiErrorCode` enum. The aggregate exposes per-participant lookup only.

See spec: `.scratch/per-participant-assessments/spec.md`. Decided with the user on 2026-11-17: responses are stored with the participant id to prevent duplicates, even though the paper calls the survey "anonymous"; anonymised export is out of scope.

**Blocked by:** 01 (per-participant assessment attempts). Both edit `GameSession` rehydration and the Mongo mapping.

**Status:** ready-for-agent

- [ ] Handler test: two participants each submit the survey → both 201
- [ ] Handler test: a repeat by one participant → `SURVEY_ALREADY_SUBMITTED`, and the other's response is unaffected
- [ ] Repository contract suite (in-memory + Mongo): several participants' survey responses round-trip intact
- [ ] Mongo-only test: a legacy document with a single `surveyResponse` object loads, and saving it writes the list form
- [ ] OpenAPI `ApiErrorCode` includes `SURVEY_ALREADY_SUBMITTED`
- [ ] The Cucumber multi-participant scenario from ticket 01 is extended so both participants submit the survey
- [ ] Existing tests, BDD and lint baselines unchanged
