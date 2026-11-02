# Elicitation notes: clinic appointment booking

Source: two interview sessions with the client, summarised by the analyst.

## Problem
Patients phone the front desk to book appointments. Lines are busy 9–11am and
roughly 30% of callers hang up before getting through (client's phone logs,
last quarter). Front-desk staff spend about 3 hours a day on booking calls.

## Who
- Patients: book, reschedule and cancel their own appointments.
- Front-desk staff: see the day's bookings, block out slots when a doctor is away.
- Doctors: not users of the system for now.

## What they said they want
- Patients pick a doctor, see free slots for the next 14 days, and book one.
- Patients get a confirmation by email after booking.
- Patients can cancel up to 24 hours before the appointment. Later than that,
  they have to phone.
- Rescheduling = cancel + book again, that's fine for v1.
- Staff can block a doctor's slots for a date range.
- Booking should be "fast and easy, especially on phones".
- The site must be secure, it's medical data.
- Their IT contractor suggested "just use Postgres and React".

## Constraints mentioned
- Must comply with the local health-data privacy law (client's legal team will
  confirm which articles apply).
- Client wants to see this live before the summer intake.

## Not wanted (v1)
- No payments.
- No video consultations.
- No SMS (maybe later).

## Unresolved
- How long booking history must be kept. The client said "ask legal". Nobody has
  an answer yet, and it decides what we are allowed to store.

## Approvers
- Client stakeholder: Dana Okafor (clinic operations manager)
- Delivery lead: Sam Reyes
