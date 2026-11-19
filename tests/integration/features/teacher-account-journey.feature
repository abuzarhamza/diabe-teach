@integration @teacher-account
Feature: Teacher account journey
  As a teacher
  I want to create an Instructor Account with my email and a password
  So that I can sign in again on another day or device

  @smoke
  Scenario: A teacher signs up, then signs in with the same email and password
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    And the response should contain an Account Token for the teacher's email
    When the teacher signs in with the password "correct horse battery"
    Then the response status should be 200
    And the response should contain an Account Token for the teacher's email
    And the signed-in account should be the one created at sign-up

  Scenario: A wrong password is refused with the generic message
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    And the teacher signs in with the password "not my password"
    Then the response status should be 401
    And the response error code should be "INVALID_CREDENTIALS"

  @classroom
  Scenario: A signed-up teacher starts a classroom game and a learner joins with the room code
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the instructor creates a classroom session with pack "diabe-teach"
    Then the response status should be 201
    And the response should contain sessionId
    And the response should contain a 6-character roomCode
    And the response should contain instructorToken
    When participant "Alice" joins using the room code
    Then the response status should be 200
    And the participant count should be 1

  @classroom
  Scenario: Starting a classroom game without signing in is refused
    When someone who has not signed in tries to create a classroom session with pack "diabe-teach"
    Then the response status should be 401
    And the response error code should be "UNAUTHORIZED_TOKEN"

  @packs
  Scenario: A signed-up teacher registers a pack, sees it listed with their author handle, and starts a classroom game on it
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the teacher registers a new pack
    Then the response status should be 201
    When the teacher lists the packs
    Then the response status should be 200
    And the registered pack should be listed with the teacher's author handle and version "1.0.0"
    When the instructor creates a classroom session with the registered pack
    Then the response status should be 201
    And the response should contain a 6-character roomCode
    When participant "Alice" joins using the room code
    Then the response status should be 200
    And the participant count should be 1

  @packs
  Scenario: Registering a pack without signing in is refused
    When someone who has not signed in tries to register a new pack
    Then the response status should be 401
    And the response error code should be "UNAUTHORIZED_TOKEN"
