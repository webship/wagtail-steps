@explorer
Feature: The page explorer
  As an editor
  I want to find a page in the tree of the site, search it and add a page under another
  So that I reach the page I have to work on

  Background:
    Given I am a logged in user with the "editor" user

  Scenario: The explorer lists the children of a page, with their status
    When I go to the page explorer of the home page
    Then the page explorer should list "About"
    And the page explorer should list "Breads"
    And the page explorer should count 7 pages
    And the page "About" should have the status "live"
    And the page "Contact Us" should be shown as locked
    And the page "About" should not be shown as locked

  Scenario: The explorer goes down the tree
    When I go to the page explorer of the home page
    And I explore the child pages of "Breads"
    Then the page explorer should list "Anadama"
    And the page explorer should not list "About"

  Scenario: The explorer's search lists the matching pages under the page
    When I go to the page explorer of the home page
    And I search the page explorer for "cornbread"
    Then the page explorer should list "Southern Cornbread"
    And the page explorer should not list "About"
    And the page explorer should count 1 page

  Scenario: The page tree of the sidebar goes down a level at a time
    When I open the page tree
    When I open the home page in the page tree
    Then the page tree should show "Breads"
    And the page tree should show "Contact Us"
    When I open "Breads" in the page tree
    Then the page tree should show "Anadama"

  Scenario: A page offers the types its children may have
    Then the home page should offer the page type "Standard page"
    And "Breads" should offer the page type "Bread page"
    And "Breads" should not offer the page type "Blog page"

  Scenario: Adding a child page opens the editor of its type
    When I add a "Standard page" under the home page
    Then I should see "New: Standard page"
    And the editor should offer "Save draft"
