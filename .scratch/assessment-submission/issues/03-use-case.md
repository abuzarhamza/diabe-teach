# 03: Create SubmitAssessmentUseCase

**What to build:** The application layer use case that orchestrates assessment submission. It validates the session phase, checks answer completeness against the curriculum pack, and delegates storage to the GameSession aggregate.

**Blocked by:** 02-assessment-attempt-domain

**Status:** ready-for-agent

- [ ] Create `src/application/ports/submit-assessment.port.ts` with command and result types
- [ ] Create `SubmitAssessmentUseCase` class implementing the port
- [ ] Inject `GameSessionRepositoryPort` and `CurriculumPackRepositoryPort`
- [ ] Validate current phase matches the stage being submitted (pretest/posttest)
- [ ] Throw `PhaseClosedForSubmissionsError` if wrong phase
- [ ] Validate all questions in pack's `assessmentInstrument` have answers
- [ ] Throw `AssessmentIncompleteError` if missing answers
- [ ] Call `session.submitAssessment()` and persist via repository
- [ ] Return stage-appropriate result (receipt vs graded result)
