@editing
Feature: Editing a page
  As an editor of the site
  I want to write a page with blocks, preview it, save it and publish it
  So that the site shows what I wrote, when I mean it to

  Background:
    Given I am a logged in user with the "administrator" user
    And there is no page "Webship test page"

  Scenario: A page is written with blocks, previewed, saved as a draft and published
    When I add a "Standard page" under the home page
    And I set these fields:
      | Title        | Webship test page        |
      | Introduction | A page the suite writes. |
    Then "Slug" should be set to "webship-test-page"
    When I add a "Heading block" block to "Page body"
    And I set "Heading text" to "Our oven" in block 1 of "Page body"
    And I set "Size" to "H2" in block 1 of "Page body"
    And I add a "Paragraph block" block to "Page body"
    And I set "Paragraph block" to "Fresh bread every morning." in block 2 of "Page body"
    Then the blocks of "Page body" should be "Heading block", "Paragraph block"
    And the preview should show "Fresh bread every morning."
    And the preview should show "Our oven"
    When I save the draft
    Then the status panel should say "Draft"
    When I publish the page
    Then I should see the success message "Page 'Webship test page' has been published."
    When I go to the page explorer of the home page
    Then the page "Webship test page" should have the status "live"
    When I go to "/webship-test-page/"
    Then I should see "Fresh bread every morning."
    And I should see "Our oven"
    When I delete the page "Webship test page"
    Then I should see the success message "Page 'Webship test page' deleted."

  Scenario: Blocks are moved, duplicated and removed
    When I add a "Standard page" under the home page
    And I set "Title" to "Webship test page"
    And I add a "Heading block" block to "Page body"
    And I set "Heading text" to "Our oven" in block 1 of "Page body"
    And I add a "Paragraph block" block to "Page body"
    And I set "Paragraph block" to "Fresh bread every morning." in block 2 of "Page body"
    And I move block 2 of "Page body" up
    Then the blocks of "Page body" should be "Paragraph block", "Heading block"
    When I duplicate block 2 of "Page body"
    Then "Page body" should have 3 blocks
    When I remove block 1 of "Page body"
    Then the blocks of "Page body" should be "Heading block", "Heading block"
    And the preview should not show "Fresh bread every morning."
    When I save the draft
    And I delete the page
    Then I should see the success message "deleted"

  Scenario: A live page is unpublished
    When I add a "Standard page" under the home page
    And I set "Title" to "Webship test page"
    And I publish the page
    And I edit the page "Webship test page"
    Then the editor should offer "Unpublish"
    When I unpublish the page
    Then I should see the success message "Page 'Webship test page' unpublished."
    When I go to the page explorer of the home page
    Then the page "Webship test page" should have the status "draft"
    And I delete the page "Webship test page"

  Scenario: A page is scheduled to go live later
    When I add a "Standard page" under the home page
    And I set "Title" to "Webship test page"
    And I schedule the page to go live at "2030-01-01 09:00"
    Then I should see the success message "has been scheduled for publishing"
    When I go to the page explorer of the home page
    Then the page "Webship test page" should have the status "scheduled"
    When I edit the page "Webship test page"
    Then the status panel should say "Go-live: Jan. 1, 2030"
    And the status panel should say "Locked by schedule"
    And I delete the page "Webship test page"

  # The admin answers the refused form with 400, which the browser logs.
  @js-off
  Scenario: A required field left empty is refused
    When I add a "Standard page" under the home page
    And I set "Introduction" to "No title yet."
    And I choose "Save draft" in the editor
    Then I should see the error message "could not be created due to validation errors"
    And the "Title" field should have the error "This field is required."

  @autosave
  Scenario: The editor saves the edits by itself
    When I add a "Standard page" under the home page
    And I set "Title" to "Webship test page"
    Then the edits should be saved by themselves
    When I set "Introduction" to "Saved without a button."
    Then the edits should be saved by themselves
    When I go to the page explorer of the home page
    Then the page "Webship test page" should have the status "draft"
    And I delete the page "Webship test page"
