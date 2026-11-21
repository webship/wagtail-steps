@site
Feature: The site a visitor sees
  As a visitor
  I want to read the pages, search them and send a form
  So that I find what the bakery offers

  Scenario: The search of the site finds the pages that hold a word
    Given I am not logged in
    When I go to "/"
    And I search the site for "bread"
    Then the search results should list "Anadama"
    And the search results should list "Bread and Circuses"
    And the search results should not list "Southern Cornbread"

  @js-off
  Scenario: A page that does not exist answers 404
    Given I am not logged in
    When I go to "/webship-test-no-such-page/"
    Then the response status code should be 404
    And I should see "Page not found"

  Scenario: A visitor gets no quick actions of the admin, an account of the admin does
    Given I am not logged in
    When I go to "/breads/"
    Then I should not see the quick actions of the admin
    Given I am a logged in user with the "editor" user
    When I go to "/breads/"
    Then I should see the quick actions of the admin
    When I choose "Edit this page" from the quick actions
    Then I should see "Editing Breads index page: Breads"
