# Assessments, survey and analytics

Each learner takes a 10-question MCQ pre-test in the `pretest` phase and the same instrument as a post-test in the `posttest` phase. "I don't know" is allowed as an answer, to measure Uncertainty Calibration. Each learner then rates 9 Likert perception items in `feedback-survey`. Analytics are scoped by role: a learner sees their own knowledge gain, guessing reduction and chain diversity next to the cohort summary, while the instructor sees the cohort summary and the Board Neglect Heatmap.

## Sub-features

- `assessment-pretest` records a full pre-test (`201`, `recordedCount: 10`).
- `assessment-duplicate` refuses a second attempt at the same stage by the same learner.
- `assessment-per-learner` lets a second learner in the same session submit their own pre-test.
- `assessment-invalid` refuses missing answers, or values outside `0..3` and `"I_DONT_KNOW"`.
- `assessment-posttest` records the post-test and returns the learner's pre/post `report`.
- `survey-submit` records 9 ratings of `1..5` plus optional comments in `feedback-survey`.
- `survey-closed` refuses the survey outside `feedback-survey`.
- `survey-duplicate` refuses a second survey by the same learner.
- `analytics-participant` returns `role: "participant"`, `participantReport` and `cohortSummary`.
- `analytics-instructor` returns `role: "instructor"` and `cohortSummary` with `boardNeglectHeatmap`.

## How to get to it (user POV)

- `POST /api/v1/sessions/:sessionId/assessments/pretest` and `POST /api/v1/sessions/:sessionId/assessments/posttest` (participant token).
- `POST /api/v1/sessions/:sessionId/survey` (participant token).
- `GET /api/v1/sessions/:sessionId/analytics` (either role).
- Bruno: `docs/api/bruno/06-Assessments-Survey-and-Lifecycle/`. Its pre-request scripts create a new session or advance phases by themselves.

## Driving it with vapi

Preconditions:

- Baseline from the [README](./README.md).
- A classroom session in `pretest` with two learners, built by the first bullet.

- **Set up.** Run `vapi req assessments-survey-analytics sign-up POST /api/v1/accounts/sign-up --json '{"email":"assess.teacher@example.edu","password":"correct horse battery"}' --expect 201 --save accountToken=accountToken`. Then `vapi set packId=diabe-teach` and `vapi req assessments-survey-analytics create POST /api/v1/sessions --auth accountToken --bru-body docs/api/bruno/04-Game-Sessions/01-create-session.bru --expect 201 --save sessionId=sessionId --save roomCode=roomCode --save instructorToken=instructorToken`. Then join `Alice` and `Bob` the same way as in [concept-chains](./concept-chains.md), saving `aliceToken` and `bobToken`.
- **Survey too early.** Run `vapi req assessments-survey-analytics survey-too-early POST /api/v1/sessions/{{sessionId}}/survey --auth aliceToken --bru-body docs/api/bruno/06-Assessments-Survey-and-Lifecycle/03-submit-survey.bru --expect 409 --expect-code PHASE_CLOSED_FOR_SUBMISSIONS`.
- **Invalid answers.** Run `vapi req assessments-survey-analytics pretest-invalid POST /api/v1/sessions/{{sessionId}}/assessments/pretest --auth aliceToken --json '{"answers":{"dm-mcq-01":7}}' --expect 400 --expect-code INVALID_REQUEST_BODY`.
- **Alice's pre-test.** Run `vapi req assessments-survey-analytics pretest-alice POST /api/v1/sessions/{{sessionId}}/assessments/pretest --auth aliceToken --bru-body docs/api/bruno/06-Assessments-Survey-and-Lifecycle/01-submit-assessment.bru --expect 201 --expect-field recordedCount=10 --expect-field stage=pretest`.
- **Alice again.** Repeat with label `pretest-alice-again` and `--expect 409 --expect-code ASSESSMENT_ALREADY_SUBMITTED`.
- **Bob's pre-test.** Run the same body with `--auth bobToken`, label `pretest-bob` and `--expect 201`. This proves attempts are stored per learner, not per session.
- **Instructor cannot submit.** Run the same body with `--auth instructorToken`, label `pretest-instructor`, and `--expect 403 --expect-code FORBIDDEN_ROLE`.
- **Advance to posttest.** Advance 8 times with `vapi req assessments-survey-analytics advance-<n> POST /api/v1/sessions/{{sessionId}}/phase --auth instructorToken --json '{"action":"advance"}' --expect 200`, for n = 1..8. The path is pretest → trial-orientation → round-1 mapping, adjudication and summary → round-2 mapping, adjudication and summary → posttest. On the last one, add `--expect-field state.currentPhase=posttest`.
- **Alice's post-test.** Run the assessment body against `/assessments/posttest` with `--auth aliceToken`, label `posttest-alice`, `--expect 201 --expect-field stage=posttest`. The evidence has a non-null `report` with `knowledgeGainDelta`.
- **Advance to the survey.** Run one more advance with label `advance-9` and `--expect-field state.currentPhase=feedback-survey`.
- **Alice's survey.** Run `vapi req assessments-survey-analytics survey-alice POST /api/v1/sessions/{{sessionId}}/survey --auth aliceToken --bru-body docs/api/bruno/06-Assessments-Survey-and-Lifecycle/03-submit-survey.bru --expect 201 --expect-field recordedItemCount=9`. Repeat it with label `survey-alice-again` for `--expect 409 --expect-code SURVEY_ALREADY_SUBMITTED`. Bob's survey (label `survey-bob`, `--auth bobToken`) returns `201`.
- **Rating out of range.** Run `vapi req assessments-survey-analytics survey-out-of-range POST /api/v1/sessions/{{sessionId}}/survey --auth bobToken --json '{"responses":{"survey-q1":6}}' --expect 400 --expect-code INVALID_REQUEST_BODY`. Bob has already submitted, so if this returns `409` instead, the validation order is the finding.
- **Learner analytics.** Run `vapi req assessments-survey-analytics analytics-alice GET /api/v1/sessions/{{sessionId}}/analytics --auth aliceToken --expect 200 --expect-field role=participant --expect-field cohortSummary.sessionId={{sessionId}}`. `participantReport` has both `pretest` and `posttest`.
- **Instructor analytics.** Run `vapi req assessments-survey-analytics analytics-instructor GET /api/v1/sessions/{{sessionId}}/analytics --auth instructorToken --expect 200 --expect-field role=instructor`. `cohortSummary` has `participantCount` and `boardNeglectHeatmap`, and the body has no `participantReport`.

## Gotchas

- The assessment body must answer every `dm-mcq-01`…`dm-mcq-10`. Take it from the Bruno file instead of typing it.
- `posttest` requires that learner's own completed pre-test.
- Historically, attempts and surveys were stored once per session, so the second learner got `ASSESSMENT_ALREADY_SUBMITTED` or `SURVEY_ALREADY_SUBMITTED` (backlog "classroom assessment bug"). If `pretest-bob` or `survey-bob` fails that way, the bug is back. Report it; don't drop Bob.
- Sessions read the latest Pack Version for assessments. A pack re-registered mid-run changes the post-test.
- The Bruno folder's pre-request scripts create a new session when the phase doesn't match. Its evidence can describe a different session from your vars.
