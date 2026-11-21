@users
Feature: Users and groups
  As the administrator of the site
  I want to see the accounts and what each group may do
  So that each account has the access its work needs, and no more

  Background:
    Given I am a logged in user with the "administrator" user

  Scenario: The users list shows the accounts with their access level
    Then the users list should show "administrator" with the access level "Admin"
    And the users list should show "editor" with the access level ""
    And the users list should show "moderator" with the name "Jordan Rules"
    And the users list should show "member" as active
    And the users list should show "inactive" as not active

  Scenario: The groups give their accounts the permissions of their work
    Then the group "Editors" should be allowed to "Add" the pages under "Root"
    And the group "Editors" should be allowed to "Edit" the pages under "Root"
    And the group "Editors" should not be allowed to "Publish" the pages under "Root"
    And the group "Moderators" should be allowed to "Publish" the pages under "Root"
    And the group "Moderators" should be allowed to "Lock" the pages under "Root"
    And the group "Editors" should have the permission "Can add footer text"
