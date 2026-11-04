---
name: solution-architecture
description: Turns a product requirements document into an architecture document (docs/ARCHITECTURE.md, with the tech stack folded in), architecture decision records in docs/adr/ and a CONSTRAINTS.md that carries the project's non-negotiables and precedence rule, with every Shared Contract item and Non-Negotiable NFR traced to a decision or a constraint. Use when a PRD is approved or in review and an architect must choose the stack, data model, integrations, deployment and security baseline; when a question in the PRD is routed to the architect; or when checking that an existing architecture still covers its PRD before design review.
---

# Solution Architecture

## Overview

The PRD says what the product must do. The architecture says how it will be built, and it is the second contract downstream roles trust: the test planner derives integration and non-functional scenarios from it, developers build inside it, and the code reviewer checks every change against it and `CONSTRAINTS.md`. Like the PRD, it is read by people who were not in the room, so a decision that lives only in the conversation doesn't exist.

This skill produces three things from `docs/PRD.md`:

- `docs/ARCHITECTURE.md` from [templates/architecture.md](templates/architecture.md), with the technology stack as a section rather than a separate file
- one ADR per significant decision in `docs/adr/NNNN-title.md`
- `CONSTRAINTS.md`, with the project's non-negotiables and the precedence rule that resolves conflicts between sources

It honours the PRD without renegotiating it. The architecture may refine an NFR and record the trade-off; it never changes an FR, a BAC or the Shared Contract. When the PRD looks wrong, the architect raises a question for its author.

## When to Use

- A PRD is `Approved` and the stack, data model, integrations, deployment and security baseline need deciding
- A PRD is `In Review` or `Ready for approval` and the team wants an early architecture draft, with the open PRD questions carried as risks
- The PRD routes a question to the architect (for example, how two systems exchange data)
- An existing `docs/ARCHITECTURE.md` must be checked against its PRD after the PRD changed, or before design review

**When NOT to use:**

- The PRD is `Draft` or doesn't exist: requirements come first (`write-prd`)
- Recording one decision in a project that already has an architecture: use `documentation-and-adrs`
- Setting quality thresholds (coverage, lint, performance budgets) with no architecture work: use `constraint-driven-development`
- Designing endpoints, payloads or module interfaces in detail: use `api-and-interface-design`
- Writing test scenarios (`test-plan`) or tasks (`planning-and-task-breakdown`)

## Terms

PRD terms (FR, BAC, Shared Contract, Non-Negotiable NFR, NFR, Boundary) are used exactly as defined in `write-prd`'s glossary. This skill adds:

| Term | Meaning |
|---|---|
| **ADR** | Architecture decision record: one decision, its context (citing PRD IDs), the alternatives considered and the consequences. Written by the architect as `Proposed`; accepted by a human at design review. |
| **Constraint** | A coding-level rule in `CONSTRAINTS.md` that a reviewer could check in a diff. |
| **Non-negotiable** | A constraint carried from a Non-Negotiable NFR or a binding decision. It can't be lowered without the approver. |
| **Precedence** | The order in which conflicting sources are resolved (Step 6). |
| **Routed question** | A PRD open question or dependency whose answer is a technical decision, for example one owned "with the architect" or asking *how* systems connect. |

## The Process

### Step 1: Check the PRD's status

Read `docs/PRD.md` and its **Status** before anything else. The status decides what you may produce:

| PRD status | What this skill does | Highest `ARCHITECTURE.md` status |
|---|---|---|
| `Approved` | Full run | `Ready for design review` |
| `Ready for approval` or `In Review` | Draft only. Every blocking PRD open question goes into Risks (section 13). | `Draft` |
| `Draft`, missing, or no status | **Refuse.** Write no architecture, ADRs or constraints. Tell the human the PRD must reach review first, and route them to the BA (`write-prd`). | — |

An architecture built on unsettled requirements can still be useful as a draft, because it shows early which open questions are expensive. It can't go to design review, because its foundation can still move.

If `docs/ARCHITECTURE.md` already exists, you are in **update mode**: keep ADR numbers, never edit an `Accepted` ADR (write a new one that supersedes it and mark the old one `Superseded`), and re-run the traceability in Step 2 against the current PRD.

### Step 2: Extract the contract

Before choosing anything, list from the PRD everything the architecture must answer for. This list becomes the Traceability table (section 12) and drives the checklist:

