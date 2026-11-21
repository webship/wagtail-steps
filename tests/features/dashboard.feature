@dashboard
Feature: The dashboard, the menus and the admin search
  As an account of the admin
  I want the dashboard to show what is mine to do, and the menus what I may use
  So that I find my work and nothing I may not touch

  Scenario: The dashboard sums up the site and shows the reviews awaiting a moderator
    Given I am a logged in user with the "moderator" user
    When I go to the dashboard
    Then I should see "Site summary"
    And the site summary should count 39 images
    And the site summary should count 2 documents
    And the dashboard should show the panel "Awaiting your review"
    And the panel "Awaiting your review" should list "Southern Cornbread"
    # A snippet the moderator may not edit (a person) is reviewed by the administrator.
    And the panel "Awaiting your review" should not list "Muddy Waters"

  Scenario: The editor follows the pages it submitted, and reviews nothing
    Given I am a logged in user with the "editor" user
    When I go to the dashboard
    Then the dashboard should show the panel "Your pages and snippets in a workflow"
    And the panel "Your pages and snippets in a workflow" should list "Muddy Waters"
    And the dashboard should not show the panel "Awaiting your review"

  Scenario: The site summary counts the pages of the site for an administrator
    Given I am a logged in user with the "administrator" user
    When I go to the dashboard
    Then the site summary should count 34 pages

  Scenario: The main menu shows what each account may use
    Given I am a logged in user with the "administrator" user
    Then the main menu should offer "Pages"
    And the main menu should offer "Images"
    And the main menu should offer "Reports"
    And the main menu should offer "Settings"
    And the "Settings" menu should offer "Users"
    Given I am a logged in user with the "editor" user
    Then the main menu should offer "Images"
    And the "Settings" menu should not offer "Users"
    And the "Settings" menu should not offer "Redirects"

  Scenario: A menu of the sidebar opens a listing
    Given I am a logged in user with the "administrator" user
    When I open "Users" from the "Settings" menu
    Then I should see "Users"
    And the users list should show "administrator" with the access level "Admin"
    When I open "Images" from the main menu
    Then the image library should list "Muddy Waters"

  Scenario: The admin search finds pages by their words
    Given I am a logged in user with the "editor" user
    When I search the admin for "cornbread"
    Then the admin search should find the page "Southern Cornbread"
    And the admin search should not find the page "Anadama"
    When I search the admin for "sourdough"
    Then I should see "Sorry, no pages match"

  @js-off
  Scenario: An account is refused the areas it has no permission for
    Given I am a logged in user with the "editor" user
    Then I should not be allowed to open "/admin/users/"
    And I should see the error message "Sorry, you do not have permission to access this area."
    And I should not be allowed to open "/admin/groups/"
    And I should not be allowed to open "/admin/redirects/"
