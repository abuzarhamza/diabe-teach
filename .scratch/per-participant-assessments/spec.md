# Spec: Per-participant Assessment Attempts and perception surveys

**Status:** ready-for-agent

## Problem Statement

A Classroom Game or Study RCT session has many participants, and each must take the Pretest, the Posttest and the Feedback Survey. The Game Session stores at most one Assessment Attempt per stage, and one perception survey response, for the whole session:

- After the first participant submits their Pretest, every other participant is rejected with `ASSESSMENT_ALREADY_SUBMITTED`. The Posttest behaves the same way.
- After the first participant submits the perception survey, every other participant is rejected with `SURVEY_ALREADY_SUBMITTED`.
- The Posttest report (answer-key review and metacognitive report, e.g. Uncertainty Calibration) compares a participant's Posttest against the session's single stored Pretest. That Pretest may belong to a different participant, so improvement figures are wrong.
- When a session is loaded from MongoDB, the stored list of Assessment Attempts is folded into a per-stage lookup, so only one attempt per stage survives a reload even if more were stored.

The result is that the platform cannot collect the study's core outcome data (Pretest/Posttest per learner and Likert perception responses) for more than one learner per session. Solo Practice works only because it has a single participant.

## Solution

The Game Session records Assessment Attempts per (participant, stage), and perception survey responses per participant:

- Every participant can submit their own Pretest, their own Posttest and their own perception survey once each.
- A participant who repeats a stage, or the survey, is still rejected with `ASSESSMENT_ALREADY_SUBMITTED` / `SURVEY_ALREADY_SUBMITTED`. Another participant's submission never blocks them.
- The "Pretest before Posttest" rule checks the submitting participant's own Pretest.
- The Posttest report always compares against the submitting participant's own Pretest.
- All attempts and responses for all participants are stored and reloaded faithfully. Sessions stored in the old shape (a single survey response object) still load.

## User Stories

1. As a participant in a Classroom Game, I want to submit my own Pretest even after classmates have, so that my baseline knowledge is recorded.
2. As a participant, I want to submit my own Posttest after completing my Pretest, so that my learning gain is measured.
3. As a participant, I want my Posttest report to compare against my own Pretest, so that my Uncertainty Calibration and answer review are about me.
4. As a participant, I want to submit my own perception survey regardless of others, so that my opinion is counted.
5. As a participant, I want a clear "already submitted" error if I submit the same stage or the survey twice, so that I know my first submission stands.
6. As a participant who skipped the Pretest, I want to be blocked from the Posttest even if classmates took the Pretest, so that the study protocol is respected.
7. As an instructor, I want every learner in my session to be able to take the Pretest, the Posttest and the survey, so that I can run the full study protocol with a whole class.
8. As a study researcher, I want one Pretest, one Posttest and one survey response stored per participant, so that I can analyse per-learner outcomes.
9. As a study researcher, I want previously stored sessions to remain readable, so that no collected data is lost.
10. As a solo-practice learner, I want my experience unchanged, so that nothing breaks for single-participant sessions.
11. As a client developer, I want `SURVEY_ALREADY_SUBMITTED` listed in the API error code enum, so that generated clients and validators recognise it.
12. As a maintainer, I want the aggregate to expose per-participant lookups rather than session-wide singletons, so that no use case can accidentally read another participant's data.
13. As a maintainer, I want the in-memory and MongoDB repositories to round-trip many participants' attempts and responses identically, so that tests reflect production.

## Implementation Decisions

- **Aggregate model.** `GameSession` holds Assessment Attempts keyed by (participant, stage), and perception survey responses keyed by participant. The session-wide `assessments` (stage-keyed) and `surveyResponse` (singleton) accessors are replaced by per-participant lookups: `getAssessment(participantId, stage)` and `getSurveyResponse(participantId)` (existing signatures). For persistence there is a read-only enumeration of all attempts and all responses. No caller may obtain "the" Pretest or "the" survey response for the session.
- **Invariants.** `submitAssessment` rejects only when *this participant* already has an attempt for *this stage*. `submitSurvey` rejects only when *this participant* already has a response. The error types and codes are unchanged.
- **Use cases.** The Posttest prerequisite check and the Posttest report both use the submitting participant's own Pretest. Both use cases keep running inside `GameSessionUpdateRetrier`.
- **Rehydration props.** The internal rehydration inputs become lists (all attempts; all survey responses) instead of a stage-keyed map and a single response.
- **MongoDB persistence.** Assessment Attempts remain a list of documents (each already carries its participant and stage); loading must keep every entry. Survey responses become a list field. Backward compatibility: when a stored document has the legacy single `surveyResponse` object and no list, it loads as a one-element list. Writes always use the new list field. No migration script is needed.
- **API contract.** No request or response shapes change. Add `SURVEY_ALREADY_SUBMITTED` to the OpenAPI `ApiErrorCode` enum; it is already returned but was missing from the enum.
- **Participant identity.** The participant is the one named in the verified capability token, as today.

## Testing Decisions

- **Good tests exercise external behaviour only:** HTTP status/code/body through the function handlers, and the repository contract through its port. They never assert on private aggregate structures.
- **Seam 1 — function handler tests (agreed with the user):**
  - Two participants each submit a Pretest → both 201.
  - The same participant submits a Pretest twice → second gives `ASSESSMENT_ALREADY_SUBMITTED`.
  - Participant B, who has no Pretest, cannot submit a Posttest even though A has one.
  - With different Pretests from A and B, each one's Posttest report reflects their own Pretest answers.
  - Two participants each submit the survey → both 201; a repeat by one gives `SURVEY_ALREADY_SUBMITTED`.
- **Seam 2 — repository contract suite (agreed with the user):** the existing parameterised suite (in-memory + Mongo via mongodb-memory-server) gains cases where several participants' Pretests, Posttests and survey responses round-trip intact, plus a Mongo-only case loading a legacy document with a single `surveyResponse` object.
- **Seam 3 — Cucumber (agreed with the user):** one classroom scenario where two participants both complete the Pretest, the Posttest and the survey.
- **Prior art:** `tests/functions/submit-assessment.test.ts`, `tests/functions/submit-survey.test.ts`, `tests/adapters/game-session-repository.contract.test.ts`, `tests/integration/features/assessment-journey.feature`.

## Out of Scope

- Session analytics / cohort reports (`GET /sessions/{id}/analytics`).
- Peer-vote integrity (self-votes, double votes).
- Editing or withdrawing a submitted attempt or survey.
- Checking that the token's participant is on the session roster (unchanged behaviour).
- Data migration of stored documents (handled by read-time compatibility instead).

## Further Notes

- Found during the session-write-integrity effort: the ticket 01 review (`4d7b38e`) flagged the stage-keyed assessments, and the ticket 03 review (`18264ad`) confirmed the survey has the same problem. The chief of staff found the Posttest report bug while scoping this spec.
- The paper's study protocol (`papers/diabe-teach.pdf`) gives every participant a 10-item MCQ Pretest and Posttest, each with an "I don't know" option, and an anonymous Likert survey, so per-participant storage is required to reproduce it.
- The paper describes the feedback survey as "anonymous". Storing responses per participant id is needed to block duplicates. Anonymising responses for analysis/export is a separate concern and out of scope here.
