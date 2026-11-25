# 06: Pretest / Posttest Assessment View

**Status:** ready-for-agent
**Blocked by:** 05

**What to build:** `sessionsApi.submitAssessment`; `views/AssessmentView.tsx` for `pretest` and `posttest` — pack MCQs plus explicit "I don't know" (Uncertainty Calibration) option; submit once; show score + calibration summary. Instructor sees submission progress only.

## Acceptance criteria
- [ ] Cannot submit until every question answered (pure rule in `domain/`).
- [ ] Duplicate submit shows server error code.
