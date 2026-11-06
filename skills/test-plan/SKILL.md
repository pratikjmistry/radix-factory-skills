---
name: test-plan
description: Derives Verification Criteria from a product requirements document's business acceptance criteria and writes docs/TEST-PLAN.md, with a coverage matrix and Gherkin scenarios in tests/features/*.feature tagged with FR, BAC and VC IDs, so every acceptance criterion and every CONSTRAINTS.md non-negotiable is traced to a check. Use when a PRD is approved or in review and a test planner must define what proves it; when deriving Given/When/Then scenarios or feature files from requirements; or when finding which acceptance criteria have no test scenario yet.
---

# Test Plan

## Overview

The PRD says what the product must do, and its Business Acceptance Criteria (BACs) say how the business will know. The test plan turns each BAC into Verification Criteria (VCs): technical checks a machine or a named person can run. It also writes Given/When/Then scenarios that automation will later execute. Developers build against these scenarios, and the verifier reports against them. So a BAC with no VC is a requirement nobody will prove, and a VC with no source is a requirement nobody asked for.

This skill produces two things:

- `docs/TEST-PLAN.md` from [templates/test-plan.md](templates/test-plan.md): strategy, VCs, a coverage matrix, quality gates and open questions
- `tests/features/*.feature`, one file per capability, following [templates/capability.feature](templates/capability.feature)

It reads three sources and edits none of them. When two sources disagree, the higher one wins:

1. PRD Shared Contract and BACs (`docs/PRD.md`)
2. `CONSTRAINTS.md`
3. `docs/ARCHITECTURE.md` and its ADRs (`docs/adr/`)

The architecture decides *how* a VC is tested: its level and its test doubles. It never decides *what* must be true. A behaviour that appears only in the architecture is not a requirement.

## When to Use

- A PRD is `Approved` and needs a test plan and scenarios before development starts
- A PRD is `In Review` and the team wants an early draft, with the BACs that blocking questions could change marked as blocked
- The architecture has reached design review, and the non-functional and integration VCs that waited for it must be completed (second pass)
- The PRD or `CONSTRAINTS.md` changed and the test plan must be re-traced (update mode)
- Someone asks which acceptance criteria have no scenario

**When NOT to use:**

- The PRD is `Draft` or missing: requirements come first (`write-prd`)
- Writing or fixing BACs: that's the PRD author's job (`write-prd`). This skill routes problems back; it doesn't fix them.
- Writing the test code for one function or bug: `test-driven-development`
- Choosing the stack or test tooling: `solution-architecture`
- Setting coverage or lint thresholds: `constraint-driven-development`

## Terms

PRD terms (FR, BAC, VC, Shared Contract, Non-Negotiable NFR, NFR) are used exactly as defined in `write-prd`'s glossary. `N-x` is a non-negotiable row in `CONSTRAINTS.md` (`solution-architecture`). This skill adds:

| Term | Meaning |
|---|---|
| **VC-n** | A Verification Criterion. IDs are global and sequential, never renumbered or reused. A dropped VC is marked `Withdrawn` with a reason. |
| **Proves** | The BAC, NFR, Non-Negotiable NFR or `N-x` a VC checks. Every VC proves at least one. |
| **Level** | `unit`, `integration`, `e2e` or `non-functional` |
| **Integration VC** | Any VC, at any Level including `unit` and `e2e`, whose pass depends on an external system or dependency the PRD names (CRM or other source-of-record sync, directory, email delivery, etc.). It is defined by that dependency, not by its Level: levelling it `e2e` or `unit` does not exempt it from `Pending architecture`. A VC whose Level is `integration` is also an integration VC, and is never `Covered` without an architecture. Who is signed in, and their role, is scenario context, set by a Given step using a signed-in-user stub, not an external dependency: a VC about what a signed-in user may see or do is functional and may be `Covered` without an architecture. Only a VC about the sign-in mechanism itself (the sign-in provider unavailable, a session expiring, an account disabled in the directory) is an integration VC. |
| **Method** | How a VC is checked. `Scenario`: one or more Gherkin scenarios. `Tool check`: a lint rule, architecture test, load test or similar named in `CONSTRAINTS.md` or the architecture. `Manual`: a named person checks it, with a reason why it can't be automated. |
| **Capability** | The unit of one feature file: a PRD user flow, a cross-cutting Non-Negotiable NFR (such as access control), or a group of FRs that no flow uses |
| **State** | Where a VC or a BAC stands, used in both the VC table and the coverage matrix. One of: `Covered` (a scenario proves it, and nothing else counts as Covered), `Tool check` (its Method is `Tool check` and the tool is named), `Manual`, `Non-functional`, `Blocked (…)` with the reason in brackets (`PRD OQ n` or `untestable`), `Pending architecture` or `Withdrawn`. A BAC is `untestable` only when it has no observable outcome, or a pass/fail condition it needs is missing or subjective ("quickly", "clearly", "user-friendly"). A BAC whose conditions and outcome are stated is testable. Before marking a BAC or NFR untestable, resolve its references: a term it points elsewhere for (the FRs or BACs it lists, the glossary, the Shared Contract) is defined there. |
| **Routed question** | A question this skill can't answer and must send to its owner. The rule is the same as in `write-prd`'s Step 2.8. The IDs it blocks go in the Open Questions table's own **Blocks** column, not in the question text. |

