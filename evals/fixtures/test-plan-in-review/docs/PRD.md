# Product Requirements Document

**Title:** QBR Tracker — internal tool for client Quarterly Business Reviews
**Date:** 2026-11-02
**Status:** In Review

### Approvals
| Role | Name | Date |
|------|------|------|
| Client stakeholder (product owner, QBR process) | Elena Brandt, EVP – Technology Consulting | |
| Approver (owner of open decisions and CRM side) | Priya Castell, VP Sales | |

## 1. Problem Statement

Larkspur account managers hold Quarterly Business Reviews (QBRs) with client accounts. QBRs slip because nobody notices when one is due, and action items agreed with the client are not followed up. The product is a small internal web tool for Larkspur staff that reads client accounts from the company CRM (Corvid CRM), tells account managers when each account's QBR is due, and follows up action items with their owners.

## 2. Objectives
| # | Objective | Success Signal |
|---|-----------|-----------------|
| 1 | Every Customer account has its QBR within its tier's window | The leadership overdue list (FR-10) is empty |
| 2 | Action items agreed in QBRs are followed through | No open action item is more than 14 days past its due date |

## 3. Scope

### In Scope
- Account list from the CRM, due dates by tier, scheduling and recording QBRs
- Action items with owners, and email follow-up
- A leadership list of overdue accounts, and its admin

### Out of Scope
- Writing anything back to the CRM — **unless** open question 3 is answered "yes"
- Mobile layouts
- Export of any list

## 4. Personas
| Persona | Who | Goal |
|---------|-----|------|
| Account manager | Larkspur owner of an account in the CRM | Know when each QBR is due and follow up its action items |
| Action-item owner | Any Larkspur staff member | See and close the items they own |
| Leadership | A short named list of Larkspur leaders | See which accounts are overdue for a QBR |
| Admin | One or two Larkspur staff members | Keep the leadership list current |

## 5. User Flows

### Flow F1: Schedule a QBR
1. The account manager opens their account list and sees each account's tier and due date (FR-1, FR-2, FR-11).
2. They schedule a QBR for an account (FR-3).
3. The tool emails them a reminder before the QBR (FR-4).

### Flow F2: Record a QBR and work its action items
1. After the meeting, the account manager records the QBR as held, with its action items (FR-5).
2. Each owner sees their open action items (FR-6) and is emailed when one becomes overdue (FR-7).
3. If the account stops being a Customer account while items are open, the account manager is emailed once (FR-8).

## 6. Functional Requirements

**Definitions used below.**
- **Customer account:** a CRM account whose Account Type is "Customer".
- **Tier interval:** Tier 1 = 90 days, Tier 2 = 180 days, Tier 3 = 365 days.
- **Reference date:** the held date of the account's most recently recorded QBR.
- **Due date:** reference date + tier interval.
- **Today:** the calendar date in the time zone of the viewing user (for screens) or of the recipient (for emails); see section 9.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | The tool lists every Customer account from the CRM with its name, tier and account manager | Must |
| FR-2 | The tool shows each Customer account's due date | Must |
| FR-3 | The account manager schedules a QBR for one of their accounts; only one scheduled QBR per account at a time | Must |
| FR-4 | The tool emails the account manager a reminder 7 days before and 1 day before the date of a scheduled QBR | Must |
| FR-5 | The account manager records a QBR as held, with its held date and its action items (description, owner, due date) | Must |
| FR-6 | Each user sees a list of the open action items they own | Must |
| FR-7 | The tool emails an action item's owner on the first day after its due date if the item is still open | Must |
| FR-8 | The tool emails the account manager once, on the day after the tool first sees that an account has stopped being a Customer account, listing its open action items | Must |
| FR-9 | The admin maintains the leadership list | Must |
| FR-10 | Leadership sees a list of Customer accounts whose due date is before today | Must |
| FR-11 | Every page that lists accounts shows when account data was last updated from the CRM | Must |

