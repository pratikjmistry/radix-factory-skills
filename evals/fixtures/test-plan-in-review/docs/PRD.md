# Product Requirements Document

**Title:** QBR Tracker — internal tool for client Quarterly Business Reviews
**Date:** 2026-11-02
**Status:** In Review

### Approvals
| Role | Name | Date |
|------|------|------|
| Client stakeholder (product owner, QBR process) | Elena Brandt, EVP – Technology Consulting | |
| Delivery lead | Marcus Oyelaran, Delivery Lead | |
| Approver (owner of open decisions and CRM side) | Priya Castell, VP Sales | |

## 1. Problem Statement

Larkspur account managers hold Quarterly Business Reviews (QBRs) with client accounts. Two things go wrong today:

1. **Action items agreed with the client are not followed up.** They live in someone's notes or inbox, and the client raises them again at the next QBR. Most action items are owned by delivery leads, project managers and developers, who do not use the company CRM (Corvid CRM), so tracking them there would leave out the people who do the work.
2. **QBRs are missed or slip, especially for lower-tier accounts**, because nobody notices when one is due.

Leadership cannot see which accounts are overdue for a QBR or have open action items without chasing people; this is a symptom of the two failures above.

The product is a small internal web tool for Larkspur staff. It reads client accounts from the CRM, tells account managers when each account's QBR is due based on its tier, lets them schedule and record QBRs, and follows up action items with their Larkspur owners until each is closed or re-dated.

## 2. Objectives
| # | Objective | Success Signal |
|---|-----------|-----------------|
| 1 | Every Customer account has its QBR within its tier's window | Every Customer account (other than those in "Needs baseline") has a recorded QBR held within 90 days (Tier 1), 180 days (Tier 2) or 365 days (Tier 3) of the previous one; the leadership "QBR overdue or due now" list (FR-33) is empty |
| 2 | Action items agreed in QBRs are followed through | No open action item is more than 14 days past its due date; the overdue count in the leadership open-items list (FR-35) shows no item more than 14 days overdue |
| 3 | Leadership can see QBR and action-item status without chasing people | Leadership answers "which accounts are overdue or due soon for a QBR, and which have open or overdue action items" from the leadership view alone |

## 3. Scope

Target: a first version live about six weeks from 2026-11-02 (around mid-December 2026).

### In Scope
- Sign-in for Larkspur staff with their company account (Microsoft 365)
- Reading Customer accounts from the CRM: account name, tier, account owner (= account manager), Account Type
- Per-account settings held in the tool: delivery lead, engagement type, baseline date
- QBR due-date calculation and status per account, based on tier
- Scheduling, rescheduling and cancelling a QBR in the tool (date, time, invited internal attendees)
- Recording a held QBR: held date, attendees, agenda, key notes, action items
- Three agenda templates (one per engagement type), editable by an admin
- Action-item tracking: close, re-date (with history), reassign
- Email reminders, nudges and escalations to Larkspur staff
- Leadership view: QBR overdue or due now, QBR due within 30 days, open action items per account
- Admin maintenance of the leadership list and agenda templates

### Out of Scope
- Microsoft Teams messages or any channel other than email (later version)
- Sending calendar invites; the account manager sends the meeting invite from Outlook as today
- Any access for, or email to, people outside Larkspur (clients, guests)
- Client-side people owning action items; if the client owes something, a Larkspur person owns chasing it
- Editing tier, account owner or Account Type in the tool
- Writing anything back to the CRM — **unless** open question 3 is answered "yes"
- Export of any list or view
- Charts, trends or historical analytics
- Structured agenda checklists, multiple templates per engagement type, or enforcing agenda length or sections
- An approval step for re-dating action items
- Mobile-optimised layouts
- Prospects and former clients in due lists (only Account Type "Customer" accounts are tracked)

## 4. Personas
| Persona | Description | Goal |
|---------|-------------|------|
| Account Manager | Larkspur staff member who is the CRM account owner of at least one Customer account (usually sales/account management) | Hold each account's QBR on time and make sure what was agreed gets done |
| Action-Item Owner | Any Larkspur staff member assigned an action item — mostly delivery leads, project managers and developers who do not use the CRM | Know what they owe, and close or re-date it before it becomes a problem |
| Delivery Lead | The Larkspur staff member set as an account's delivery lead | Be told when an action item on their account is badly overdue |
| Leadership | A short named list of Larkspur leaders | See which accounts are overdue or due soon for a QBR and which have open or overdue action items |
| Admin | One or two Larkspur staff members | Keep the leadership list and agenda templates current |

