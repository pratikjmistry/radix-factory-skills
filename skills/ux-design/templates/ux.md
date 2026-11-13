# UX

**Title:** [Product title, as in the PRD]
**Date:** [YYYY-MM-DD]
**Status:** [Draft | Ready for review]
**Sources:** `docs/PRD.md` at Status [status, date]; `docs/ARCHITECTURE.md` at Status [status], Frontend "[Frontend row text]" ([ADR-nnnn]); `CONSTRAINTS.md` [present / absent]; brand: [`docs/ux/brand/<file>`, or "none supplied: neutral defaults, see Open Questions #n"]

### Approvals
| Role | Name | Date |
|------|------|------|
| [Reviewer role, from the PRD's approvers] | [Name] | |

## 1. Scope and Sources

[What this design covers: the flows, the roles, the devices from the PRD's device NFR. Precedence used: PRD > CONSTRAINTS.md > ARCHITECTURE.md / ADRs. Anything still to come, e.g. "SCR-4 blocked until PRD OQ 2 is answered".]

## 2. FR Classification

Class is `Screen`, `Email`, `Background` or `Non-UI`; an FR with two outputs takes two, e.g. `Screen + Email`.

| FR | Class | Screen(s) | Reason |
|----|-------|-----------|--------|
| [FR-1] | [Screen] | [SCR-1] | [What the user sees or does, citing the BAC] |
| [FR-2] | [Email] | — | [Only output a user sees is the email in BAC-n] |

## 3. Screen Inventory

States are kebab-case names. Each state has exactly one page: `prototype/scr-NN-<slug>--<state>.html`.

| SCR | Screen | FRs | BACs / edge cases | Roles | States | Spec | Status |
|-----|--------|-----|-------------------|-------|--------|------|--------|
| [SCR-1] | [Screen name] | [FR-1] | [BAC-1, BAC-2, EDGE-1] | [Persona(s)] | [default, empty, permission-denied] | [screens/scr-01-<slug>.md](screens/scr-01-<slug>.md) | [Ready / Blocked (PRD OQ n) / Withdrawn] |

## 4. Navigation

[How the screens link: the main navigation items and which screen each opens, and how each screen no flow uses is reached.]

## 5. Storyboard

One table per PRD flow, every step in the PRD's order.

### Flow [F1]: [Flow name, as in the PRD]
| Step | PRD step | FR | Screen | Page |
|------|----------|----|--------|------|
| 1 | [Step text, shortened] | [FR-1] | [SCR-1] | [prototype/scr-01-<slug>--default.html](prototype/scr-01-<slug>--default.html) |
| 2 | [Step text] | — | — | Not designed: no FR (Open Questions #n) |

### Screens no flow uses
| Screen | FR | Reached from |
|--------|----|--------------|
| [SCR-n] | [FR-n] | [e.g. main navigation, visible to office managers] |

## 6. Emails and Background Behaviour

For each `Email` and `Background` FR: what the user receives or later sees, with quoted copy from the BAC verbatim.

| FR | Class | What the user receives or sees | Copy (from BAC) |
|----|-------|--------------------------------|-----------------|
| [FR-n] | [Email] | [One email to the person who …, within …] | ["Subject line exactly as in BAC-n"] |

## 7. Open Questions

| # | Question | Owner | Blocking? | Blocks |
|---|----------|-------|-----------|--------|
| 1 | [Question] | [PRD approver (via the BA) / architect / brand contact] | [Yes / No] | [SCR-n, FR-n, or —] |

## 8. Prototype

Open `docs/ux/prototype/index.html` in a browser from disk; no server or build step. [n] pages for [n] screen states. The prototype is static and not functional: forms move to the next state's page and nothing is saved or sent.
