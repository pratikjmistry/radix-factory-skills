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
| N-2 | Every route requires a signed-in session from the company identity provider, except sign-in, sign-out and the health check, which returns no data. | PRD §13 Never; ARCHITECTURE.md §3 | Planned: test enumerating every route and asserting its rule |
| N-3 | Account name, tier, owner and Account Type are written only by the CRM sync job. The CRM client has no write methods. | PRD §13 Always; ADR-0002 | Planned: architecture test on those setters |
| N-4 | Every CRM sync run that would remove or de-customer records goes through the mass-change guard before anything is applied. | ADR-0002 | Planned: sync tests for the threshold and hold paths |

## Enforced with numbers

None yet. Every check above is Planned.

## Exceptions

None.
