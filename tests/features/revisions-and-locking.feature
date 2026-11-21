@revisions
Feature: Revisions and locking
  As an editor
  I want to compare the versions of a page and go back to an earlier one, and lock a page while I work on it
  So that no change is lost and nobody writes over my work

  Background:
    Given I am a logged in user with the "administrator" user
    And there is no page "Webship test page"
    When I add a "Standard page" under the home page
    And I set "Title" to "Webship test page"
    And I set "Introduction" to "First words."
    And I publish the page
    And I edit the page "Webship test page"
    And I set "Introduction" to "Second words."
    And I save the draft

  Scenario: The history lists the revisions, and two of them compare field by field
    When I open the history of the page
    Then the history should list "Published"
    And the history should list "Draft saved"
    And the newest entry of the history should be "Draft saved"
    When I compare the live version with the current draft
    Then the comparison should show "Introduction" changed from "First" to "Second"
    And I delete the page "Webship test page"

  Scenario: The page goes back to its previous version
    When I revert the page to the live version
    Then "Introduction" should be set to "First words."
    When I open the history of the page
    Then the newest entry of the history should be "Reverted to previous revision"
    And I delete the page "Webship test page"

  Scenario: A locked page cannot be changed by another account
    When I edit the page "Webship test page"
    And I lock the page
    Then the status panel should say "Locked by you"
    Given I am a logged in user with the "moderator" user
    When I edit the page "Webship test page"
    Then I should see the message "was locked by administrator"
    And the editor should not offer "Publish"
    When I go to the page explorer of the home page
    Then the page "Webship test page" should be shown as locked
    Given I am a logged in user with the "administrator" user
    When I open the "Locked pages" report
    Then the report should list "Webship test page"
    When I edit the page "Webship test page"
    And I unlock the page
    Then the status panel should say "Unlocked"
    And I delete the page "Webship test page"