## The Process

### Step 1: Check the statuses

Read the **Status** of `docs/PRD.md` and of `docs/ARCHITECTURE.md` before anything else. Together they decide what you may produce:

| Input state | What this skill does | Highest `TEST-PLAN.md` status |
|---|---|---|
| PRD `Draft`, missing, or no status | **Refuse.** Write no test plan and no feature files. Tell the human the PRD must reach review first, and route them to the BA (`write-prd`). | — |
| PRD `In Review` or `Ready for approval` | Draft only. A BAC is `Blocked (PRD OQ n)` when a blocking open question names it, or names the FR it links to. Cite the specific question. A Blocked BAC gets a VC row but no executable scenario. A Shared Contract item named by a blocking question blocks its VC the same way. | `Draft` |
| `ARCHITECTURE.md` missing or below `Ready for design review` (PRD `In Review` or later) | Write the functional VCs and scenarios. Mark levels and doubles `provisional`. List NFR VCs as `Pending architecture`. An integration VC (any VC whose pass depends on an external system the PRD names, whatever Level you give it) may have its scenario drafted, but its State is `Pending architecture`, never `Covered`, until the architecture names its double. A VC whose Level is `integration` is an integration VC. Who is signed in and their role are set by a Given step using a signed-in-user stub, so a VC about what a signed-in user may see or do is functional and may be `Covered`; only a VC about the sign-in mechanism itself (provider unavailable, session expiry, account disabled in the directory) is an integration VC. Functional VCs that cross no external system proceed as normal. Complete the pending VCs in a second pass after design review. | `Draft` |
| A BAC is untestable (PRD `In Review` or later): it has no observable outcome, or a pass/fail condition it needs is missing or subjective ("quickly", "clearly", "user-friendly") | That BAC is `Blocked (untestable)`, with a blocking routed question to the PRD's approver (via the BA) that names it. Don't invent the missing number. Every other BAC proceeds. A BAC whose conditions and outcome are stated is testable: write its VCs from its literal text. An edge case the BAC doesn't mention, or a possible interaction with another BAC or FR, is not a reason to block it. Raise it as a routed question, blocking only if the answer would contradict the BAC's stated text. Before marking a BAC or NFR untestable, resolve its references. A term it points elsewhere for (the FRs or BACs it lists, the glossary, the Shared Contract) is defined there: write the VC from the referenced text, one VC per referenced FR where the values differ. If the wording could be clearer but the reference resolves, raise a non-blocking routed question instead of blocking. | `Draft` |
| PRD `Approved`, architecture at `Ready for design review` or later, nothing blocked | Full run | `Ready for review` |

When several rows apply, apply every treatment, and the lowest ceiling wins.

A test plan built on unsettled requirements is still useful, because unblocked BACs get their scenarios early. It can't go to review, because the ground under the blocked ones can still move.

If `docs/TEST-PLAN.md` already exists, you are in **update mode**:
- Keep every VC ID.
- Mark the VCs of withdrawn BACs `Withdrawn`.
- Give new BACs the next free VC number.
- Unblock BACs whose questions were resolved.
- Re-run Steps 2 to 8 against the current sources.

### Step 2: Extract what must be proved

List, from the files:

- from the PRD: every BAC with its FR, every NFR (section 9), every Non-Negotiable NFR, every edge case (section 10), every user flow, and every blocking open question with the IDs it names
- from `CONSTRAINTS.md`: the precedence block and every non-negotiable `N-x` with its *Checked by* column
- from the architecture and ADRs: components, integrations and the testing approach (tools, environments, how external systems are replaced in tests)

