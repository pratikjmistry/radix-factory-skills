# Product Requirements Document

**Title:** Desk Booking — book a hot desk at a Larkspur office
**Date:** 2026-11-02
**Status:** Approved

### Approvals
| Role | Name | Date |
|------|------|------|
| Product owner (workplace services) | Maren Oduya, Head of Workplace | 2026-11-04 |
| Approver (owner of open decisions) | Tomas Reyl, Facilities Director | 2026-11-04 |

## 1. Problem Statement

Larkspur moved its Leeds and Bristol offices to hot desking. Staff can't tell which desks are free before they travel in, and desks booked on a spreadsheet sit empty when people don't turn up. The product is a small internal web tool where Larkspur staff book a desk for a day, see and cancel their bookings, and check in when they arrive, so desks nobody uses are released for others.

## 2. Objectives
| # | Objective | Success Signal |
|---|-----------|-----------------|
| 1 | Staff know before travelling that a desk is free | 90% of office days start with a booking |
| 2 | Booked desks are used | Fewer than 5% of bookings are released for no check-in after the first month |

## 3. Scope

### In Scope
- Finding a free desk in an office on a date, booking it, and a confirmation email
- Seeing and cancelling one's own bookings
- Checking in on the day, and releasing desks nobody checked in to
- Office managers keeping each office's desk list current

### Out of Scope
- Mobile layouts and a mobile app
- Booking meeting rooms or parking
- Booking on behalf of someone else

## 4. Personas
| Persona | Who | Goal |
|---------|-----|------|
| Staff member | Any Larkspur employee with a company account | Book a desk for a day in the office and use it |
| Office manager | One or two named staff per office | Keep the office's desk list correct |

## 5. User Flows

### Flow F1: Book a desk
1. The staff member chooses an office and a date and sees the desks that are free (FR-1).
2. They narrow the list to one floor.
3. They book a desk (FR-2).
4. They receive a confirmation email (FR-3).

### Flow F2: Manage my bookings
1. The staff member opens My bookings and sees their upcoming bookings (FR-4).
2. They cancel a booking they no longer need (FR-5).

### Flow F3: Check in on the day
1. On the day of the booking, the staff member checks in when they arrive (FR-6).
2. A desk nobody checked in to by 10:00 is released for others to book (FR-7).

## 6. Functional Requirements

**Definitions used below.**
- **Office:** Leeds or Bristol. Each office has floors, and each floor has desks.
- **Desk number:** office letter, floor and number, for example L2-14 (Leeds, floor 2, desk 14).
- **Free desk:** a desk with no booking for that date.
- **Office time:** UK time (Europe/London) for both offices.

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | The tool lists the free desks in a chosen office on a chosen date, with each desk's number and floor | Must |
| FR-2 | A staff member books a free desk for one date; a staff member holds at most one booking per date | Must |
| FR-3 | The tool emails the staff member a confirmation when a booking is made | Must |
| FR-4 | A staff member sees their upcoming bookings in date order, with office, desk number and date | Must |
| FR-5 | A staff member cancels one of their upcoming bookings | Must |
| FR-6 | A staff member checks in to their booking between 08:00 and 10:00 office time on the booked date | Must |
| FR-7 | At 10:00 office time, a booking with no check-in is released and its desk becomes free | Must |
| FR-8 | An office manager adds desks to and removes desks from their office | Must |
| FR-9 | Only signed-in Larkspur staff can use the tool; sign-in uses their company account | Must |

