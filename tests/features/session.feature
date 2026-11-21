@session
Feature: The session of the admin
  As an account of the site
  I want to log in to the admin and out of it
  So that only the accounts with access to the admin get into it

  Scenario: A visitor who opens a page of the admin is sent to the login page
    Given I am not logged in
    When I go to "/admin/pages/"
    Then I should be on the login page
    And I should not be logged in

  Scenario Outline: The <account> account logs in through the login form
    Given I am not logged in
    When I log in as "<account>" with the login form
    Then I should be logged in as "<account>"
    And I should see "Site summary"

    Examples:
      | account       |
      | administrator |
      | editor        |
      | moderator     |

  Scenario: A wrong password is refused
    Given I am not logged in
    When I log in with the username "editor" and the password "Wrong-password-1"
    Then the login should be refused with "Your username and password didn't match. Please try again."
    And I should not be logged in

  Scenario: An unknown account and an inactive account are refused with the same words
    Given I am not logged in
    When I log in with the username "nobody-at-all" and the password "Wrong-password-1"
    Then the login should be refused with "didn't match"
    # The demo's own inactive account, with the password the demo's README gives its accounts.
    When I log in with the username "inactive" and the password "changeme"
    Then the login should be refused with "didn't match"

  Scenario: An empty login form is refused field by field
    Given I am not logged in
    When I log in with the username "" and the password ""
    Then the login should be refused with "This field is required."

  Scenario: An account without access to the admin is refused
    Given I am not logged in
    When I try to log in as "member" with the login form
    Then the login should be refused with "You do not have permission to access the admin."

  Scenario: Logging out ends the session
    Given I am a logged in user with the "editor" user
    When I log out
    Then I should be on the login page
    And I should see the message "You have been successfully logged out."
    And I should not be logged in

  Scenario: An account takes over its session from an earlier scenario
    Given I am a logged in user with the "moderator" user
    Then I should be logged in as "moderator"
    And I should be logged in
