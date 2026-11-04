# ADR-0001: Scheduled jobs and notification outbox

**Status:** Proposed
**Date:** 2026-10-30

## Context
The PRD requires day-based emails (FR-15, FR-16, FR-17, FR-28 to FR-30, FR-32, FR-45) in each recipient's time zone (PRD §9 Email timing), and only to Larkspur addresses (PRD §8 "No outside email"). A job that fails or runs twice must not lose or duplicate an email.

## Decision
- One job worker runs every 15 minutes. For each recipient whose local time has passed 10:00 on a given day, the daily rules create Notification Outbox rows for that day. Day-based emails therefore go out at 10:00 in the recipient's time zone (IST when none is set).
- Each outbox row has a unique key (rule, subject, recipient, local date), so a re-run creates no duplicates.
- Only the mail sender module delivers outbox rows. It accepts user IDs only, resolves each to an active user, and refuses any address whose domain is not on the company-domain allowlist.
- A send with an unknown outcome is marked Failed and alerts. It is not retried automatically.

## Alternatives considered
- One daily run at a fixed UTC time: simpler, but wrong for recipients in other time zones.
- A per-recipient scheduled task: more moving parts, no benefit at 300 users.

## Consequences
Jobs are idempotent and safe to re-run (CONSTRAINTS N-6). The send time is a single setting in the notification job.
