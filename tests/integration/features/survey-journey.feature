@integration @game-session @survey
Feature: Perception Survey Submission Journey
  As a participant in a Diabe-teach game session
  I want to submit my perception survey responses
  So that I can provide feedback on the learning experience

  Background:
    Given the curriculum pack "diabe-teach" is available

  @smoke @survey-submission
  Scenario: Participant submits perception survey and receives receipt
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances to the feedback-survey phase
    And participant "Alice" submits a perception survey
    Then the response status should be 201
    And the response should contain participantId
    And the response should contain recordedItemCount
    And the response should contain submittedAt

  @survey-submission @with-comments
  Scenario: Participant submits perception survey with optional comments
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances to the feedback-survey phase
    And participant "Alice" submits a perception survey with comments "Great learning experience!"
    Then the response status should be 201
    And the response should contain participantId
    And the response should contain recordedItemCount
    And the response should contain submittedAt

  @error-handling @duplicate
  Scenario: Participant cannot submit perception survey twice
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances to the feedback-survey phase
    And participant "Alice" submits a perception survey
    And participant "Alice" submits a perception survey again
    Then the response status should be 409
    And the response error code should be "SURVEY_ALREADY_SUBMITTED"

  @error-handling @phase-validation
  Scenario: Survey submission rejected outside feedback-survey phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits a perception survey
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  @error-handling @phase-validation
  Scenario: Survey submission rejected during posttest phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits pretest answers
    And the instructor advances to the posttest phase
    And participant "Alice" submits a perception survey
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  @error-handling @validation @authorization
  Scenario: Survey with out-of-range Likert rating, >1000-word comments, or instructor token is rejected
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances to the feedback-survey phase
    And participant "Alice" submits a perception survey with rating 6 for item "survey-q1"
    Then the response status should be 400
    And the response error code should be "INVALID_REQUEST_BODY"
    And the error should name the field "responses.survey-q1"
    And the response should be a standard error body
    When participant "Alice" submits a perception survey with 1001-word comments
    Then the response status should be 422
    And the response error code should be "SURVEY_COMMENTS_TOO_LONG"
    And the response should be a standard error body
    When the instructor attempts to submit a perception survey
    Then the response status should be 403
    And the response error code should be "FORBIDDEN_ROLE"
    And the response should be a standard error body

