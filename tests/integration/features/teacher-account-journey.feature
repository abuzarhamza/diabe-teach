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

  # react-packs 00: the web app hides Archive and "save as new version" on System Packs.
  @packs
  Scenario: The pack list and pack detail mark the System Pack and not a teacher's pack
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    And the teacher registers a new pack
    Then the response status should be 201
    When the teacher lists the packs
    Then the response status should be 200
    And the pack "diabe-teach" should be listed as a System Pack
    And the registered pack should be listed as not a System Pack
    When someone opens the pack "diabe-teach"
    Then the response status should be 200
    And the opened pack should be marked as a System Pack
    When someone opens the registered pack
    Then the response status should be 200
    And the opened pack should be marked as not a System Pack

  @packs
  Scenario: Registering a pack without signing in is refused
    When someone who has not signed in tries to register a new pack
    Then the response status should be 401
    And the response error code should be "UNAUTHORIZED_TOKEN"

  # netlify dev retries a 403 or 404 as `<path>.html`; these check the real code still arrives (api-hardening 03).
  @packs @route-params
  Scenario: Archiving the System Pack is refused as a System Pack
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    And the teacher archives the pack "diabe-teach"
    Then the response status should be 403
    And the response error code should be "PACK_IS_SYSTEM_PACK"

  @packs @route-params
  Scenario: Archiving a pack that does not exist is refused as not found
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    And the teacher archives a pack that does not exist
    Then the response status should be 404
    And the response error code should be "PACK_NOT_FOUND"

  @packs @route-params
  Scenario: Archiving twice and unarchiving twice each answer the repeat with 409
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    And the teacher registers a new pack
    Then the response status should be 201
    When the teacher archives the registered pack
    Then the response status should be 200
    When the teacher archives the registered pack
    Then the response status should be 409
    And the response error code should be "PACK_ALREADY_ARCHIVED"
    And the response should be a standard error body
    When the teacher unarchives the registered pack
    Then the response status should be 200
    When the teacher unarchives the registered pack
    Then the response status should be 409
    And the response error code should be "PACK_NOT_ARCHIVED"
    And the response should be a standard error body

  @packs @route-params
  Scenario: Opening a pack that does not exist is refused as not found
    When someone opens a pack that does not exist
    Then the response status should be 404
    And the response error code should be "PACK_NOT_FOUND"

  @smoke @account-auth
  Scenario: Teacher inspects their current account with /accounts/me and non-Account Tokens are refused
    When someone who has not signed in checks their current account
    Then the response status should be 401
    And the response error code should be "UNAUTHORIZED_TOKEN"
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the teacher checks their current account
    Then the response status should be 200
    And the current account response should match the signed-up teacher
    When the instructor creates a classroom session with pack "diabe-teach"
    Then the response status should be 201
    When the teacher checks their current account using the session's instructorToken
    Then the response status should be 401
    And the response error code should be "UNAUTHORIZED_TOKEN"
    When the teacher tries to register a new pack using the session's instructorToken
    Then the response status should be 401
    And the response error code should be "UNAUTHORIZED_TOKEN"

  @validation @error-handling
  Scenario: Duplicate email sign-up and invalid email or short password are refused
    Given a teacher with a new email address
    When the teacher signs up with email "not-an-email" and the password "correct horse battery"
    Then the response status should be 400
    And the response error code should be "INVALID_REQUEST_BODY"
    And the error should name the field "email"
    When the teacher signs up with the password "short1234"
    Then the response status should be 400
    And the response error code should be "INVALID_REQUEST_BODY"
    And the error should name the field "password"
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the teacher signs up again with their email in uppercase with surrounding spaces and the password "another valid password"
    Then the response status should be 409
    And the response error code should be "EMAIL_ALREADY_REGISTERED"

  @account-lock @error-handling
  Scenario: Five wrong passwords lock the Instructor Account with 423 even for the right password
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the teacher signs in with the password "wrong password"
    Then the response status should be 401
    And the response error code should be "INVALID_CREDENTIALS"
    When the teacher signs in with the password "wrong password"
    Then the response status should be 401
    And the response error code should be "INVALID_CREDENTIALS"
    When the teacher signs in with the password "wrong password"
    Then the response status should be 401
    And the response error code should be "INVALID_CREDENTIALS"
    When the teacher signs in with the password "wrong password"
    Then the response status should be 401
    And the response error code should be "INVALID_CREDENTIALS"
    When the teacher signs in with the password "wrong password"
    Then the response status should be 423
    And the response error code should be "ACCOUNT_TEMPORARILY_LOCKED"
    And the error details should include a lockedUntil timestamp
    When the teacher signs in with the password "correct horse battery"
    Then the response status should be 423
    And the response error code should be "ACCOUNT_TEMPORARILY_LOCKED"
    And the error details should include a lockedUntil timestamp

  @packs @validation
  Scenario: Pack validation and registration refuse duplicate versions, System Pack updates, and undersized card decks
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the teacher validates an undersized draft pack with 8 cards for a 3x3 board
    Then the response status should be 200
    And the pack validation result should be invalid with error code "INSUFFICIENT_CARDS"
    When the teacher tries to register that undersized pack
    Then the response status should be 422
    And the response error code should be "PACK_VALIDATION_FAILED"
    When the teacher registers a new pack
    Then the response status should be 201
    When the teacher registers the same pack and version again
    Then the response status should be 409
    And the response error code should be "PACK_ALREADY_EXISTS"
    When the teacher tries to register version "2.0.0" of the System Pack "diabe-teach"
    Then the response status should be 403
    And the response error code should be "PACK_IS_SYSTEM_PACK"

  @packs @sessions @error-handling
  Scenario: Starting a session with an unknown pack returns 404 and an oversized payload returns 413
    Given a teacher with a new email address
    When the teacher signs up with the password "correct horse battery"
    Then the response status should be 201
    When the instructor creates a classroom session with pack "no-such-pack"
    Then the response status should be 404
    And the response error code should be "PACK_NOT_FOUND"
    When the teacher sends a 262145-byte pack payload
    Then the response status should be 413
    And the response error code should be "PAYLOAD_TOO_LARGE"