## 5. User Flows

### Flow F1: Set up an account
1. The account manager opens their account list and selects an account.
2. They set the account's delivery lead (one Larkspur user).
3. They set the account's engagement type (Fixed-cost, SOW-based, or T&M/maintenance).
4. If the account has no recorded QBR, it is in the "Needs baseline" list; the account manager enters the date of the last QBR held before the tool, and the tool calculates the due date.

### Flow F2: Schedule a QBR
1. The account manager sees an account is due within 30 days (or receives the "not scheduled" nudge).
2. They schedule the QBR in the tool: date, time and invited internal Larkspur attendees.
3. They send the calendar invite from Outlook, outside the tool.
4. The tool emails the account manager and invited attendees 7 days and 1 day before the meeting.
5. If plans change, the account manager reschedules or cancels the QBR.

### Flow F3: Record a QBR
1. After the meeting, the account manager opens the account and records the QBR.
2. The agenda field is pre-filled from the template for the account's engagement type; they edit it to match what was used.
3. They enter the held date, attendees (Larkspur users, and client-side people by name and role), key notes and action items (description, Larkspur owner, due date).
4. The tool resets the account's due date from the held date.

### Flow F4: Work an action item
1. The owner sees their open action items and opens one, including the QBR record it came from.
2. When done, the owner closes it with a closing note; or, if the date cannot be met, re-dates it with a new future date and a reason.
3. The account manager can also close, re-date or reassign the item.

### Flow F5: Overdue follow-up and escalation
1. The day after an action item's due date, the owner receives an overdue nudge, then one every 7 days until the item is closed or re-dated.
2. On the 14th day overdue, the owner receives an escalation email with the account manager and delivery lead copied.
3. From the second re-date of an item onward, each re-date by the owner emails the account manager.

### Flow F6: Leadership review
1. A leadership user opens the leadership view.
2. They see three lists: QBR overdue or due now; QBR due within 30 days; accounts with open action items.
3. They filter by account manager and/or tier, and open an account's action items to see each item's owner, due date, days overdue and re-date count.

### Flow F7: Admin maintenance
1. The admin adds or removes people on the leadership list.
2. The admin edits any of the three agenda templates.

## 6. Functional Requirements

