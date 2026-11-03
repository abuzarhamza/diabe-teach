Feature: Solo Game Session Journey
  As an individual learner
  I want to practice concept chaining on my own
  So that I can improve my clinical reasoning skills independently

  Background:
    Given the curriculum pack "diabe-teach" is available

  Scenario: Solo session auto-joins the creator as participant
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    Then the response status should be 201
    And the response should contain sessionId
    And the response should contain instructorToken
    And the solo participant should be auto-joined

  Scenario: Solo session progresses through phases
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    And the instructor advances the phase
    Then the session phase should be "trial-orientation"
    When the instructor advances the phase
    Then the session phase should be "round-1:chain-mapping"
    And the active round number should be 1

  Scenario: Solo participant submits chains in round 1
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    And the instructor advances the phase 2 times
    And participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    And the response should contain a chain with status "pending-review"
    And the chain length should be 4

  Scenario: Solo session completes round 1 chain-mapping
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 201
    When the instructor advances the phase
    Then the session phase should be "round-1:peer-adjudication"

  Scenario: Solo session progresses to round 2
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    And the instructor advances the phase 2 times
    Then the session phase should be "round-1:chain-mapping"
    When the instructor advances the phase
    Then the session phase should be "round-1:peer-adjudication"
    When the instructor advances the phase
    Then the session phase should be "round-1:round-summary"
    When the instructor advances the phase
    Then the session phase should be "round-2:chain-mapping"
    And the active round number should be 2

  Scenario: Solo session completes full journey
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    # Phase: pretest -> trial-orientation
    And the instructor advances the phase
    # Phase: trial-orientation -> round-1:chain-mapping
    And the instructor advances the phase
    # Phase: round-1:chain-mapping -> round-1:peer-adjudication
    And the instructor advances the phase
    # Phase: round-1:peer-adjudication -> round-1:round-summary
    And the instructor advances the phase
    # Phase: round-1:round-summary -> round-2:chain-mapping
    And the instructor advances the phase
    # Phase: round-2:chain-mapping -> round-2:peer-adjudication
    And the instructor advances the phase
    # Phase: round-2:peer-adjudication -> round-2:round-summary
    And the instructor advances the phase
    # Phase: round-2:round-summary -> posttest
    And the instructor advances the phase
    Then the session phase should be "posttest"
    # Phase: posttest -> feedback-survey
    When the instructor advances the phase
    Then the session phase should be "feedback-survey"
    # Phase: feedback-survey -> completed
    When the instructor advances the phase
    Then the session phase should be "completed"

  Scenario: Chain submission before chain-mapping phase fails
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    And the instructor advances the phase
    Then the session phase should be "trial-orientation"
    When participant "Alice" submits a concept chain for round 1
    Then the response status should be 409
    And the response error code should be "PHASE_CLOSED_FOR_SUBMISSIONS"

  Scenario: Solo participant can retrieve session state
    When the instructor creates a solo session with pack "diabe-teach" as "Alice"
    And participant "Alice" retrieves the session state
    Then the response status should be 200
    And the session phase should be "pretest"
    And the session should have 1 participant
