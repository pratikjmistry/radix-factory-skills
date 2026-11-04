# One file per capability: a PRD user flow, a cross-cutting Non-Negotiable NFR,
# or a group of FRs that no flow uses. Tags carry the traceability and must
# match the coverage matrix in docs/TEST-PLAN.md.
# Steps use the PRD's domain language only: no selectors, URLs, endpoints,
# table or class names, or technology names.

@F2
Feature: F2 Place an order
  A signed-in member places an order for items in stock and is told when it will arrive.

  Background:
    Given the date is 2026-03-02 and the time is 10:00 in the member's time zone "Europe/London"
    And the member "Ana" is signed in

  @FR-4 @BAC-7 @VC-12
  Scenario: An order for an item in stock is accepted
    Given the item "Desk lamp" has 3 units in stock
    When Ana orders 1 "Desk lamp"
    Then the order is accepted
    And the item "Desk lamp" has 2 units in stock

  @FR-4 @BAC-8 @VC-13
  Scenario: An order for more units than are in stock is refused
    Given the item "Desk lamp" has 1 unit in stock
    When Ana orders 2 "Desk lamp"
    Then the order is refused with the message that only 1 unit is available
    And the item "Desk lamp" still has 1 unit in stock

  @FR-5 @BAC-9 @VC-14
  Scenario Outline: The delivery date depends on the delivery option
    When Ana orders 1 "Desk lamp" with <option> delivery
    Then the confirmation shows the delivery date <date>

    Examples:
      | option   | date       |
      | standard | 2026-03-06 |
      | express  | 2026-03-03 |
