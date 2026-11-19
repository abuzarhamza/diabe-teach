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