**Definitions used below.**
- **Customer account:** a CRM account whose Account Type is "Customer".
- **Account manager (of an account):** the Larkspur user who is that account's owner in the CRM.
- **Tier interval:** Tier 1 = 90 days, Tier 2 = 180 days, Tier 3 = 365 days.
- **Reference date:** the held date of the account's most recently held recorded QBR; if none, the account's baseline date.
- **Due date:** reference date + tier interval.
- **Baseline start date:** the later of the go-live date and the date the account first appeared in the tool as a Customer account.
- **Today:** the calendar date in the time zone of the viewing user (for screens) or of the recipient (for emails); see section 9.
- **Day N overdue:** the Nth calendar day after an action item's due date.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Only people signed in with a Larkspur company account can use the tool | Must |
| FR-2 | The tool lists every Customer account from the CRM with its name, tier and account manager | Must |
| FR-3 | An account that stops being a Customer account keeps its recorded QBRs and action items readable | Must |
| FR-4 | Tier, account manager and Account Type cannot be edited in the tool | Must |
| FR-5 | The tool shows when account data was last updated from the CRM | Must |
| FR-6 | The account manager sets one delivery lead per account | Must |
| FR-7 | The account manager sets one engagement type per account | Must |
| FR-8 | The account manager enters a baseline date (last QBR held before the tool) for an account with no recorded QBR | Must |
| FR-9 | The tool calculates each Customer account's QBR due date | Must |
| FR-10 | The tool gives each Customer account one QBR status: Needs baseline, Due now, Overdue, Due within 30 days, or On track | Must |
| FR-11 | The account manager sees a list of their Customer accounts with each account's QBR status | Must |
| FR-12 | The account manager sees a separate list of their accounts in "Needs baseline" status | Must |
| FR-13 | The account manager schedules a QBR for an account with a date, time and invited internal attendees | Must |
| FR-14 | The account manager reschedules a scheduled QBR | Must |
| FR-15 | The tool emails a reminder before a scheduled QBR to the account manager and invited internal attendees | Must |
| FR-16 | The tool emails the account manager when an account's QBR is due within 30 days or due now and no QBR is scheduled | Must |
| FR-17 | The tool emails the account manager when a scheduled QBR's date has passed and no QBR has been recorded | Must |
| FR-18 | The account manager records a held QBR with held date, attendees, agenda and key notes | Must |
| FR-19 | The agenda field of a new QBR record is pre-filled from the template for the account's engagement type | Must |
| FR-20 | The account manager adds action items to a recorded QBR, each with a description, a Larkspur owner and a due date | Must |
| FR-21 | The account manager edits a recorded QBR | Must |
| FR-22 | Each user sees a list of the open action items they own | Must |
| FR-23 | An action-item owner opens the recorded QBR their action item came from | Must |
| FR-24 | The owner or the account manager closes an action item with a closing note | Must |
| FR-25 | The owner or the account manager re-dates an action item with a new due date and a reason | Must |
| FR-26 | The account manager reassigns an action item to another Larkspur user | Must |
| FR-27 | The tool shows how many times each action item has been re-dated | Must |
| FR-28 | The tool emails the owner of an overdue action item until it is closed or re-dated | Must |
| FR-29 | The tool sends an escalation email on day 14 overdue, copying the account manager and delivery lead | Must |
| FR-30 | The tool emails the account manager each time the owner re-dates an action item, from its second re-date onward | Must |
| FR-31 | The tool flags action items whose owner's company account is disabled | Must |
| FR-32 | The tool emails the account manager once, listing open action items, when an account stops being a Customer account | Must |
| FR-33 | Leadership sees a list of Customer accounts whose QBR is Overdue or Due now | Must |
| FR-34 | Leadership sees a list of Customer accounts whose QBR is Due within 30 days | Must |
| FR-35 | Leadership sees a list of accounts with open action items | Must |
| FR-36 | The leadership lists flag accounts that have no delivery lead | Must |
| FR-37 | Leadership filters the leadership lists by account manager and by tier | Must |
| FR-38 | The leadership view is read-only | Must |
| FR-39 | The admin maintains the leadership list | Must |
| FR-40 | The admin edits the agenda template text for each of the three engagement types | Must |
| FR-41 | Only the account's account manager can change that account's settings, QBRs and action-item assignments | Must |
| FR-42 | A user sees recorded QBR content only for accounts they manage or for QBRs their own action items came from | Must |
| FR-43 | The account manager cancels a scheduled QBR | Must |
| FR-44 | The tool keeps every re-date of an action item in the item's history | Must |
| FR-45 | The tool emails the account manager when an action item's owner's company account is disabled | Must |
| FR-46 | Leadership opens an account from the open-items list to see its open action items | Must |

