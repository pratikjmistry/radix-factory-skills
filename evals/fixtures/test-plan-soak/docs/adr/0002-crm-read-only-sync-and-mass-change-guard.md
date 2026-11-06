# ADR-0002: CRM read-only sync and mass-change guard

**Status:** Proposed
**Date:** 2026-10-30

## Context
Account name, tier, owner and Account Type come from Corvid CRM and are never changed by the tool (PRD §8 "CRM is the source of account data", FR-4). Changes must show within 24 hours (PRD §9 Data freshness; BAC-3, BAC-5, BAC-7, BAC-15). When the CRM can't be read, the tool keeps the last data and the "last updated" time doesn't advance (BAC-8, edge case 10). PRD open question 4 left the exchange mechanism to the architect.

## Decision
- The CRM sync job reads all accounts through the CRM's REST API every 6 hours, with a read-only token. The tool never writes to the CRM.
- Changes are applied only after a complete, successful read of every page. A failed or partial read applies nothing and leaves Tool Settings' "last updated" time unchanged.
- **Mass-change guard:** if a run would move more than 10% of Customer accounts out of Customer status (by Account Type change, deletion or merge), the run is held, nothing is applied, and an alert is raised until an admin confirms it.
- An account deleted or merged in the CRM is treated as no longer a Customer account (FR-3): it leaves the lists, and its QBRs and action items stay readable.
- CRM account owners are matched to users by company email address (PRD open question 8, resolved).
- The same complete-read rule and guard apply to the directory sync.

## Alternatives considered
- CRM webhooks: faster, but the CRM's webhook delivery isn't guaranteed and the 24-hour target doesn't need it.
- A nightly export file: adds a file hand-off owned by another team.

## Consequences
Freshness is at most 6 hours plus run time, inside the 24-hour target. A held run needs a human, which is the point.
