Feature: Classroom Game Session Journey
  As a medical education instructor
  I want to run a classroom game session with multiple participants
  So that students can practice clinical reasoning through concept chaining

  Background:
    Given the curriculum pack "diabe-teach" is available

  Scenario: Instructor creates a classroom session
    When the instructor creates a classroom session with pack "diabe-teach"
    Then the response status should be 201
    And the response should contain sessionId
    And the response should contain a 6-character roomCode
    And the response should contain instructorToken
    And the session phase should be "pretest"

  Scenario: Participant joins via room code
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    Then the response status should be 200
    And the response should contain participantId
    And the response should contain participantToken
    And the participant count should be 1

  Scenario: Multiple participants join a session
    When the instructor creates a classroom session with pack "diabe-teach"
    And participants "Alice" and "Bob" join using the room code
    Then the response status should be 200
    And the participant count should be 2

  Scenario: Invalid room code returns 404
    When someone attempts to join with invalid room code "XXXXXX"
    Then the response status should be 404
    And the response error code should be "ROOM_CODE_NOT_FOUND"

  Scenario: Instructor advances through phases
    When the instructor creates a classroom session with pack "diabe-teach"
    And the instructor advances the phase
    Then the response status should be 200
    And the session phase should be "trial-orientation"
    When the instructor advances the phase
    Then the session phase should be "round-1:chain-mapping"
    And the active round number should be 1

  Scenario: Participant cannot advance phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" attempts to advance the phase
    Then the response status should be 403
    And the response error code should be "FORBIDDEN_ROLE"

  Scenario: Complete classroom session lifecycle
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances the phase
    Then the session phase should be "trial-orientation"
    When the instructor advances the phase
    Then the session phase should be "round-1:chain-mapping"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    And the response should contain a chain with status "pending-review"
    And the response should contain a chainId
    And the chain length should be 4

  Scenario: Chain submission rejected outside chain-mapping phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits a concept chain for round 1
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  Scenario: Invalid chain with non-adjacent cells rejected
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances the phase 2 times
    And participant "Alice" submits a chain with non-adjacent cells
    Then the response status should be 422
    And the response error code should be "CHAIN_TOPOLOGY_INVALID"

  Scenario: Instructor retrieves session state
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor retrieves the session state
    Then the response status should be 200
    And the session should have 1 participant

  Scenario: Participant retrieves session state
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" retrieves the session state
    Then the response status should be 200
    And the session phase should be "pretest"
