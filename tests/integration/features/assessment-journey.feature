@integration @game-session @assessment
Feature: Assessment Submission Journey
  As a participant in a Diabe-teach game session
  I want to submit pretest and posttest assessments
  So that my knowledge gain and metacognitive calibration can be measured

  Background:
    Given the curriculum pack "diabe-teach" is available

  @smoke @pretest
  Scenario: Participant submits pretest and receives ungraded receipt
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits pretest answers
    Then the response status should be 201
    And the response should contain stage "pretest"
    And the response should contain participantId
    And the response should contain recordedCount
    And the response should contain submittedAt
    And the response should not contain graded results

  @posttest @report
  Scenario: Participant submits posttest and receives graded result with report
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits pretest answers
    And the instructor advances to the posttest phase
    And participant "Alice" submits posttest answers
    Then the response status should be 201
    And the response should contain stage "posttest"
    And the response should contain participantId
    And the response should contain submittedAt
    And the response should contain a metacognitive report
    And the response should contain answer key review

  @error-handling @duplicate
  Scenario: Participant cannot submit pretest twice
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits pretest answers
    And participant "Alice" submits pretest answers again
    Then the response status should be 409
    And the response error code should be "ASSESSMENT_ALREADY_SUBMITTED"

  @error-handling @phase-validation
  Scenario: Assessment submission rejected outside correct phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances the phase
    And participant "Alice" submits pretest answers
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  @error-handling @prerequisite
  Scenario: Participant cannot submit posttest without completing pretest first
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances to the posttest phase
    And participant "Alice" submits posttest answers
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  @classroom @per-participant
  Scenario: Two participants each complete their own Pretest, Posttest and survey
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Bob" joins using the room code
    And participant "Alice" submits pretest answers
    Then the response status should be 201
    When participant "Bob" submits pretest answers
    Then the response status should be 201
    When the instructor advances to the posttest phase
    And participant "Alice" submits posttest answers
    Then the response status should be 201
    And the metacognitive report should include a pretest summary
    When participant "Bob" submits posttest answers
    Then the response status should be 201
    And the metacognitive report should include a pretest summary
    When the instructor advances the phase
    Then the session phase should be "feedback-survey"
    When participant "Alice" submits a perception survey
    Then the response status should be 201
    When participant "Bob" submits a perception survey
    Then the response status should be 201
    When participant "Bob" submits a perception survey again
    Then the response status should be 409
    And the response error code should be "SURVEY_ALREADY_SUBMITTED"
