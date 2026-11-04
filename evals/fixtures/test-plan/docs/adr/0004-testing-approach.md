# ADR-0004: Testing approach

**Status:** Proposed
**Date:** 2026-10-30

## Context
Most PRD rules are date arithmetic (FR-9, FR-10, FR-15, FR-28 to FR-30) and depend on time zones (PRD §9). The CRM, the company directory and the mail relay are external and must not be called by tests.

## Decision
- **Unit:** Domain rules (due dates, QBR status, reminder and overdue dates, time-zone conversion), with the clock injected.
- **Integration:** jobs, the authorized query module and the database, against a real PostgreSQL in a container. External systems are replaced by doubles:
  - a **fake CRM** that serves scripted account pages, including failed and partial reads
  - a **fake directory** with scripted users, including disabled and missing users
  - a **captured outbox**: the mail sender's transport is replaced and nothing leaves the process
  - a **fixed clock** set per test
- **E2E:** browser tests of the user flows and access rules against a running app with the same doubles.
- **Non-functional:** a load test of the main list pages at 300 users and 200 accounts.
- Gherkin scenarios in `tests/features/` are the source for integration and e2e tests.

## Alternatives considered
- Calling a CRM sandbox in CI: slow and flaky, and it can't simulate a partial read.

## Consequences
Every scenario must be runnable with the doubles above and a fixed clock.