This list is the coverage matrix's row set. Nothing may leave it without a stated reason.

### Step 3: Derive Verification Criteria

- **Every BAC** gets at least one VC. Copy its numbers and examples. If a BAC says "a trial started on 2026-03-01 ends on 2026-03-31", the VC says that too. A BAC with several outcomes may need several VCs.
- **Every NFR** gets at least one VC with the PRD's measurable target.
  - An ADR may tighten or decompose that target, for example meeting "within 24 hours" with a 6-hourly sync plus an alert. Then the VC uses the tighter value.
  - An ADR may never loosen a target. A looser architecture value is a precedence conflict: the VC keeps the PRD's value, and the conflict becomes a routed question to the architect (Step 7).
- **Every Non-Negotiable NFR and every `N-x`** gets at least one VC. An `N-x` VC references the constraint's *Checked by* instead of restating the rule. It still states its own observable pass/fail condition, for example: "VC-40 (N-2): a request to any route without a signed-in session is refused, and no record data is returned."
- **Every edge case** is covered by a scenario or a VC.
- **Manual and non-functional VCs** state why they can't be a scenario, and who checks them, and when.

A VC states a condition that passes or fails. "Search works well" is not a VC. "With 10,000 products, 95% of searches return within 1 second" is.

### Step 4: Choose levels and test doubles from the architecture

For each VC, pick the lowest level that can prove it. Pick unit when the rule is pure logic. Pick integration when it crosses a component or an external system. Pick e2e only for a whole user flow or an access rule that must hold on every route. A VC whose Level is `integration` is an integration VC and is never `Covered` without an architecture, so level an access or role rule `e2e` or `unit`, not `integration`.

For each integration, use the double the architecture names: a fake source system, a captured mail outbox or a fixed clock. No VC may need a live external system to pass. When the architecture is missing or below `Ready for design review`, mark the level and doubles `provisional`. Decide whether a VC is an integration VC by what its pass depends on, before choosing its Level: if it needs the CRM, the directory, email delivery or another external system the PRD names, it is one, and choosing `e2e` or `unit` doesn't change that. Who is signed in and their role are not such a dependency: a Given step sets them using a signed-in-user stub, so a VC about what a signed-in user may see or do is functional and may be `Covered`. Only a VC about the sign-in mechanism itself (provider unavailable, session expiry, account disabled in the directory) is an integration VC. An integration VC may still have its scenario drafted, but its State is `Pending architecture`, never `Covered`, until the architecture names its double. Functional VCs that cross no external system proceed as normal.

The architecture chooses *how*, never *what*. If it describes behaviour the PRD and `CONSTRAINTS.md` don't require, don't write a VC for it. If it seems to need one, ask the architect.

### Step 5: Write the feature files

One file per capability in `tests/features/`. A capability is one of:
- a PRD user flow, for example `f2-place-an-order.feature`
- a cross-cutting Non-Negotiable NFR, for example `access-control.feature`
- a group of FRs that no flow uses, named after the group

Every FR that isn't withdrawn or blocked appears in the tags of at least one file.

Follow [templates/capability.feature](templates/capability.feature):

- **Tags.** The tags are the traceability, so they must match the coverage matrix:
  - Every scenario carries `@VC-n` for each VC it proves.
  - It also carries one proof tag for each thing it proves:
    - a BAC: `@BAC-n` and that BAC's `@FR-n`
    - a Non-Negotiable NFR: `@NN-<short-name>`, for example `@NN-no-outside-email`
    - a `CONSTRAINTS.md` row: `@N-x`, for example `@N-2`
    - a PRD §9 NFR: `@NFR-<short-name>`, kebab-case from the NFR's name, for example `@NFR-email-timing`
    - a PRD §10 edge case: `@EDGE-n`, its number in §10, for example `@EDGE-2`
  - A scenario that proves several of these carries all their tags. Never add a BAC tag a scenario doesn't prove just to have one.
- **Domain language only.** Steps use the PRD's words for actors, entities and states. They contain no UI selectors, URLs, endpoints, HTTP verbs, table or class names, or framework names. "Given the member has booked a table for 2026-12-10 at 19:00", not "Given a POST to /api/bookings".
- **Concrete values.** Use the BAC's example dates, numbers and states. Use `Scenario Outline` with `Examples` when one BAC has several cases (for example, one row per membership level).
- **Deterministic.** A `Background` fixes the date, time and time zone when time matters. Never write a bare "today". Scenarios don't depend on each other's data.
- **One behaviour per scenario.** If the `Then` needs "and" for unrelated outcomes, split it.

