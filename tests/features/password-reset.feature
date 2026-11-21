@password-reset
Feature: The password reset of the admin
  As an account of the admin who forgot its password
  I want a reset link by mail
  So that I can set a new password without asking anyone

  Scenario: An account gets a reset link by mail and sets its password again
    When I ask for a password reset link for "editor"
    Then an email with the subject "Password reset" should be sent to "editor"
    And the email with the subject "Password reset" to "editor" should contain "Your username (in case you've forgotten): editor"
    When I open the "/password_reset/" link of the email with the subject "Password reset" to "editor"
    Then I should see "Set your new password"
    # The password the account has, again: it stays as the build made it.
    When I set the password of "editor" on the reset page
    Then I should see "Password change successful"
    When I log in as "editor" with the login form
    Then I should be logged in as "editor"

  Scenario: An address without an account gets no mail
    When I ask for a password reset link for "nobody@example.com"
    Then no email should be sent to "nobody@example.com"
