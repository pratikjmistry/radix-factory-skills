# ADR-0002: CRM read-only sync and mass-change guard

**Status:** Proposed
**Date:** 2026-10-30

## Context
The PRD makes the CRM the source of account name, tier, owner and Account Type (PRD §13), and requires CRM changes to be reflected within 24 hours (PRD §9 Data freshness). A bad CRM export could make every account look like it stopped being a Customer account at once.

## Decision
- The CRM sync job reads all accounts every 6 hours with a read-only token. The CRM client has no write methods.
- A failed or partial read applies nothing, and "Account data last updated" does not advance.
- Mass-change guard: a run that would remove or de-customer more than 10% of Customer accounts is held, nothing is applied, and an alert is raised.

## Consequences
Freshness is at most 6 hours in normal operation, inside the PRD's 24 hours. A held run needs a person to release it.
