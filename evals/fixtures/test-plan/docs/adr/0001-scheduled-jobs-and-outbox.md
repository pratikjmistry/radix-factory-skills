# ADR-0001: Scheduled jobs and notification outbox

**Status:** Proposed
**Date:** 2026-10-30

## Context
The PRD requires day-based emails (FR-4, FR-7, FR-8) in each recipient's time zone (PRD §9 Email timing), and only to Larkspur addresses (PRD §8 "No outside email"). A job that fails or runs twice must not lose or duplicate an email.

## Decision
- One job worker runs every 15 minutes. For each recipient whose local time has passed 10:00 on a given day, the daily rules create outbox rows for that day. Day-based emails therefore go out at 10:00 in the recipient's time zone (IST when none is set).
- Each outbox row has a unique key (rule, subject, recipient, local date), so a re-run creates no duplicates.
- Only the mail sender module delivers outbox rows. It accepts user IDs only, resolves each to an active user, and refuses any address whose domain is not on the company-domain allowlist.

## Consequences
Jobs are idempotent and safe to re-run. The send time is a single setting in the notification job.
