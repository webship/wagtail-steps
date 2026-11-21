@must-fail @session
Feature: Assertions of the session and the admin that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read: the site is left as
  it was.

  Scenario: A login that worked is not a refused one
    Fails with: The login was not refused
    Given I am not logged in
    When I log in as "editor" with the login form
    Then the login should be refused with "didn't match"

  Scenario: The editor is not the moderator
    Fails with: not to "moderator"
    Given I am a logged in user with the "editor" user
    Then I should be logged in as "moderator"

  Scenario: An account that is logged in is not logged out
    Fails with: Someone is logged in to the admin
    Given I am a logged in user with the "editor" user
    Then I should not be logged in

  Scenario: Nobody is logged in to a visitor's browser
    Fails with: Nobody is logged in to the admin
    Given I am not logged in
    Then I should be logged in

  Scenario: The dashboard is not the login page
    Fails with: The page is not the admin login page
    Given I am a logged in user with the "editor" user
    When I go to the dashboard
    Then I should be on the login page

  Scenario: An area the editor may open is not refused to it
    Fails with: opened for this account
    Given I am a logged in user with the "editor" user
    Then I should not be allowed to open "/admin/pages/"

  Scenario: The editor reviews nothing
    Fails with: The dashboard has no panel "Awaiting your review"
    Given I am a logged in user with the "editor" user
    Then the dashboard should show the panel "Awaiting your review"

  Scenario: The editor's workflow panel lists only what it submitted
    Fails with: does not list "About"
    Given I am a logged in user with the "editor" user
    Then the panel "Your pages and snippets in a workflow" should list "About"

  Scenario: The site summary counts the images there are
    Fails with: The site summary counts 39 images, not 99
    Given I am a logged in user with the "editor" user
    Then the site summary should count 99 images

  Scenario: The main menu of the editor offers the images
    Fails with: The main menu offers "Images"
    Given I am a logged in user with the "editor" user
    Then the main menu should not offer "Images"

  Scenario: The settings of the editor have no users
    Fails with: The "Settings" menu does not offer "Users"
    Given I am a logged in user with the "editor" user
    Then the "Settings" menu should offer "Users"

  Scenario: A message that is not on the page
    Fails with: The page shows no success message "Page 'Nothing' has been published."
    Given I am a logged in user with the "editor" user
    When I go to the dashboard
    Then I should see the success message "Page 'Nothing' has been published."

  Scenario: The admin search finds no page it does not have
    Fails with: The admin search does not list the page "Sourdough"
    Given I am a logged in user with the "editor" user
    When I search the admin for "bread"
    Then the admin search should find the page "Sourdough"
