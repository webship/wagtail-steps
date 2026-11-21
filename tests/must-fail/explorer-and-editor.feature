@must-fail @explorer
Feature: Assertions of the page explorer and the editor that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint. They only read: nothing is saved.

  Background:
    Given I am a logged in user with the "editor" user

  Scenario: The explorer lists the children there are
    Fails with: The page explorer does not list "Sourdough"
    When I go to the page explorer of the home page
    Then the page explorer should list "Sourdough"

  Scenario: The explorer counts its pages
    Fails with: The page explorer counts 7 pages, not 9
    When I go to the page explorer of the home page
    Then the page explorer should count 9 pages

  Scenario: A live page is not a draft
    Fails with: The page "About" has the status "live", not "draft"
    When I go to the page explorer of the home page
    Then the page "About" should have the status "draft"

  Scenario: A page nobody locked is not shown as locked
    Fails with: The page "About" is not shown as locked
    When I go to the page explorer of the home page
    Then the page "About" should be shown as locked

  Scenario: A page offers only its own child types
    Fails with: "Breads" does not offer the page type "Blog page"
    Then "Breads" should offer the page type "Blog page"

  Scenario: The page tree shows the pages of its level
    Fails with: The page tree does not show "Sourdough"
    When I open the page tree
    Then the page tree should show "Sourdough"

  Scenario: A field shows its own value
    Fails with: "Title" is set to "About", not "Contact"
    When I edit the page "About"
    Then "Title" should be set to "Contact"

  Scenario: The editor may not publish
    Fails with: The editor does not offer "Publish"
    When I edit the page "About"
    Then the editor should offer "Publish"

  Scenario: The status panel of a live page does not say "Scheduled"
    Fails with: The status panel does not say "Scheduled"
    When I edit the page "About"
    Then the status panel should say "Scheduled"

  Scenario: The preview shows the page, not other words
    Fails with: The preview does not show "Sourdough every morning"
    When I edit the page "About"
    Then the preview should show "Sourdough every morning"

  Scenario: A field without an error has none
    Fails with: The field "Title" does not show the error "This field is required."
    When I edit the page "About"
    Then the "Title" field should have the error "This field is required."