## 7. Business Acceptance Criteria
| ID | Linked FR | Criterion |
|----|-----------|-----------|
| BAC-1 | FR-1 | For Leeds on 2026-12-08, every Leeds desk with no booking that day is listed with its desk number and floor (for example L2-14 on floor 2); a desk booked that day is not listed. |
| BAC-2 | FR-1 | When every desk in the chosen office is booked on the chosen date, the page shows "No desks are free in Leeds on 8 December 2026. Try another date." |
| BAC-3 | FR-2 | After the staff member books L2-14 for 2026-12-08, the page shows "Desk L2-14 is booked for Tuesday 8 December 2026." and L2-14 is no longer listed as free that day. |
| BAC-4 | FR-2 | A staff member who already has a booking on 2026-12-08 and tries to book another desk that day is refused with "You already have a desk booked on this day. Cancel it first to book another." |
| BAC-5 | FR-3 | Within 5 minutes of booking L2-14 for 2026-12-08, the staff member receives one email with the subject "Desk booked: L2-14, Leeds, 8 December 2026". |
| BAC-6 | FR-4 | A staff member with bookings on 2026-12-08 and 2026-12-03 sees both, 3 December first, each with office, desk number and date; cancelled and past bookings are not shown. With no upcoming bookings, the page shows "You have no upcoming bookings." and a link "Find a desk". |
| BAC-7 | FR-5 | Cancelling asks "Cancel your booking for Desk L2-14 on 8 December 2026?" with the buttons "Cancel booking" and "Keep booking". After "Cancel booking", the page shows "Booking cancelled." and the desk is free again that day. |
| BAC-8 | FR-6 | On 2026-12-08 between 08:00 and 10:00 office time, the booking for that day shows a "Check in" button; after check-in at 08:47 it shows "Checked in at 08:47". Before 08:00 and after 10:00 the button is not shown. |
| BAC-9 | FR-7 | A booking for 2026-12-08 with no check-in by 10:00 is released at 10:00, its desk is free for the rest of the day, and the booking no longer appears in the staff member's upcoming bookings. |
| BAC-10 | FR-8 | An office manager for Leeds adds desk L3-01 on floor 3 and it can be booked from the next day; removing a desk with no future bookings takes it off the list. A staff member who is not an office manager and opens desk management sees "You need office manager access to manage desks." and no add or remove controls. |
| BAC-11 | FR-9 | A person who is not signed in with a Larkspur company account can't open any page of the tool. |

## 8. Shared Contract

### Entities
| Entity | Description |
|--------|-------------|
| Office | Leeds or Bristol: name, floors. |
| Desk | Desk number, office, floor, active or removed. |
| Booking | One staff member, one desk, one date; status Booked, Checked in, Cancelled or Released; check-in time. |
| User | A Larkspur staff member from the company directory: name, email address, office manager for an office (or none). |

### Non-Negotiable Non-Functional Requirements
- **Larkspur staff only.** Only signed-in Larkspur staff can open any page or receive any email.
- **One desk, one person, one day.** A desk is never booked by two people for the same date.

## 9. Non-Functional Requirements
- **Devices:** desktop browsers (current Chrome, Edge and Firefox) at window widths of 1280 px and wider. Mobile layouts are out of scope.
- **Accessibility:** staff can complete every flow with a keyboard alone and with a screen reader; WCAG 2.1 AA is the target.
- **Time display:** dates and times are shown in office time (Europe/London), dates written as "8 December 2026".

## 10. Edge Cases & Failure Scenarios
| # | Scenario | Expected Behavior |
|---|----------|--------------------|
| 1 | Two staff members try to book the same desk for the same date at the same moment (FR-2) | The first booking wins; the second sees "Sorry, desk L2-14 was just booked by someone else. Pick another desk." |
| 2 | A staff member opens a check-in for a booking that was already released at 10:00 (FR-6, FR-7) | Check-in is refused and the page says the booking was released. |

## 11. Dependencies
| # | Dependency | Type | Blocking? |
|---|-----------|------|-----------|
| 1 | Sign-in with Larkspur company accounts | Internal (Larkspur IT) | Yes |
| 2 | Sending email to Larkspur addresses | Internal (Larkspur IT) | Yes |

## 12. Open Questions
| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Should Bristol go live at the same time as Leeds? | Maren Oduya | No |

## 13. Boundaries
- **Always:**
  - Show dates and times in office time.
  - Keep one booking per desk per date.
- **Ask first** (approvers: Maren Oduya, Tomas Reyl):
  - Adding, removing or reprioritising an FR, or changing the 08:00–10:00 check-in window.
- **Never:**
  - Let anyone outside Larkspur open the tool or receive its email.
  - Weaken a Non-Negotiable NFR.
