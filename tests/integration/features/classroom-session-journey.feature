@integration @game-session @classroom
Feature: Classroom Game Session Journey
  As a medical education instructor
  I want to run a classroom game session with multiple participants
  So that students can practice clinical reasoning through concept chaining

  Background:
    Given the curriculum pack "diabe-teach" is available

  @smoke @session-creation
  Scenario: Instructor creates a classroom session
    When the instructor creates a classroom session with pack "diabe-teach"
    Then the response status should be 201
    And the response should contain sessionId
    And the response should contain a 6-character roomCode
    And the response should contain instructorToken
    And the session phase should be "pretest"

  @participant-join
  Scenario: Participant joins via room code
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    Then the response status should be 200
    And the response should contain participantId
    And the response should contain participantToken
    And the participant count should be 1

  @participant-join @multi-participant
  Scenario: Multiple participants join a session
    When the instructor creates a classroom session with pack "diabe-teach"
    And participants "Alice" and "Bob" join using the room code
    Then the response status should be 200
    And the participant count should be 2

  @error-handling @validation
  Scenario: Invalid room code returns 404
    When someone attempts to join with invalid room code "XXXXXX"
    Then the response status should be 404
    And the response error code should be "ROOM_CODE_NOT_FOUND"

  @phase-transition
  Scenario: Instructor advances through phases
    When the instructor creates a classroom session with pack "diabe-teach"
    And the instructor advances the phase
    Then the response status should be 200
    And the session phase should be "trial-orientation"
    When the instructor advances the phase
    Then the session phase should be "round-1:chain-mapping"
    And the active round number should be 1

  @authorization @error-handling
  Scenario: Participant cannot advance phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" attempts to advance the phase
    # Note: In production this returns 403. In Netlify Dev, a form fallback may return 401.
    # The core invariant is that the request is rejected (not 2xx).
    Then the request should be forbidden

  @e2e @full-journey
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

  @chain-listing
  Scenario: Teacher lists the round's chains; classmates see them from peer-adjudication on
    When the instructor creates a classroom session with pack "diabe-teach"
    And participants "Alice" and "Bob" join using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    When the instructor lists the chains of round 1
    Then the response status should be 200
    And the listed chains should be exactly the last submitted chain, from participant "Alice"
    When participant "Bob" lists the chains of round 1
    Then the response status should be 200
    And the listed chains should be empty
    When participant "Alice" lists the chains of round 1
    Then the response status should be 200
    And the listed chains should be exactly the last submitted chain, from participant "Alice"
    When the instructor advances the phase
    Then the session phase should be "round-1:peer-adjudication"
    When participant "Bob" lists the chains of round 1
    Then the response status should be 200
    And the listed chains should be exactly the last submitted chain, from participant "Alice"

  @chain-submission @validation
  Scenario: Chain submission rejected outside chain-mapping phase
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" submits a concept chain for round 1
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  @chain-submission @validation
  Scenario: Chain sent to a round that is not running is rejected
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When participant "Alice" submits a concept chain for round 2
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201

  @chain-submission @validation @topology
  Scenario: Invalid chain with non-adjacent cells rejected
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances the phase 2 times
    And participant "Alice" submits a chain with non-adjacent cells
    Then the response status should be 422
    And the response error code should be "CHAIN_TOPOLOGY_INVALID"

  @chain-submission @instructor-driven
  Scenario: Instructor-driven round accepts chains until the instructor transitions
    When the instructor creates a classroom session with pack "diabe-teach" and an instructor-driven chain-mapping phase
    And participant "Alice" joins using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    And the current phase should have no deadline
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    When the instructor advances the phase
    Then the session phase should be "round-1:peer-adjudication"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  @board @shared-board
  Scenario: Instructor and participant see the same server-dealt round 1 board
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    Then the session should have no active board
    When the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    And the active board should be a 7 by 7 grid of distinct Keyword Cards
    When the instructor notes the active board
    And the instructor retrieves the session state
    Then the active board should be the noted board
    When participant "Alice" retrieves the session state
    Then the active board should be the noted board

  @session-state @instructor
  Scenario: Instructor retrieves session state
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor retrieves the session state
    Then the response status should be 200
    And the session should have 1 participant

  @session-state @participant
  Scenario: Participant retrieves session state
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And participant "Alice" retrieves the session state
    Then the response status should be 200
    And the session phase should be "pretest"