### Step 6: Write TEST-PLAN.md

Copy [templates/test-plan.md](templates/test-plan.md) to `docs/TEST-PLAN.md` and fill it in. The **coverage matrix** has one row per BAC: its FR, its VCs, its scenarios (feature file and scenario name), and its state. The VC table uses the same states (see Terms). A second table covers the Non-Negotiable NFRs, the `N-x` rows, the NFRs and the edge cases.

**Quality Gates** reference `CONSTRAINTS.md` by row ID rather than restating its numbers, so the two can't drift.

### Step 7: Route problems back, don't fix them

**Never edit `docs/PRD.md`, `docs/ARCHITECTURE.md`, an ADR or `CONSTRAINTS.md`.** Each problem becomes its own row in the test plan's Open Questions, under the same rule `write-prd` uses:

- **Owner:** whoever can answer. For product questions (an untestable BAC, two BACs in conflict, a missing edge case), that's the PRD's approver, "(via the BA)". For technical questions (a looser NFR in an ADR, a source conflict, no test double for an integration), it's "<decider>, with the architect".
- **Blocking:** only if the answer could change a VC or a scenario. A blocking question lists the IDs it blocks in the **Blocks** column, as IDs only (`BAC-12, VC-30`).
- A note in another column doesn't count. Downstream roles look for questions in Open Questions.

### Step 8: Run the checklist and hand off

Run every item below against the written files, not against your memory. Fix what you can and route the rest. Then:

1. Set Status, never higher than Step 1 allows.
2. Fill the Approvals table with the reviewers' roles and names. If you don't know who reviews, ask. If nobody can answer:
   - If the PRD states its approver or delivery-lead roles, take the reviewers' roles from there.
   - Otherwise, add a non-blocking Open Questions row, "Who reviews the test plan?", owned by the PRD's approver (via the BA). Leave the Approvals table with a single row reading "To be named (see Open Questions #n)", where n is that row's number. Leave no bracketed placeholder.
3. Report:
   - the PRD and architecture statuses you worked from
   - the counts of BACs, VCs (by method) and scenarios
   - the checklist result: exactly one line per item, T1 to T15 in order, each in one of two forms. Never a blanket "all pass", and never two items on one line.
     ```
     T<n>: pass — <evidence>
     T<n>: fail — <what is missing>
     ```
   - every Blocked item, and the routed questions
4. **Stop.** Never set `Approved`. The test plan's review is the human's gate.

## The test-plan checklist

Report results by ID.

**Traceability**
- [ ] **T1** Every BAC that isn't withdrawn has at least one VC.
- [ ] **T2** Every VC proves at least one existing BAC, NFR, Non-Negotiable NFR or `N-x`. No VC has an invented source.
- [ ] **T3** Every VC has at least one scenario, or its Method is `Manual` or `Tool check` with a stated reason. A `Tool check` VC names its tool and has State `Tool check`, not `Covered`: only a scenario makes a VC `Covered`.
- [ ] **T4** Every Non-Negotiable NFR and every `CONSTRAINTS.md` non-negotiable has at least one VC with an observable pass/fail condition.
- [ ] **T5** Every NFR has a VC carrying the PRD's measurable target, or an ADR's tighter or decomposed version of it. No VC uses an architecture value looser than the PRD. Such a conflict is resolved by precedence (the PRD wins) and raised as a routed question to the architect.
- [ ] **T6** Every PRD edge case is covered by a scenario or a VC.
- [ ] **T7** The coverage matrix agrees with the feature files. Every tagged ID exists, and every scenario the matrix names exists.

**Source discipline**
- [ ] **T8** `docs/PRD.md`, `docs/ARCHITECTURE.md`, the ADRs and `CONSTRAINTS.md` are unchanged.
- [ ] **T9** No VC adds a behaviour, number or rule absent from the PRD and `CONSTRAINTS.md`. Every source conflict is resolved by precedence and raised as a question.
- [ ] **T10** Every VC's level and doubles trace to an architecture component or integration, or are marked `provisional`.

