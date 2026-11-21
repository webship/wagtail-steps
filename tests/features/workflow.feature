@workflow
Feature: The moderation workflow
  As an editor and a moderator
  I want a page to be reviewed before it goes live, with a comment when it is sent back
  So that nothing is published without a second look

  Background:
    Given I am a logged in user with the "administrator" user
    And there is no page "Webship test page"

  Scenario: The editor submits a page, the moderator requests changes, then approves it
    Given I am a logged in user with the "editor" user
    When I add a "Standard page" under the home page
    And I set "Title" to "Webship test page"
    Then the editor should offer "Submit to Moderators approval"
    And the editor should not offer "Publish"
    When I submit the page for moderation
    Then an email with the subject "has been submitted for approval" should be sent to "moderator"
    And the email with the subject "has been submitted for approval" to "moderator" should contain "Webship test page"
    Given I am a logged in user with the "moderator" user
    Then the page "Webship test page" should be awaiting my review
    When I request changes to the page "Webship test page" with the comment "Please add an introduction."
    Then the page "Webship test page" should not be awaiting my review
    And an email with the subject "has been rejected" should be sent to "editor"
    And the email with the subject "has been rejected" to "editor" should contain "Please add an introduction."
    Given I am a logged in user with the "editor" user
    Then my page "Webship test page" should be "Changes requested at Moderators approval"
    When I edit the page "Webship test page"
    And I set "Introduction" to "An introduction, as asked."
    And I submit the page for moderation
    Then my page "Webship test page" should be "Awaiting Moderators approval"
    Given I am a logged in user with the "moderator" user
    When I approve the page "Webship test page" with the comment "Looks good."
    Then an email with the subject "has been approved" should be sent to "editor"
    When I go to the page explorer of the home page
    Then the page "Webship test page" should have the status "live"
    Given I am a logged in user with the "administrator" user
    When I open the "Workflows" report
    Then the report should list "Webship test page"
    And I delete the page "Webship test page"
