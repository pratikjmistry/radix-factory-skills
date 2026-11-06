# Test Plan

**Title:** [Product title, as in the PRD]
**Date:** [YYYY-MM-DD]
**Status:** [Draft | Ready for review | Approved]
**Sources:** `docs/PRD.md` at Status [status, date]; `docs/ARCHITECTURE.md` at Status [status, or "not yet written"]; `CONSTRAINTS.md` [present / absent]

### Approvals
| Role | Name | Date |
|------|------|------|
| [Reviewer role, e.g. delivery lead] | [Name] | |

## 1. Scope and Sources

[What this plan covers and what it doesn't. Name the precedence used: PRD Shared Contract > CONSTRAINTS.md > ARCHITECTURE.md / ADRs. Name any pass still to come, e.g. "Non-functional and integration VCs pending design review".]

## 2. Test Strategy

### Levels
| Level | What it proves here | Tooling (from architecture) |
|-------|---------------------|-----------------------------|
| Unit | [Pure rules: calculations, state transitions] | [Tool, or "provisional"] |
| Integration | [Component boundaries and external systems, using the doubles below] | [Tool] |
| E2E | [Whole user flows and access rules on every route] | [Tool] |
| Non-functional | [Load, availability, timing] | [Tool or manual] |

### Test doubles
| External system / dependency | Double | Source (ADR or section) |
|------------------------------|--------|-------------------------|
| [e.g. source-of-record system] | [Fake with scripted responses, including partial and failed reads] | [ADR-nnnn] |
| [e.g. outbound email] | [Captured outbox; nothing is sent] | [ADR-nnnn] |
| [Clock] | [Fixed clock set per scenario] | [ADR-nnnn] |

### Test data and environments
[How test data is created and reset; which environment runs which level.]

## 3. Verification Criteria

| VC | Proves | Criterion (pass/fail) | Level | Method | Doubles | Scenarios / reason | State |
|----|--------|-----------------------|-------|--------|---------|--------------------|-------|
| VC-1 | [BAC-n / NFR name / Non-Negotiable / N-x] | [Observable condition with the source's numbers] | [unit / integration / e2e / non-functional] | [Scenario / Tool check / Manual] | [Doubles or "none"] | [`file.feature` › Scenario name, or reason] | [Covered (a scenario proves it) / Tool check / Manual / Non-functional / Blocked (…) / Pending architecture / Withdrawn] |

## 4. Coverage Matrix

### Business Acceptance Criteria
| BAC | FR | VCs | Scenarios | State |
|-----|----|-----|-----------|-------|
| [BAC-n] | [FR-n] | [VC-n, …] | [`file.feature` › Scenario name, …] | [Covered / Tool check / Manual / Non-functional / Blocked (…) / Pending architecture / Withdrawn] |

### Shared Contract, constraints, NFRs and edge cases
| Item | Source | VCs | State |
|------|--------|-----|-------|
| [Non-Negotiable NFR name] | PRD §8 | [VC-n] | [Covered / Tool check / Manual / Non-functional / Blocked (…) / Pending architecture] |
| [N-x] | CONSTRAINTS.md | [VC-n] | [State, e.g. Tool check when its *Checked by* tool proves it] |
| [NFR name] | PRD §9 | [VC-n] | [State] |
| [Edge case #n] | PRD §10 | [VC-n or scenario] | [State] |

## 5. Manual and Non-functional Checks

| VC | Why not a scenario | Who checks | When |
|----|--------------------|------------|------|
| [VC-n] | [Reason] | [Role] | [e.g. before release, monthly] |

## 6. Quality Gates

Thresholds live in `CONSTRAINTS.md`; this section references them by row and says when each runs.

| Gate | Condition | Runs at |
|------|-----------|---------|
| [e.g. All scenarios pass] | [Every non-blocked scenario in tests/features passes] | [CI, every PR] |
| [e.g. CONSTRAINTS.md N-x] | [See CONSTRAINTS.md row N-x] | [Stage] |

## 7. Feature File Index

| File | Capability | FRs |
|------|------------|-----|
| [`tests/features/f1-….feature`] | [User flow F1 / cross-cutting NFR / FR group] | [FR-n, …] |

## 8. Open Questions

| # | Question | Owner | Blocking? | Blocks |
|---|----------|-------|-----------|--------|
| 1 | [Question] | [PRD approver (via the BA) / decider, with the architect] | [Yes / No] | [IDs only, e.g. BAC-n, VC-n; "—" when non-blocking] |