**Scenarios**
- [ ] **T11** There is one feature file per capability: a user flow, a cross-cutting Non-Negotiable NFR, or an FR group no flow uses. Every scenario carries a VC tag and a proof tag for each thing it proves: `@BAC-n` with its `@FR-n`, `@NN-<short-name>`, `@N-x`, `@NFR-<short-name>` or `@EDGE-n`. No scenario carries a BAC tag it doesn't prove. Every FR that isn't withdrawn or blocked appears in at least one file's tags.
- [ ] **T12** No step contains implementation detail (selectors, URLs, endpoints, table or class names, technology names). Steps use the PRD's vocabulary and the BACs' example values.
- [ ] **T13** Scenarios are deterministic: explicit dates, times and time zones, a fixed clock where time matters, no bare "today", and no dependence on another scenario.

**Readiness**
- [ ] **T14** Every Blocked BAC or VC cites its specific open question. Every routed question has an owner and a blocking flag, and every blocking one lists the IDs it blocks in the Blocks column.
- [ ] **T15** No bracketed placeholder text remains. Status doesn't exceed Step 1's ceiling, and nothing was approved by the agent.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The BAC says 'quickly', so I'll use 2 seconds." | An invented threshold reads like an agreed one, and the build will be judged against it. Block the BAC and ask the PRD's approver. |
| "This BAC doesn't cover every edge, so it's untestable." | Untestable means no observable outcome or a missing or subjective pass/fail condition. Test what the BAC states, and route the edge case as a question. |
| "The architecture says the import also archives stale records, so I'll test that." | If the PRD and `CONSTRAINTS.md` don't require it, it's a design detail, not a requirement. Ask the architect whether it should be. |
| "The ADR allows 48 hours and the PRD says 24. The ADR is newer, so it wins." | The PRD is higher in precedence. Test 24 hours and raise the conflict. |
| "One feature file per BAC is the most traceable." | Tags carry the traceability. Files per capability keep a flow readable as a whole. |
| "I'll describe the steps with the real endpoints so automation is easier." | Steps written against today's endpoints break when the code changes. Steps in domain language survive any rewrite. |
| "The open question will probably be answered the obvious way, so I'll write the scenario." | Then the scenario encodes a product decision nobody made. Mark the BAC Blocked and cite the question. |
| "This constraint is a lint rule, it doesn't need a VC." | Without a VC, nobody checks that the lint rule exists and fails on a violation. Reference its *Checked by* and state the pass/fail condition. |
| "The matrix says Covered; I'm sure the scenario is there." | Check the tags in the files. The matrix is what reviewers trust. |

## Red Flags

- `docs/PRD.md`, `docs/ARCHITECTURE.md`, an ADR or `CONSTRAINTS.md` modified by test planning
- A test plan written against a `Draft` or missing PRD
- `Ready for review` while the PRD isn't `Approved` or the architecture isn't at design review
- A BAC with no VC, or a VC with no source
- A number in a VC that appears in no BAC, NFR or ADR
- Steps containing `click`, CSS selectors, URLs, `POST`, `GET`, table or class names
- A bare "today" or "now" in a scenario with no fixed clock
- A Blocked BAC that cites no specific open question
- `Blocked (untestable)` on an item whose missing value is stated in an FR or BAC it references
- A `CONSTRAINTS.md` non-negotiable with no VC
- A "Covered" matrix row whose scenario tag isn't found in any feature file
- An integration-dependent VC levelled `e2e` or `unit` and marked `Covered` without an architecture
- A `Tool check` VC marked `Covered`, or a Non-Negotiable scenario carrying a BAC tag it doesn't prove

## Verification

Before handing off for review, confirm:

- [ ] Step 1's status gate was applied, and the statuses you worked from are recorded in the header
- [ ] `docs/TEST-PLAN.md` follows [templates/test-plan.md](templates/test-plan.md)
- [ ] Every feature file is in `tests/features/` and is listed in the plan's feature index
- [ ] `git diff docs/PRD.md docs/ARCHITECTURE.md docs/adr CONSTRAINTS.md` is empty
- [ ] Searching the feature files for `@BAC-` finds every BAC the matrix marks `Covered`
- [ ] Every checklist item T1–T15 passes against the files, and the result is reported as exactly one line per item, T1 to T15 in order, as `T<n>: pass — <evidence>` or `T<n>: fail — <what is missing>`
- [ ] Status is no higher than Step 1 allows, and nothing is marked `Approved` by the agent

## See Also

- `write-prd`: the BACs this skill proves, and where product questions go back
- `solution-architecture`: test levels, integrations and doubles, and where technical questions go back
- `constraint-driven-development`: the `CONSTRAINTS.md` rows that VCs reference
- `test-driven-development`: writing the code that makes each scenario pass
- `browser-testing-with-devtools`: checking e2e scenarios in a real browser