## 7. Business Acceptance Criteria
| ID | Linked FR | Criterion |
|----|-----------|-----------|
| BAC-1 | FR-1 | A person who is not signed in and opens any page of the tool is sent to Larkspur company sign-in and sees no account, QBR or action-item data. |
| BAC-2 | FR-1 | A person who signs in with an account outside Larkspur's company organisation is refused and sees no account, QBR or action-item data. |
| BAC-3 | FR-2 | An account whose Account Type is "Customer" in the CRM appears in the tool within 24 hours, with name, tier and account manager matching the CRM. |
| BAC-4 | FR-2 | An account whose Account Type is any value other than "Customer" does not appear in any account manager's account list or in any leadership list. |
| BAC-5 | FR-3 | Within 24 hours of an account's Account Type changing from "Customer" to another value in the CRM, the account disappears from the account manager's account list and from all leadership lists, and its account manager can still open each of its recorded QBRs and action items. |
| BAC-6 | FR-3 | After an account stops being a Customer account, each owner of an open action item on it still sees that item in their open action items (FR-22). |
| BAC-7 | FR-4 | No user, including an admin, can change an account's tier, account manager or Account Type in the tool; a tier change made in the CRM is shown in the tool within 24 hours. |
| BAC-8 | FR-5 | Every page that lists accounts shows "Account data last updated" with a date and time in the viewer's time zone. When the CRM cannot be read, the tool keeps showing the last data it received and that date and time do not advance. |
| BAC-9 | FR-6 | The account manager selects one active Larkspur user as an account's delivery lead and that name is shown on the account; selecting a different user replaces the previous one, so an account never has more than one delivery lead. |
| BAC-10 | FR-7 | The account manager sets an account's engagement type to exactly one of: Fixed-cost, SOW-based, T&M/maintenance. No other value can be saved, and setting a new value replaces the previous one. |
| BAC-11 | FR-8 | For an account with no recorded QBR and no baseline date, the account manager enters a baseline date on or before today; the account leaves "Needs baseline" and its due date equals that date plus the tier interval. |
| BAC-12 | FR-8 | A baseline date later than today is refused. Until the account's first QBR is recorded, the account manager can change the baseline date to another date on or before today; the due date is recalculated from the new date, and each change is kept with the previous date, the new date, who made it and when. Once the first QBR is recorded, the baseline date can no longer be changed. |
| BAC-13 | FR-9 | For an account whose most recent recorded QBR was held on 2026-01-10, the due date shown is 2026-04-10 when the account is Tier 1, 2026-07-09 when Tier 2, and 2027-01-10 when Tier 3. |
| BAC-14 | FR-9 | Scheduling, rescheduling or cancelling a QBR does not change the account's due date; only recording a QBR (or entering a baseline date for an account with no recorded QBR) does. |
| BAC-15 | FR-9 | Within 24 hours of an account's tier changing in the CRM, its due date is recalculated as reference date plus the new tier interval. Example: an account moved from Tier 3 to Tier 1 whose reference date is 200 days ago shows status Overdue. |
| BAC-16 | FR-10 | An account with no recorded QBR and no baseline date shows "Needs baseline" while fewer than 30 days have passed since its baseline start date; it is not counted as Overdue anywhere. |
| BAC-17 | FR-10 | An account with no recorded QBR and no baseline date shows "Due now" from the 30th day after its baseline start date until a baseline date is entered or a QBR is recorded. |
| BAC-18 | FR-10 | An account with a due date shows "Overdue" when today is after the due date, "Due within 30 days" when the due date is from today up to and including today + 30 days, and "On track" when the due date is more than 30 days after today. |
| BAC-19 | FR-11 | The account manager sees every Customer account they own, each with tier, QBR status, due date, delivery lead, engagement type and the date of any scheduled QBR. Customer accounts owned by other users are not shown in this list. (Subject to open question 1.) |
| BAC-20 | FR-12 | The account manager sees a list, separate from their main account list, of their accounts in "Needs baseline" status, each showing the number of days left before it becomes "Due now". |
| BAC-21 | FR-13 | The account manager schedules a QBR by entering a date, a time and one or more invited Larkspur users; the account then shows the scheduled date and time. |
| BAC-22 | FR-13 | When an account already has a scheduled QBR that has not been recorded or cancelled, scheduling another is refused with a message telling the account manager to reschedule or cancel the existing one. |
| BAC-23 | FR-14 | After the account manager reschedules a QBR, the account shows the new date and time and reminders (FR-15) follow the new date. |
| BAC-24 | FR-15 | For a QBR scheduled on 2026-12-10, the account manager and each invited attendee receive a reminder email on 2026-12-03 and on 2026-12-09, each naming the account and the meeting date and time in the recipient's time zone. |
| BAC-25 | FR-15 | A reminder whose send date has already passed when the QBR is scheduled or rescheduled is not sent. |
| BAC-26 | FR-16 | For an account with due date 2027-01-31 and no scheduled QBR, the account manager receives an email on 2027-01-01 and every 7 days after that until a QBR is scheduled or recorded for the account. |
| BAC-27 | FR-16 | For an account that becomes "Due now" with no scheduled QBR, the account manager receives an email on the day it becomes "Due now" and every 7 days after that until a QBR is scheduled, a QBR is recorded, or a baseline date is entered. |
| BAC-28 | FR-17 | For a QBR scheduled on 2026-12-10 that has not been recorded, the account manager receives an email on 2026-12-11 and every 7 days after that until a QBR is recorded or the scheduled QBR is rescheduled or cancelled. |
| BAC-29 | FR-18 | The account manager records a QBR with a held date on or before today, attendees (Larkspur users, and people outside Larkspur entered as a name and a role), agenda text and key notes. After saving, the account's reference date equals the held date and its status is recalculated. |
| BAC-30 | FR-18 | A held date later than today is refused. |
| BAC-31 | FR-18 | When a QBR is recorded for an account that has a scheduled QBR, the scheduled QBR no longer shows as scheduled and no further reminders (FR-15) or passed-date emails (FR-17) are sent for it. |
| BAC-32 | FR-19 | For an account whose engagement type is T&M/maintenance, a new QBR record's agenda field starts with the current T&M/maintenance template text; the account manager can edit it, and editing it does not change the template. |
| BAC-33 | FR-19 | For an account with no engagement type set, a new QBR record's agenda field starts empty and shows a prompt to set the account's engagement type. |
| BAC-34 | FR-20 | An action item cannot be saved without a description, an owner and a due date; the owner can only be chosen from active Larkspur users, never entered as an outside person. |
| BAC-35 | FR-21 | The account manager changes any field of a recorded QBR; the change is saved and an entry records who made it and when. |
| BAC-36 | FR-22 | A signed-in user sees every open action item they own, across all accounts, each showing description, account, due date and, if overdue, the number of days overdue. Closed items and items owned by others are not in this list. |
| BAC-37 | FR-23 | From one of their action items, the owner opens the full recorded QBR (held date, attendees, agenda, key notes, action items) that the item came from. |
| BAC-38 | FR-24 | The owner or the account manager closes an action item by entering a closing note; a close with an empty note is refused. A closed item receives no further emails (FR-28, FR-29). |
| BAC-39 | FR-24 | A user who is neither the item's owner nor the account's account manager has no way to close the item. |
| BAC-40 | FR-25 | The owner or the account manager re-dates an action item by entering a new due date later than today and a reason; the item shows the new due date, and overdue emails (FR-28, FR-29) are then based on the new due date. |
| BAC-41 | FR-25 | A re-date with a new due date of today or earlier, or with an empty reason, is refused. |
| BAC-42 | FR-26 | The account manager changes an action item's owner to another active Larkspur user; the item then appears in the new owner's open items, no longer appears in the previous owner's, and later emails (FR-28, FR-29) go to the new owner. |
| BAC-43 | FR-27 | An action item that has been re-dated 3 times shows a re-date count of 3, both on the item and in the leadership view's item detail (FR-35). |
| BAC-44 | FR-28 | For an open action item due on 2026-12-01 that is not closed or re-dated, the owner receives an overdue email on 2026-12-02 and every 7 days after that (2026-12-09, 2026-12-16, …) until it is closed or re-dated. |
| BAC-45 | FR-29 | For an open action item due on 2026-12-01 that is not closed or re-dated, on 2026-12-15 (day 14 overdue) exactly one escalation email is sent to the owner with the account manager and the delivery lead copied. |
| BAC-46 | FR-29 | When the account has no delivery lead, or its delivery lead's company account is disabled, the day-14 escalation email copies only the account manager. |
| BAC-47 | FR-30 | When the owner re-dates an item for the first time, the account manager receives no email. When the owner re-dates the same item a second or later time, the account manager receives an email naming the item, the old date, the new date and the reason. Re-dates made by the account manager trigger no such email. |
| BAC-48 | FR-31 | Within 24 hours of an owner's company account being disabled, each of their open action items shows "Owner inactive", and no further emails are sent to the disabled owner. |
| BAC-49 | FR-32 | When an account's Account Type changes from "Customer" to another value, its account manager receives exactly one email listing the account's open action items; the items stay open and their owners keep receiving emails (FR-28, FR-29) until they are closed or re-dated. |
| BAC-50 | FR-33 | A leadership user sees every Customer account whose status is Overdue or Due now, each showing account name, tier, account manager, reference date (or "No baseline"), due date and days overdue (or "Due now"). Due now accounts are listed first, followed by Overdue accounts sorted by days overdue, highest first. |
| BAC-51 | FR-34 | A leadership user sees every Customer account whose status is Due within 30 days, each showing account name, tier, account manager, reference date, due date and days until due, sorted by due date, earliest first. |
| BAC-52 | FR-35 | A leadership user sees every account with at least one open action item, each showing the number of open items and the number of those that are overdue. |
| BAC-53 | FR-36 | In every leadership list, an account with no delivery lead, or whose delivery lead's company account is disabled, shows a "No delivery lead" flag in its own column, independent of its QBR status. |
| BAC-54 | FR-37 | Choosing an account manager, a tier, or both limits all three leadership lists to accounts matching every chosen filter; clearing the filters shows all accounts again. |
| BAC-55 | FR-38 | A leadership user who is not an account's account manager has no way to change that account's settings, QBRs or action items from the leadership view. (Subject to open question 2.) |
| BAC-56 | FR-39 | After the admin adds a Larkspur user to the leadership list, that user can open the leadership view; after the admin removes them, they can no longer open it. |
| BAC-57 | FR-39 | A user who is not an admin has no way to change the leadership list. |
| BAC-58 | FR-40 | After the admin edits the Fixed-cost template, new QBR records for Fixed-cost accounts start with the edited text, and QBR records saved before the edit are unchanged. |
| BAC-59 | FR-41 | A user who is not an account's account manager cannot schedule, reschedule, cancel, record or edit that account's QBRs, cannot set its delivery lead, engagement type or baseline date, and cannot create or reassign its action items. An action-item owner who is not the account manager can only close or re-date their own items. |
| BAC-60 | FR-42 | A user who is not an account's account manager can open only those recorded QBRs of that account from which one of their own action items came, and no other QBR content of that account. Leadership users see the leadership lists (FR-33 to FR-35, FR-46), not QBR attendees, agendas or key notes, unless they are the account's account manager or own an item from that QBR. |
| BAC-61 | FR-43 | After the account manager cancels a scheduled QBR, the account shows no scheduled QBR, no reminders (FR-15) or passed-date emails (FR-17) are sent for it, and the account's due date is unchanged. |
| BAC-62 | FR-44 | Each re-date adds an entry to the item's history showing old due date, new due date, reason, who made the change, and when; the owner, the account manager and leadership (via FR-46) can see all entries, and no entry can be edited or deleted. |
| BAC-63 | FR-45 | Within 24 hours of an owner's company account being disabled, the account manager of each affected account receives one email listing that owner's open action items on their accounts. |
| BAC-64 | FR-46 | Opening an account from the open-items list shows the open action items quickly and clearly. |
| BAC-65 | FR-40 | A user who is not an admin has no way to change any agenda template. |