- every **Entity** in the Shared Contract
- every **Non-Negotiable NFR**
- every **NFR** in section 9
- every **edge case** that needs a mechanism, not just a screen (an external system that can't be reached, a scheduled action that must happen on a given day, an account that is disabled)
- every **Dependency**, and whether it blocks
- every **routed question**
- every **blocking open question**, and the IDs it names

### Step 3: Interview on technology, standards and compliance

Use `interview-me` for the human's input on: hosting and existing platforms, the organisation's preferred or mandated stacks, identity provider, compliance obligations beyond the PRD, team skills, and budget. Detect before you ask. An existing repo, CI config or company standard answers some of these.

If nobody is available, don't stall and don't pretend. Propose a choice for each open decision, write its ADR as `Proposed`, and list it in Open Questions (section 15) as "confirm at design review", owned by whoever decides. A proposed stack that reads as agreed is the architecture's version of an invented requirement.

### Step 4: Draft ARCHITECTURE.md

Copy [templates/architecture.md](templates/architecture.md) to `docs/ARCHITECTURE.md` and fill it in this order:

1. **Constraints & Non-Negotiables (section 2)** first. Everything after this must respect them.
2. **Data Model (section 5).** Every Shared Contract entity appears. Mark what this system owns and what it mirrors read-only from an external source.
3. **Integration Points (section 6).** For each external system: direction, mechanism and schedule, authentication, and what happens when it fails. The failure behaviour must match the PRD's edge cases. For an inbound integration, say what happens to this system's records when the source deletes or merges a record. On every integration, any rule that infers removal, deletion, disablement or loss of status from a record's *absence* in a read must name its guard against a partial, empty or failed read. For example, apply it only after a complete, successful read, or hold and alert when a run would change more records than a set threshold. A read that returned nothing looks exactly like a source where everything was removed.
4. **Technology Stack (section 3) and Components (section 4).** Each component names the FR and NFR IDs it serves. A component that serves nothing is scope creep.
5. **Deployment Topology (section 7)**, covering dev, staging and production.
6. **Observability (section 8)**, mapped to the availability NFR. Say how a scheduled job that fails or never runs is detected, and how a failed outbound message (such as an email) is detected and reported. These failures are silent by default.
7. **Security & Compliance Baseline (section 9).** Map each access rule in the PRD to where it is enforced.
8. **NFR Mapping (section 10), Decisions (section 11), Traceability (section 12), Risks (section 13), Dependencies (section 14), Open Questions (section 15).**

For **Risks**, record each blocking PRD question with what it could change and what the draft currently assumes. Don't design for an answer nobody gave. Where one option is much cheaper to change later, say so, and keep the assumption that is cheapest to reverse.

### Step 5: Write the ADRs

Use the ADR template from `documentation-and-adrs`, stored as `docs/adr/NNNN-kebab-title.md` (4-digit, sequential). Write one ADR for:

- each stack layer whose choice was not forced
- each **routed question**: decide it, or say in the ADR why it can't be decided yet and add it to Open Questions
- each NFR refinement or trade-off (for example, availability measured only in business hours)
- each decision a reasonable engineer could make differently and regret later

Each ADR's Context cites the PRD IDs it serves. Status is `Proposed`. Only a human sets `Accepted`, at design review.

Every platform limit, quota, tier or SKU setting, or SLA that a decision relies on cites its source: the vendor document and the date you checked it. If you can't check it, write `unverified` next to it and add it to Open Questions. Use `source-driven-development` to look it up. A remembered limit reads exactly like a checked one, and platform limits change.

### Step 6: Write CONSTRAINTS.md

Follow `constraint-driven-development` for the file's structure: Floor, Enforced with numbers, Measured, Exceptions. Its interview needs a live human. When none is available, apply its Floor and flag the rest. Then add three things that skill doesn't cover.

**1. Precedence**, at the top of the file:

```markdown
## Precedence

When two sources disagree, the higher one wins. Raise the conflict with the
approver; never resolve it by editing the higher source.

1. PRD Shared Contract (`docs/PRD.md` section 8)
2. This file
3. `docs/ARCHITECTURE.md` and accepted ADRs
4. Standards overlay skills
5. Local convention in the existing code

Changes that lower any bar in this file need the approver's sign-off.
```

**2. Non-negotiables.** One row per Non-Negotiable NFR, and per decision that must hold for the architecture to stay valid. Each row restates the obligation as something a reviewer can check in code, and names its source.

```markdown
## Non-negotiables

| ID | Rule | Source | Checked by |
|----|------|--------|------------|
| N-1 | All outbound email goes through one sender module that refuses any recipient outside the company domain allowlist; no other module sends mail | PRD §8 "Company recipients only" | Planned: lint rule restricting mail-library imports to the sender module |
| N-2 | Every route except sign-in requires an authenticated session from the company identity provider | PRD §8 "Staff only", ADR-0003 | Planned: route test enumerating all routes |
```

**3. Planned rows.** At architecture time there is no code, so most checks can't run yet. A planned check is never written into "Enforced with numbers", because that would read as an enforced bar with no tool behind it. Put it here instead:

```markdown
## Planned (not yet enforced)

Wiring these up is the first task in `docs/PLAN.md`. Each row moves to
"Enforced with numbers" once its command fails on a deliberate violation and
passes a clean control.

| Dimension | Rule | Intended command | Runs at | Reason |
|-----------|------|------------------|---------|--------|
```

Non-negotiable rows whose check isn't wired yet say `Planned:` in their *Checked by* column, as above.

**Coding rule or product rule?** Ask: would a reviewer check this in a diff? "Reminders go out 7 days before the meeting" is product behaviour. It lives in the PRD and is proved by tests, so it stays out of `CONSTRAINTS.md`. "Scheduled jobs are idempotent and safe to re-run" is a coding rule and belongs here. Restating product rules in `CONSTRAINTS.md` creates a second source that drifts from the PRD.

Finally, make sure agents are pointed at the file. Read `AGENTS.md` and `CLAUDE.md` first. If either already contains the line `Read CONSTRAINTS.md before writing code. Do not weaken it to make a change pass.`, skip this step and leave both files untouched. Otherwise add that line to one of them. If you aren't permitted to write either file, don't work around it: report in the handoff that the line is missing.

### Step 7: Send PRD problems back, don't fix them

While designing you will find PRD gaps: an FR that is impossible as written, an entity missing an attribute, two BACs in conflict. **Never edit `docs/PRD.md`.** Add each one to Open Questions (section 15) as a question for the BA, naming the FR, BAC or entity, with the PRD's approver as owner. If its answer could change the architecture, mark it blocking.

### Step 8: Run the checklist and hand off

First, re-read each ADR adversarially. For every input the decision depends on, ask: *what breaks if this input is partial, empty, duplicated or late?* Each answer becomes one of three things: a fix in the ADR, a Risk (section 13) or an Open Question (section 15). Confident decisions hide their failure modes from the person who wrote them. When your environment lets you start a read-only reviewer with fresh context, hand this re-read to it instead (see `doubt-driven-development`).

Then run every item in the checklist below against the written files, not against your memory. Fix what you can and turn the rest into open questions. Then:

1. Set `ARCHITECTURE.md` Status, never higher than Step 1 allows.
2. Fill the Approvals table with the design-review approvers' roles and names. If you don't know who approves, ask.
3. Report: the PRD status you worked from, the checklist result as one line per item ID (A1 to A16), each marked pass or fail with what is missing (never a blanket "all pass"), the list of ADRs, any planned constraint rows, and the open questions that need a human.
4. **Stop.** Never set `Approved` and never set an ADR to `Accepted`. Design review is the human's gate.

## The architecture checklist

Report results by ID.

**Traceability**
- [ ] **A1** Every Shared Contract entity appears in the Data Model, and fields owned by an external source are marked read-only.
- [ ] **A2** Every Non-Negotiable NFR appears in section 2 and is held by an ADR or a `CONSTRAINTS.md` non-negotiable, or both.
- [ ] **A3** Every NFR in PRD section 9 has an approach in section 10. Every refinement or trade-off has an ADR.
- [ ] **A4** Every routed question is decided in an ADR or listed in Open Questions with an owner.
- [ ] **A5** Every blocking PRD open question appears in Risks, naming what it could change.

**PRD integrity**
- [ ] **A6** `docs/PRD.md` is unchanged. Problems found in it are questions for the BA, not edits.
- [ ] **A7** Every component serves at least one existing FR or NFR ID, and no behaviour is added that the PRD doesn't ask for.

**Decisions**
- [ ] **A8** Every stack layer has a choice, a version constraint and a deciding ADR with the alternatives considered.
- [ ] **A9** Every ADR has Status `Proposed` (or `Accepted`/`Superseded` set by a human), a Context citing PRD IDs, alternatives and consequences.
- [ ] **A10** Every integration states direction, mechanism and schedule, authentication, and failure behaviour consistent with the PRD's edge cases. Every inbound integration states what happens to this system's records when the source deletes or merges a record, or raises that as an open question. On every integration, any rule that infers removal, deletion, disablement or loss of status from a record's absence names its guard against a partial, empty or failed read, or raises the missing guard as a blocking open question.
- [ ] **A11** Deployment covers dev, staging and production. Observability maps to the availability NFR and says how failed scheduled jobs and failed outbound messages are detected.
- [ ] **A12** The security baseline maps every access rule in the PRD to where it is enforced, and covers data classification, secrets and audit.
- [ ] **A16** Every platform limit, quota, tier or SKU setting, or SLA stated in `ARCHITECTURE.md` or an ADR cites its source (document and date checked), or is marked `unverified` and listed in Open Questions.

**Constraints**
- [ ] **A13** `CONSTRAINTS.md` has the Precedence block, every non-negotiable names its source, and every check not yet wired is marked `Planned` rather than listed as enforced.
- [ ] **A14** `CONSTRAINTS.md` contains no product rules, and `ARCHITECTURE.md` contains no coding rules.

**Readiness**
- [ ] **A15** No bracketed placeholder text remains. Status doesn't exceed what the PRD's status allows. Nothing was approved or accepted by the agent, and every unconfirmed technology choice is listed in Open Questions.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The FR is obviously wrong, I'll just correct it." | The PRD was approved by people who aren't here. Fixing it in place removes their decision without telling them. Ask the BA. |
| "The PRD is basically approved, so I'll mark this ready for design review." | A blocking question can still change an FR or the Shared Contract. The status ceiling exists so nobody reviews a design whose ground can still move. |
| "I'll answer the blocking product question myself so I can finish the design." | Product decisions belong to the PRD's approvers. Record your assumption in Risks and keep the cheapest-to-reverse option. |
| "Nobody is around, so I'll pick the stack and mark the ADRs Accepted." | `Proposed` plus an open question costs nothing. A false `Accepted` skips the design review. |
| "This choice is obvious, it doesn't need an ADR." | Obvious to whom? The ADR takes five minutes, and the next engineer stops relitigating the decision. |
| "I'll list the checks as enforced; tooling comes in the first sprint." | A rule with no command behind it is an aspiration. Mark it `Planned` and make wiring it the first task. |
| "Putting the reminder rules in CONSTRAINTS.md means developers will see them." | Then there are two sources, and they drift. Product rules stay in the PRD and are proved by tests. |
| "Observability can wait until we deploy." | A scheduled job that never runs produces no error. If nobody designed how it is detected, nobody will notice. |
| "The sync always returns the full list, so a missing record means it was removed." | Until the day the source times out, pages wrongly or returns an empty set. Then every record looks removed at once. Guard the inference. |
| "I know that platform limit." | You remember a limit; the vendor may have changed it. Cite the document or mark it `unverified`. |

## Red Flags

- `docs/PRD.md` modified by the architecture work
- Architecture written against a `Draft` or missing PRD
- `ARCHITECTURE.md` at `Ready for design review` while the PRD isn't `Approved`
- An ADR marked `Accepted`, or an approval date filled in, by the agent
- A Shared Contract entity or Non-Negotiable NFR missing from the traceability table
- A routed question silently decided without an ADR, or silently skipped
- A blocking PRD question answered by assumption with no Risks entry
- `CONSTRAINTS.md` rows with a number but no command, not marked `Planned`
- Business rules, notification schedules or other product behaviour restated in `CONSTRAINTS.md`
- Components with no FR or NFR ID, or features the PRD never asked for
- No answer to "how would we know if the nightly job didn't run?"
- A sync that disables, deletes or de-lists records because they are missing from a read, with no guard against a partial or empty read
- A platform limit or quota in an ADR with no source and no `unverified` mark

## Verification

Before handing off for design review, confirm:

- [ ] Step 1's status gate was applied, and the PRD status you worked from is recorded in the header
- [ ] `docs/ARCHITECTURE.md` follows [templates/architecture.md](templates/architecture.md)
- [ ] Every ADR is in `docs/adr/NNNN-title.md` and linked from section 11
- [ ] `CONSTRAINTS.md` exists, with Precedence, Non-negotiables and any Planned rows
- [ ] `git diff docs/PRD.md` is empty
- [ ] Each ADR was re-read for partial, empty, duplicated and late inputs
- [ ] Every checklist item A1–A16 passes against the files, and the result is reported by ID
- [ ] Status is no higher than the PRD allows, and no ADR is `Accepted` unless a human set it

## See Also

- `write-prd`: the PRD this skill reads, and where PRD questions go back to
- `interview-me`: the technical interview in Step 3
- `documentation-and-adrs`: the ADR template and lifecycle
- `constraint-driven-development`: the base structure of `CONSTRAINTS.md`
- `api-and-interface-design`: detailed interface design once components are fixed
- `security-and-hardening`, `performance-optimization`, `observability-and-instrumentation`: depth for sections 8–10
