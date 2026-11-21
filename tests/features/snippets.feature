@snippets
Feature: Snippets
  As an editor
  I want to add and remove the small pieces of content the pages share
  So that a list such as the bread types stays right

  Background:
    Given I am a logged in user with the "administrator" user
    And there is no "Webship test bread type" in the "Bread types" snippets

  Scenario: A snippet is added to its listing and deleted from it
    When I go to the "Bread types" snippets
    Then the "Bread types" snippets should count 17
    When I add to the "Bread types" snippets:
      | Title | Webship test bread type |
    Then I should see the success message "Bread type 'Webship test bread type'"
    And the "Bread types" snippets should list "Webship test bread type"
    And the "Bread types" snippets should count 18
    When I delete "Webship test bread type" from the "Bread types" snippets
    Then the "Bread types" snippets should not list "Webship test bread type"
    And the "Bread types" snippets should count 17

  Scenario: The snippets of the site are in its own menus
    When I open "People" from the "Bakery Misc" menu
    Then the "People" snippets should list "Roberta Johnson"
