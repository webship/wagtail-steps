@reports
Feature: Reports
  As an administrator
  I want the reports to tell me what is locked, waiting or old
  So that nothing stays stuck

  Background:
    Given I am a logged in user with the "administrator" user

  Scenario: The locked pages report lists the locked pages
    When I open the "Locked pages" report
    Then the report should list "Contact Us"
    And the report row "Contact Us" should show "Locked by admin" in the "Locking status" column

  Scenario: The workflows report lists the pages in moderation
    When I open the "Workflows" report
    Then the report should list "Southern Cornbread"
    And the report row "Southern Cornbread" should show "In progress" in the "Status" column

  Scenario: The page types usage report counts the pages of each type
    When I open the "Page types usage" report
    Then the report row "Bread Page" should show "11" in the "Pages" column

  Scenario: The site history lists what was done
    When I open the "Site history" report
    Then I should see "Site history"
