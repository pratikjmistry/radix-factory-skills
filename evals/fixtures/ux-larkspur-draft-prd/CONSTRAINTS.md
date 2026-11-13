# Constraints

## Precedence

When two sources disagree, the higher one wins. Raise the conflict with the
approver; never resolve it by editing the higher source.

1. PRD Shared Contract (`docs/PRD.md` section 8)
2. This file
3. `docs/ARCHITECTURE.md` and accepted ADRs
4. Local convention in the existing code

## Floor (always enforced, no setup required)

- No test is skipped, deleted or weakened to make a change pass.
- No lint suppression is added without an entry under Exceptions.

## Non-negotiables

| ID | Rule | Source | Checked by |
|----|------|--------|------------|
| N-1 | Every route requires a signed-in Larkspur session, except sign-in, sign-out and the health check. | PRD §8 "Larkspur staff only" | Planned: test enumerating every route |
| N-2 | A desk has at most one active booking per date, and a user at most one per date, enforced by the database. | PRD §8 "One desk, one person, one day" | Planned: migration test of both unique constraints |

## Enforced with numbers

None yet.

## Measured, not yet enforced

| ID | Metric | Today | Direction | Checked by |
|----|--------|-------|-----------|------------|
| M-1 | Accessibility: WCAG 2.1 AA violations (critical and serious) per page | No baseline yet; first measurement at the first preview deploy | must not grow | Planned: automated accessibility scan on every page, report only; a finding does not fail the build |

## Exceptions

None.
