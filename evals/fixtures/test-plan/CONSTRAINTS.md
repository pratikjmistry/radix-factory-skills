# Constraints

## Precedence

When two sources disagree, the higher one wins. Raise the conflict with the
approver; never resolve it by editing the higher source.

1. PRD Shared Contract (`docs/PRD.md` section 8)
2. This file
3. `docs/ARCHITECTURE.md` and accepted ADRs
4. Standards overlay skills
5. Local convention in the existing code

Changes that lower any bar in this file need the approver's sign-off.

## Floor (always enforced, no setup required)

- No test is skipped, deleted or weakened to make a change pass.
- No lint or type-check suppression is added without an entry under Exceptions.

## Non-negotiables

| ID | Rule | Source | Checked by |
|----|------|--------|------------|
| N-1 | All outbound email goes through the mail sender module. It accepts user IDs only, resolves each to an active user, and refuses any address whose domain is not on the company-domain allowlist. No other module imports a mail library. | PRD §8 "No outside email"; ADR-0001 | Planned: import-restriction lint rule; unit tests of the recipient guard |
| N-2 | Every route requires a signed-in session from the company identity provider, except sign-in, sign-out and the health check, which returns no data. | PRD §8 "Larkspur staff only"; FR-1; ADR-0003 | Planned: test enumerating every route and asserting its rule |
| N-3 | QBR content and action items are read only through the authorized query module. No page or job queries those tables directly. | PRD §8 "Confidential client information"; FR-42; ADR-0003 | Planned: architecture test on database access |
| N-4 | Account name, tier, owner and Account Type are written only by the CRM sync job. The CRM client has no write methods. | PRD §8 "CRM is the source of account data"; FR-4; ADR-0002 | Planned: architecture test on those setters; review of the token's scope |
| N-5 | Due-Date Change and Change Record rows are append-only, and no code path deletes Accounts, QBRs or Action Items. Every change to a QBR, an Action Item or a baseline date writes a Change Record in the same transaction. | PRD §9 Audit, Retention; §13 Never | Planned: integration test asserting the database permissions; transaction tests |
| N-6 | Scheduled jobs are idempotent and safe to re-run. Every email is created as an outbox row with a unique key (rule, subject, recipient, local date). | PRD §9 Email timing; ADR-0001 | Planned: job tests that run each job twice and assert no duplicate rows or sends |
| N-7 | No direct clock access. Code takes the current time from the injected clock. | PRD §9 Email timing, Time display; ADR-0004 | Planned: banned-API lint rule |
| N-8 | Every CRM or directory sync run that would remove, de-customer or disable records goes through the mass-change guard before anything is applied. | ADR-0002 | Planned: sync tests for the threshold and hold paths |

## Enforced with numbers

None yet. Every check above is Planned.

## Planned (not yet enforced)

Wiring these up is the first task in `docs/PLAN.md`. Each row moves to
"Enforced with numbers" once its command fails on a deliberate violation and
passes a clean control.

| Dimension | Rule | Intended command | Runs at | Reason |
|-----------|------|------------------|---------|--------|
| Tests | All unit, integration and e2e tests pass | `npm test` | CI, every PR | No code yet |
| Types | Type check passes with no errors | `npm run typecheck` | CI, every PR | No code yet |
| Lint | Lint passes, including N-1 and N-7 rules | `npm run lint` | CI, every PR | No code yet |

## Exceptions

None.
