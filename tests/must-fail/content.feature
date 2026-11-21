@must-fail @content
Feature: Assertions of the content, the people and the site that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint. They only read (a password reset mail is sent, nothing else changes).

  Scenario: The history lists what was done
    Fails with: The history does not list "Unpublished"
    Given I am a logged in user with the "administrator" user
    When I open the history of the page "About"
    Then the history should list "Unpublished"

  Scenario: A page that is not in moderation awaits nobody's review
    Fails with: The panel "Awaiting your review" does not list "About"
    Given I am a logged in user with the "moderator" user
    Then the page "About" should be awaiting my review

  Scenario: The editor's page awaits approval, no changes were requested
    Fails with: not "Changes requested"
    Given I am a logged in user with the "editor" user
    Then my page "Muddy Waters" should be "Changes requested"

  Scenario: The image library lists the images there are
    Fails with: The image library does not list "Webship test nothing"
    Given I am a logged in user with the "administrator" user
    Then the image library should list "Webship test nothing"

  Scenario: An image is in its own collection
    Fails with: The image "Muddy Waters" is in the collection "Other", not "Bakeries"
    Given I am a logged in user with the "administrator" user
    Then the image "Muddy Waters" should be in the collection "Bakeries"

  Scenario: The collections list the collections there are
    Fails with: The collections do not list "Webship test nothing"
    Given I am a logged in user with the "administrator" user
    Then the collections should list "Webship test nothing"

  Scenario: A listing of snippets counts its snippets
    Fails with: The "Bread types" snippets count 17, not 99
    Given I am a logged in user with the "administrator" user
    Then the "Bread types" snippets should count 99

  Scenario: The submissions list what the form received
    Fails with: No submission holds "Webship test nothing"
    Given I am a logged in user with the "administrator" user
    When I go to the submissions of the form "Contact Us"
    Then the submissions should list "Webship test nothing"

  Scenario: The editor is no administrator
    Fails with: The users list shows "editor" with the access level "", not "Admin"
    Given I am a logged in user with the "administrator" user
    Then the users list should show "editor" with the access level "Admin"

  Scenario: The editors may not publish
    Fails with: The group "Editors" is not allowed to "Publish" the pages under "Root"
    Given I am a logged in user with the "administrator" user
    Then the group "Editors" should be allowed to "Publish" the pages under "Root"

  Scenario: The editors may not manage the accounts
    Fails with: The group "Editors" does not have the permission "Can add user"
    Given I am a logged in user with the "administrator" user
    Then the group "Editors" should have the permission "Can add user"

  Scenario: A redirect goes where the list says
    Fails with: The redirect from "/latest" goes to "Tracking Wild Yeast", not "Breads"
    Given I am a logged in user with the "administrator" user
    Then the redirects should list "/latest" to "Breads"

  Scenario: A temporary redirect is not a permanent one
    Fails with: The site answers "/latest" with 302
    Given I am not logged in
    Then "/latest" should redirect permanently to "/blog/wild-yeast/"

  Scenario: The locked pages report lists the locked pages only
    Fails with: The report does not list "About"
    Given I am a logged in user with the "administrator" user
    When I open the "Locked pages" report
    Then the report should list "About"

  Scenario: The search of the site finds the pages that hold the word
    Fails with: The search results do not list "Sourdough"
    Given I am not logged in
    When I go to "/"
    And I search the site for "bread"
    Then the search results should list "Sourdough"

  Scenario: A visitor gets no quick actions
    Fails with: The page shows no quick actions of the admin
    Given I am not logged in
    When I go to "/breads/"
    Then I should see the quick actions of the admin

  Scenario: A field with a good value lets the form go
    Fails with: The field "Your Email" is valid
    Given I am not logged in
    When I go to "/contact-us/"
    Then the form of this page should not be sent for "Your Email"

  Scenario: A password reset sends a mail
    Fails with: A mail came to editor@example.com
    When I ask for a password reset link for "editor"
    Then no email should be sent to "editor"