## 7. Business Acceptance Criteria
| ID | Linked FR | Criterion |
|----|-----------|-----------|
| BAC-1 | FR-1 | An account whose Account Type is "Customer" in the CRM appears in the tool within 24 hours, with name, tier and account manager matching the CRM; an account with any other Account Type appears in no list. |
| BAC-2 | FR-2 | For an account whose last QBR was held on 2026-01-10, the due date shown is 2026-04-10 for Tier 1, 2026-07-09 for Tier 2 and 2027-01-10 for Tier 3. |
| BAC-3 | FR-3 | When the account manager schedules a QBR for a future date, the account shows that QBR as scheduled with its date. |
| BAC-4 | FR-3 | When an account already has a scheduled QBR that has not been recorded, scheduling another is refused with a message telling the account manager to reschedule the existing one. |
| BAC-5 | FR-4 | For a QBR scheduled for 2026-03-20, the account manager receives one reminder email on 2026-03-13 and one on 2026-03-19, and no other reminder for it. |
| BAC-6 | FR-5 | After a QBR is recorded as held on a date, the account's reference date is that held date, its due date is recalculated from it, and each action item entered is open and owned by the person named. |
| BAC-7 | FR-6 | A signed-in user sees the open action items they own quickly and clearly. |
| BAC-8 | FR-7 | For an open action item due on 2026-03-10, its owner receives one email on 2026-03-11. If the item is closed on or before 2026-03-10, no email is sent. |
| BAC-9 | FR-8 | When an account's Account Type changes from "Customer" to another value, its account manager receives exactly one email listing the account's open action items; the items stay open. |
| BAC-10 | FR-9 | After the admin adds a Larkspur user to the leadership list, that user can open the leadership list; after the admin removes them, they can no longer open it. A user who is not an admin cannot change the leadership list. |
| BAC-11 | FR-10 | A leadership user sees every Customer account whose due date is before today, each with name, tier, account manager, due date and days overdue. Accounts whose due date is today or later are not listed. (Subject to open question 1.) |
| BAC-12 | FR-11 | Every page that lists accounts shows "Account data last updated" with a date and time in the viewer's time zone. When the CRM cannot be read, the tool keeps showing the last data it received and that date and time. |

## 8. Shared Contract

### Entities
| Entity | Description |
|--------|-------------|
| Account | Read from the CRM: name, tier (1, 2 or 3), account owner, Account Type. |
| User | A Larkspur staff member from the company directory: name, email address, time zone (if set), active or disabled. |
| QBR | One review for one account: scheduled date, held date, status (Scheduled or Held). |
| Action Item | Description, account, owner (a User), due date, status (Open or Closed). |

### Non-Negotiable Non-Functional Requirements
- **No outside email.** The tool sends email only to Larkspur company email addresses.
- **CRM is the source of account data.** Account name, tier, account owner and Account Type come from the CRM and are never changed by the tool. Whether the tool writes anything else (such as held QBRs) back to the CRM depends on open question 3.

## 9. Non-Functional Requirements
- **Data freshness:** changes in the CRM to an account's name, tier, owner or Account Type are reflected in the tool within 24 hours.
- **Email timing:** day-based emails (FR-4, FR-7, FR-8) arrive by 09:00 on the relevant day in the recipient's time zone as set in their company account; if none is set, India Standard Time (IST).
- **Time display:** dates and times are shown in each user's own time zone, falling back to IST when none is set.
- **Speed:** with up to 300 users and about 200 Customer accounts, 95% of page loads complete within 2 seconds.

## 10. Edge Cases & Failure Scenarios
| # | Scenario | Expected Behavior |
|---|----------|--------------------|
| 1 | A user has no time zone set in their company account (section 9) | IST is used for their email timing and date/time display. |
| 2 | The CRM cannot be read (FR-11) | The tool keeps working on the last data received and shows when account data was last updated. |

## 11. Dependencies
| # | Dependency | Type | Blocking? |
|---|-----------|------|-----------|
| 1 | Read access to Corvid CRM account data | Internal (Larkspur sales systems, Priya Castell) | Yes |
| 2 | Sign-in with Larkspur company accounts and access to the company directory | Internal (Larkspur IT) | Yes |
| 3 | Ability to send email to Larkspur company addresses | Internal (Larkspur IT) | Yes |

## 12. Open Questions
| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Does "days overdue" in the leadership list count calendar days or working days? Blocks: BAC-11. | Priya Castell (via Elena Brandt) | Yes |
| 2 | Can an account manager schedule a QBR for an account they do not own, for example when covering for a colleague? Blocks: FR-3. | Priya Castell (via Elena Brandt) | Yes |
| 3 | Does the tool log each recorded QBR back to the CRM as an activity on the account? Blocks: a possible new FR — "recorded QBR is logged as a CRM activity"; Shared Contract → Non-Negotiable NFRs ("CRM is the source of account data"); Out of Scope. | Priya Castell (via Elena Brandt) | Yes |
| 4 | Which desktop browsers must be supported? | Elena Brandt | No |

## 13. Boundaries
- **Always:**
  - Treat the CRM as the source of account name, tier, account owner and Account Type; show them as read.
  - Send email only to Larkspur company addresses, by 09:00 in the recipient's time zone (IST fallback).
- **Ask first** (approvers: Elena Brandt, Priya Castell):
  - Adding, removing or reprioritising an FR, or changing a tier interval or the 7-day / 1-day reminder timing.
  - Writing anything to the CRM (pending open question 3).
- **Never:**
  - Give access to, or send email to, anyone outside Larkspur.
  - Allow tier, account owner or Account Type to be edited in the tool.
  - Weaken a Non-Negotiable NFR.
