@redirects
Feature: Redirects
  As an administrator
  I want old addresses to lead to the pages that replaced them
  So that a link from elsewhere still finds the content

  Background:
    Given I am a logged in user with the "administrator" user
    And there is no redirect "/webship-test-old-bread"

  @js-off
  Scenario: A redirect to a page is added, followed by the site, and deleted
    When I add a temporary redirect from "/webship-test-old-bread" to the page "Breads"
    Then the redirects should list "/webship-test-old-bread" to "Breads"
    And "/webship-test-old-bread" should redirect temporarily to "/breads/"
    When I delete the redirect "/webship-test-old-bread"
    Then the redirects should not list "/webship-test-old-bread"

  Scenario: The site's own redirects lead where the list says
    Then the redirects should list "/latest" to "Tracking Wild Yeast"
    And "/latest" should redirect temporarily to "/blog/wild-yeast/"
    And "/breads/baguete" should redirect permanently to "/breads/baguette/"

  @js-off
  Scenario: A redirect to an address that is not whole is refused
    When I go to "/admin/redirects/add/"
    And I set "Redirect from" to "/webship-test-old-bread"
    And I set "Redirect to any URL" to "/breads/"
    And I press "Create"
    Then the "Redirect to any URL" field should have the error "Enter a valid URL."