## 8. Shared Contract

### Entities
| Entity | Description |
|--------|-------------|
| Account | A client account read from the CRM: name, tier (Tier 1 / 2 / 3), account owner (= account manager), Account Type. Held in the tool per account: delivery lead (one user or none), engagement type (Fixed-cost / SOW-based / T&M/maintenance, or not set), baseline date (or none), date first seen as a Customer account. Derived: reference date, due date, QBR status. |
| User | A Larkspur staff member from the company directory: name, email address, time zone (if set), whether their company account is active or disabled. Roles in the tool: account manager (derived from CRM account ownership), leadership (on the leadership list), admin. |
| QBR | One review for one account. While scheduled: date, time, invited internal attendees (users). Once recorded: held date, recorded attendees, agenda text, key notes, action items. State: Scheduled, Cancelled or Recorded. |
| Recorded Attendee | A person recorded as attending a QBR: either a User, or a person outside Larkspur entered as name and role text only (never contacted). |
| Action Item | A commitment from a recorded QBR: description, owner (one active User), due date, status (Open / Closed), closing note, re-date count, "owner inactive" flag, the QBR and account it belongs to. |
| Due-Date Change | One re-date of an action item: old due date, new due date, reason, who made it, when. |
| Agenda Template | Template text for one engagement type; exactly three exist (Fixed-cost, SOW-based, T&M/maintenance). |
| Change Record | Who changed a QBR, an action item or an account's baseline date, and when; for baseline-date changes, also the previous and new date (section 9, BAC-12). |
| Tool Settings | The go-live date (used to calculate each account's baseline start date) and the date and time account data was last updated from the CRM (FR-5). |

### Non-Negotiable Non-Functional Requirements
- **Larkspur staff only.** Only people signed in with an active Larkspur company account (Microsoft 365 organisation) can use the tool. No other sign-in method, and no client or guest access.
- **Confidential client information.** QBR records and action items are confidential client information. They are visible only to signed-in Larkspur users whose role permits it (FR-42), and never shared outside Larkspur.
- **No outside email.** The tool sends email only to Larkspur company email addresses.
- **CRM is the source of account data.** Account name, tier, account owner and Account Type come from the CRM and are never changed by the tool. Whether the tool writes anything else (such as held QBRs) back to the CRM depends on open question 3.

## 9. Non-Functional Requirements
- **Data freshness:** changes in the CRM to an account's name, tier, owner or Account Type, and the disabling of a user's company account, are reflected in the tool within 24 hours.
- **Email timing:** day-based emails (FR-15, FR-16, FR-17, FR-28 to FR-30, FR-32, FR-45) arrive by 09:00 on the relevant day in the recipient's time zone as set in their company account; if none is set, India Standard Time (IST) is used. The day-14 escalation (FR-29) uses the owner's time zone.
- **Time display:** dates and times are shown in each user's own time zone, falling back to IST when none is set.
- **Scale:** up to 300 users and about 200 Customer accounts.
- **Speed:** at that scale, 95% of page loads complete within 2 seconds.
- **Availability:** 99% per calendar month during Indian business hours (Mon–Fri 09:00–19:00 IST) and US Central business hours (Mon–Fri 09:00–18:00 US Central time; hours to be confirmed, open question 6). Outside these hours availability is best effort.
- **Retention:** QBR records, action items and their re-date history are kept for as long as the tool runs; nothing is deleted automatically in v1.
- **Audit:** every change to a QBR record, an action item or an account's baseline date records who made it and when.
- **Devices:** desktop web browsers (supported browsers to be confirmed, open question 7). Mobile layouts are not required in v1.

## 10. Edge Cases & Failure Scenarios
| # | Scenario | Expected Behavior |
|---|----------|--------------------|
| 1 | At go-live, no account has a recorded QBR (FR-8, FR-10) | Accounts show "Needs baseline" and are listed separately for the account manager; they are not counted as overdue. If no baseline date is entered or QBR recorded within 30 days of go-live, the account becomes "Due now". |
| 2 | An account becomes a Customer account after go-live (FR-10) | Same as #1, with the 30 days counted from the date it first appears in the tool as a Customer account. |
| 3 | An account's tier changes in the CRM (FR-9) | Due date is recalculated from the reference date with the new tier interval; the account may become Overdue at once. |
| 4 | An account's owner changes in the CRM (FR-11, FR-15, FR-29) | The new account manager takes over the account, the reminders for its scheduled QBR and the escalation copies. Existing action items keep their owners. |
| 5 | An action-item owner leaves Larkspur and their company account is disabled (FR-31, FR-45) | Their open items are flagged "Owner inactive", the account manager is emailed and reassigns them (FR-26); emails to the disabled owner stop. |
| 6 | A delivery lead's company account is disabled (FR-29, FR-36) | Treated as no delivery lead: the "No delivery lead" flag shows and day-14 escalations copy only the account manager, until the account manager sets a new delivery lead. |
| 7 | A scheduled QBR's date passes with nothing recorded (FR-17) | The account manager is emailed the day after and every 7 days until it is recorded, rescheduled or cancelled. The due date is not affected. |
| 8 | An account stops being a Customer account while action items are open (FR-3, FR-32) | The account manager gets one email listing the open items; items stay open and owner emails continue until each is closed or re-dated. |
| 9 | The account manager tries to schedule a second QBR while one is scheduled (FR-13) | Refused; they must reschedule or cancel the existing one. |
| 10 | The CRM cannot be read (FR-5) | The tool keeps working on the last data received and shows when account data was last updated. |
| 11 | A QBR is scheduled less than 7 days (or less than 1 day) ahead (FR-15) | Reminders whose send date has already passed are not sent. |
| 12 | A user has no time zone set in their company account (section 9) | IST is used for their email timing and date/time display. |
| 13 | An owner keeps re-dating an item (FR-25, FR-30) | Every re-date is allowed if the new date is in the future and a reason is given; from the second re-date by the owner the account manager is emailed each time, and the re-date count is visible to leadership. |
| 14 | A QBR is recorded without having been scheduled in the tool (FR-18) | Allowed; recording sets the reference date and stops any "not scheduled" emails (FR-16). |

## 11. Dependencies
| # | Dependency | Type | Blocking? |
|---|-----------|------|-----------|
| 1 | Access to Corvid CRM account data (name, tier, account owner, Account Type) for all accounts; exchange mechanism to be decided (open question 4) | Internal (Larkspur sales systems, Priya Castell) | Yes |
| 2 | Sign-in with Larkspur Microsoft 365 company accounts, and access to the company directory (name, email address, time zone, active/disabled) | Internal (Larkspur IT) | Yes |
| 3 | Ability to send email to Larkspur company addresses | Internal (Larkspur IT) | Yes |
| 4 | Each CRM account owner of a Customer account can be matched to a Larkspur company user (open question 8) | Internal (Larkspur sales systems) | Yes |
| 5 | Content for the three agenda templates (Fixed-cost, SOW-based, T&M/maintenance), each fitting a 45-minute meeting and covering delivery highlights, project risks, reference asks and recommendations for future development | Internal (admin) | No |
| 6 | A first admin named before go-live (open question 5) | Internal | No |

## 12. Open Questions
| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Does an account manager see only the Customer accounts they own, or all Customer accounts? Blocks: FR-11, BAC-19, FR-42, BAC-60. | Priya Castell (via Elena Brandt) | Yes |
| 2 | Is the leadership view read-only, or can leadership reassign action items? Blocks: FR-38, BAC-55, BAC-59; and a possible new FR — "leadership reassigns an action item". | Priya Castell (via Elena Brandt) | Yes |
| 3 | Does the tool log each recorded QBR back to the CRM as an activity on the account? Blocks: a possible new FR — "recorded QBR is logged as a CRM activity"; Shared Contract → Non-Negotiable NFRs ("CRM is the source of account data"); Out of Scope. | Priya Castell (via Elena Brandt) | Yes |
| 4 | How do the tool and the CRM exchange data (mechanism and schedule), within the 24-hour freshness target? | Priya Castell, with the architect | No |
| 5 | Who is the first admin at go-live? | Elena Brandt | No |
| 6 | What are the exact US Central business hours for the availability target (assumed Mon–Fri 09:00–18:00 US Central)? | Elena Brandt | No |
| 7 | Which desktop browsers must be supported? | Marcus Oyelaran | No |
| 8 | Does every CRM account owner of a Customer account have a matching Larkspur company account (for example, the same email address)? Blocks: FR-2, FR-11; possible new FR — manual mapping of CRM owners to Larkspur users. | Priya Castell (via Elena Brandt) | Yes |

## 13. Boundaries
Product and scope rules for everyone building from this PRD. Coding-level
rules belong in the project's constraints file, not here.

- **Always:**
  - Trace every screen, email and rule to an FR ID in this document.
  - Treat the CRM as the source of account name, tier, account owner and Account Type; show them as read.
  - Count a QBR as held only when it is recorded in the tool, never when merely scheduled.
  - Send email only to Larkspur company addresses, at 09:00 in the recipient's time zone (IST fallback).
  - Keep every re-date in the action item's history, and record who changed any QBR, action item or baseline date and when.
  - Restrict QBR content to users whose role permits it (FR-42).
- **Ask first** (approvers: Elena Brandt, Marcus Oyelaran, Priya Castell):
  - Adding, removing or reprioritising an FR, or changing a tier interval, the 30-day windows, the 7-day / 1-day reminder timing or the day-14 escalation.
  - Writing anything to the CRM (pending open question 3).
  - Adding a notification channel other than email (e.g. Teams).
  - Adding a role, or giving leadership or admins any edit rights beyond those in FR-38 to FR-40.
  - Adding an engagement type or an agenda template.
  - Adding any export, report download or external sharing.
- **Never:**
  - Give access to, or send email to, anyone outside Larkspur, including client attendees recorded on a QBR.
  - Allow tier, account owner or Account Type to be edited in the tool.
  - Send calendar invites on behalf of the account manager.
  - Delete QBR records, action items or re-date history automatically.
  - Store client or personal data not listed under Entities.
  - Weaken a Non-Negotiable NFR.
