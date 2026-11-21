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

  @participant-join @roster
  Scenario: The teacher's session state lists the learner who joined
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor retrieves the session state
    Then the response status should be 200
    And the session state should list participant "Alice" who has not left
    And the participant count should be 1

  @error-handling @validation
  Scenario: Invalid room code returns 404
    When someone attempts to join with invalid room code "XXXXXX"
    Then the response status should be 404
    And the response error code should be "ROOM_CODE_NOT_FOUND"

  @error-handling @validation
  Scenario: Joining without a room code returns 400 naming the field
    When someone attempts to join without a room code
    Then the response status should be 400
    And the response error code should be "INVALID_REQUEST_BODY"
    And the error should name the field "roomCode"
    And the response should be a standard error body

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
    Then the request should be forbidden

  # netlify dev retries a 403 or 404 as `<path>.html`; these check the real code still arrives (api-hardening 03).
  @route-params @error-handling
  Scenario: Opening the state of a session that does not exist is refused as not found
    When an instructor opens the state of a session that does not exist
    Then the response status should be 404
    And the response error code should be "SESSION_NOT_FOUND"

  @route-params @authorization
  Scenario: Another session's token cannot read this session's standings
    When the instructor creates a classroom session with pack "diabe-teach"
    And the instructor of another session retrieves standings for round 1
    Then the response status should be 403
    And the response error code should be "FORBIDDEN_ROLE"

  @route-params @authorization
  Scenario: Another session's token cannot list this session's chains
    When the instructor creates a classroom session with pack "diabe-teach"
    And the instructor of another session lists the chains of round 1
    Then the response status should be 403
    And the response error code should be "FORBIDDEN_ROLE"

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

  @chain-submission @extend-phase
  Scenario: Teacher extends a timed chain-mapping phase and a learner submits in the added time
    When the instructor creates a classroom session with pack "diabe-teach" and a 1-second chain-mapping phase
    And participant "Alice" joins using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When the current phase's submission window has run out
    And participant "Alice" submits a concept chain for round 1
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"
    When the instructor extends the phase by 60 seconds
    Then the response status should be 200
    And the session phase should be "round-1:chain-mapping"
    And the current phase should end at least 60 seconds from now
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201

  @extend-phase @error-handling
  Scenario: An instructor-driven phase has no timer to extend
    When the instructor creates a classroom session with pack "diabe-teach" and an instructor-driven chain-mapping phase
    And the instructor advances the phase 2 times
    And the instructor extends the phase by 60 seconds
    Then the response status should be 409
    And the response error code should be "PHASE_HAS_NO_TIMER"

  @end-session
  Scenario: Teacher ends the session mid-round and the learner sees it completed
    When the instructor creates a classroom session with pack "diabe-teach"
    And participant "Alice" joins using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When the instructor ends the session
    Then the response status should be 200
    And the session phase should be "completed"
    When participant "Alice" retrieves the session state
    Then the session phase should be "completed"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"
    When the instructor ends the session
    Then the response status should be 409
    And the response error code should be "SESSION_ALREADY_COMPLETED"

  @leave-session
  Scenario: A learner leaves mid-round and their next chain submission is refused
    When the instructor creates a classroom session with pack "diabe-teach"
    And participants "Alice" and "Bob" join using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When participant "Alice" leaves the session
    Then the response status should be 200
    And the session state should list participant "Alice" who has left
    And the session state should list participant "Bob" who has not left
    And the participant count should be 1
    When participant "Alice" leaves the session
    Then the response status should be 200
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 403
    And the response error code should be "PARTICIPANT_HAS_LEFT"
    When participant "Alice" retrieves the session state
    Then the response status should be 200
    When participant "Bob" submits a concept chain for round 1
    Then the response status should be 201

  @board @shared-board
  Scenario: Instructor and participant see the same server-dealt round 1 board and chains are checked against it
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
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    And the submitted chain should list the noted board's cards at its path
    When participant "Alice" submits a chain that runs off the bottom of the board
    Then the response status should be 422
    And the response error code should be "CHAIN_TOPOLOGY_INVALID"

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

  @adjudication @standings @error-handling
  Scenario: Peer voting, instructor final ruling lock, and round standings
    When the instructor creates a classroom session with pack "diabe-teach"
    And participants "Alice" and "Bob" join using the room code
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    When the instructor advances the phase
    Then the session phase should be "round-1:peer-adjudication"
    When participant "Bob" peer-approves the last submitted chain
    Then the response status should be 200
    And the response should contain a chain with status "pending-review"
    When participant "Bob" attempts to issue an instructor approval on the last submitted chain
    Then the response status should be 403
    And the response error code should be "FORBIDDEN_ROLE"
    And the response should be a standard error body
    When the instructor attempts to adjudicate non-existent chain "no-such-chain" in round 1
    Then the response status should be 404
    And the response error code should be "CHAIN_NOT_FOUND"
    And the response should be a standard error body
    When the instructor finalizes adjudication on the last chain with score 8
    Then the response status should be 200
    And the response should contain a chain with status "approved"
    And the chain verdict should be locked
    When participant "Bob" peer-approves the last submitted chain
    Then the response status should be 409
    And the response error code should be "ADJUDICATION_LOCKED_BY_INSTRUCTOR"
    And the response should be a standard error body
    When the instructor finalizes adjudication on the last chain with score 9
    Then the response status should be 409
    And the response error code should be "ADJUDICATION_LOCKED_BY_INSTRUCTOR"
    And the response should be a standard error body
    When the instructor retrieves standings for round 1
    Then the response status should be 200
    And the response should contain standings
    And the standings should rank participant "Alice" at rank 1 with chain length 4
    When participant "Alice" retrieves standings for round 1
    Then the response status should be 200
    And the response should contain standings
    And the standings should rank participant "Alice" at rank 1 with chain length 4
