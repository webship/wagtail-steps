@media
Feature: The image and document libraries
  As an editor
  I want to upload images and documents, give them their titles and collections, and set an image's focal point
  So that the pages show the right picture, cropped around what matters

  Background:
    Given I am a logged in user with the "administrator" user
    And there is no image "Webship test loaf"
    And there is no document "Webship test recipe"
    And there is no collection "Webship test collection"

  Scenario: An image is uploaded to a collection, found, given a focal point and deleted
    When I upload the image "webship-test-loaf.png" with the title "Webship test loaf" to the collection "Other"
    Then the image library should list "Webship test loaf"
    And the image "Webship test loaf" should be in the collection "Other"
    When I filter the image library by the collection "Other"
    Then the image library should list "Webship test loaf"
    And the image library should list "Muddy Waters"
    And the image library should not list "Sourdough Boules"
    When I edit the image "Webship test loaf"
    And I set the focal point of the image to the area from 55% 40% to 75% 65%
    Then the focal point of the image "Webship test loaf" should be centred at 65% 52%
    When I delete the image "Webship test loaf"
    Then the image library should not list "Webship test loaf"

  Scenario: A document is uploaded, found in the library and by its search, and deleted
    When I upload the document "webship-test-recipe.pdf" with the title "Webship test recipe"
    And I go to the document library
    Then the document library should list "Webship test recipe"
    When I search the document library for "Webship test"
    Then the document library should list "Webship test recipe"
    And the document library should not list "Cookbook: Skillet Cornbread"
    When I delete the document "Webship test recipe"
    Then the document library should not list "Webship test recipe"

  Scenario: A collection is added and deleted
    When I add the collection "Webship test collection"
    Then the collections should list "Webship test collection"
    When I delete the collection "Webship test collection"
    Then the collections should not list "Webship test collection"

  Scenario: The editor uploads an image too
    Given I am a logged in user with the "editor" user
    When I upload the image "webship-test-loaf.png" with the title "Webship test loaf"
    And I search the image library for "Webship test"
    Then the image library should list "Webship test loaf"
    When I delete the image "Webship test loaf"
    Then the image library should not list "Webship test loaf"
