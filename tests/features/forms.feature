@forms
Feature: Forms of the form builder
  As a visitor of the site and as its administrator
  I want to send the contact form, and to find and remove what it received
  So that a message reaches the bakery and the list of messages stays clean

  Scenario: A visitor sends the contact form, which the admin lists and the mail catcher gets
    Given I am not logged in
    When I go to "/contact-us/"
    And I send the form of this page with:
      | Subject    | Webship test message              |
      | Your Name  | Webship Tester                    |
      | Your Email | tester@example.com                |
      | Purpose    | Question                          |
      | Body       | Do you bake rye bread on Sundays? |
    Then I should see "We've received your message"
    And an email with the subject "Contact message" should be sent to "us@example.com"
    And the email with the subject "Contact message" to "us@example.com" should contain "Webship test message"
    Given I am a logged in user with the "administrator" user
    When I go to the submissions of the form "Contact Us"
    Then the submissions should have the columns "Submission date", "Subject", "Your Name", "Your Email", "Purpose", "Body"
    And the submissions should list "Webship test message"
    And the submissions should list "What's up?"
    When I delete the submission "Webship test message"
    Then the submissions should not list "Webship test message"
    And the submissions should list "What's up?"

  Scenario: The browser keeps an incomplete form from being sent
    Given I am not logged in
    When I go to "/contact-us/"
    Then the form of this page should not be sent for "Subject"
    And the form of this page should not be sent for "Body"
