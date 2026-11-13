# SCR-[NN]: [Screen name]

**FRs:** [FR-n, …]
**BACs / edge cases:** [BAC-n, EDGE-n, …]
**Flows:** [F1 step 1, F1 step 3 — or "None; reached from …"]
**Status:** [Ready / Blocked (PRD OQ n) / Withdrawn (reason)]

## Purpose

[One or two sentences: what the user comes here to do.]

## Roles and Visibility

| Role | Sees | Can do |
|------|------|--------|
| [Persona] | [What is shown to them] | [Actions] |
| [Excluded persona] | [The permission-denied state] | [Nothing on this screen] |

## States

| State | Needed by | Page |
|-------|-----------|------|
| [default] | [BAC-n] | [../prototype/scr-NN-<slug>--default.html](../prototype/scr-NN-<slug>--default.html) |
| [empty] | [BAC-n] | [../prototype/scr-NN-<slug>--empty.html](../prototype/scr-NN-<slug>--empty.html) |

## Elements

The design's own elements only (not the prototype banner or state links). Role is as the browser exposes it; the accessible name is what `getByRole(role, { name })` matches. Exact text is verbatim, quoted copy from a BAC character for character.

| # | Element | Role | Accessible name | Exact text | Source | States |
|---|---------|------|-----------------|------------|--------|--------|
| 1 | [Page heading] | heading (level 1) | [Find a desk] | "[Find a desk]" | [FR-n] | [all] |
| 2 | [Submit button] | button | [Book desk] | "[Book desk]" | [BAC-n] | [default] |
| 3 | [Outcome message] | status | — | "[Copy exactly as in BAC-n]" | [BAC-n] | [done] |

## Example Data

[The rows, names, dates and numbers shown, taken from the PRD's examples, e.g. "Leeds, 8 December 2026: desks L2-14 and L2-15 on floor 2".]

## Open Questions

[UX.md Open Questions rows that affect this screen, by number, or "None".]
