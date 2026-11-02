---
name: write-prd
description: Writes a product requirements document to docs/PRD.md from a fixed template, with traceable requirement and acceptance-criterion IDs, scope-level Always / Ask First / Never boundaries, and a "clear to the dot" checklist the document must pass before it goes to a human for approval. Use when writing up stakeholder interview answers or workshop notes as requirements, when a business analyst must declare the requirements done and ready for sign-off, or when an existing requirements document must be updated or checked for vague acceptance criteria before architecture and test planning start.
---

# Write PRD

## Overview

A PRD is the contract every later role builds from. Architecture picks a stack to satisfy it, the test plan derives checks from it, and developers implement it. Each of those readers works from the file alone, without the conversation that produced it. Any vagueness left in the PRD becomes a guess downstream, and that guess gets made several times, by different readers, in different ways.

This skill turns elicited requirements into `docs/PRD.md` using [templates/prd.md](templates/prd.md). It doesn't count the PRD as done when every section is filled in. It counts it as done when the PRD passes the clarity checklist below, so a reader with no access to the conversation can build and test from it without coming back to ask.

## When to Use

- Requirements have been elicited (by interview, workshop notes or an idea brief) and need to become a PRD
- A business analyst or product role is about to declare the requirements complete
- An existing `docs/PRD.md` needs a change, or needs checking for ambiguity before design starts
- Someone downstream (architecture, test planning, development) reports that a requirement is unclear, and the PRD has to be fixed at the source

**When NOT to use:**

- The idea itself is still fuzzy: refine it with `idea-refine` first
- You don't yet know who the user is, why they want it, or what success looks like: use `interview-me` first, then come back
- Choosing technology, data stores or deployment: that's architecture work (`solution-architecture`), and the PRD stays technology-free
- Writing test scenarios or Verification Criteria: that's test planning (`test-plan`)
- Breaking work into tasks: use `planning-and-task-breakdown`

## Glossary

The template uses these terms. Use them exactly as defined, because downstream roles rely on the IDs and the distinctions.

| Term | Meaning |
|---|---|
| **Functional Requirement (FR-n)** | One behaviour the product must have, stated from the user's point of view, with a priority (Must / Should / Could). One requirement per row. |
| **Business Acceptance Criterion (BAC-n)** | An observable, testable condition, linked to exactly one FR, that tells the business the FR is met. Written in the PRD by the PRD author. Every FR has at least one. |
| **Verification Criterion (VC-n)** | A technical check (unit, integration or end-to-end) that proves a BAC. Derived from BACs by the test planner in the test plan, **not** written in the PRD. A BAC is only good enough when a test planner can derive VCs from it without asking the PRD author anything. |
| **Shared Contract** | The part of the PRD that every downstream artifact must honour without renegotiation: the **Entities** (the nouns the product stores or exchanges) and the **Non-Negotiable NFRs**. Architecture, test plan and constraints all trace back to it. |
| **Non-Negotiable NFR** | A quality requirement that can't be traded away in design, such as a legal, contractual or safety obligation. It lives in the Shared Contract. |
| **NFR (section 9)** | A quality target that architecture may refine or trade off, provided it records the trade-off in a decision record. |
| **Boundary** | A product-level rule for everyone building from the PRD, in three tiers: Always / Ask first / Never. |

## The Process

### Step 1: Load what already exists

Read any refined idea, interview notes or briefs you were given. If `docs/PRD.md` already exists, you're in **update mode**:

- Keep every existing FR and BAC ID. Never renumber, because the test plan and tasks already point at them.
- To drop a requirement, mark the row `Withdrawn` with a one-line reason. Don't delete it.
- New requirements get the next free number.
- If the PRD was `Approved`, any change to an FR, BAC or the Shared Contract sends it back to `In Review` and needs a new approval.

### Step 2: Draft section by section, in this order

Copy [templates/prd.md](templates/prd.md) to `docs/PRD.md` and fill it in this order. Each section constrains the next:

1. **Problem Statement, Objectives, Scope, Personas.** Every objective has a success signal someone could observe. Out of Scope lists things a reasonable reader might otherwise assume are in scope.
2. **User Flows**, one per persona goal.
3. **Functional Requirements**: one behaviour per row, no "and", no technology names.
4. **Business Acceptance Criteria**: at least one per FR, each linked by ID (see *Writing a testable BAC*).
5. **Shared Contract**: list every entity named in a flow or FR. Only obligations go under Non-Negotiable NFRs.
6. **NFRs, Edge Cases & Failure Scenarios, Dependencies.** Each edge case says what the product does, not just what could go wrong.
7. **Boundaries** (section 13, see below).
8. **Open Questions**: every unknown, with an owner, marked as blocking or not. A question is blocking only if its answer could change an FR, a BAC or the Shared Contract, including adding or removing an FR. A blocking question names the item it could change: an existing ID ("Blocks: BAC-4, Shared Contract → Entities") or the proposed FR ("Blocks: new FR — staff cancels on a patient's behalf"). Otherwise record it as non-blocking with an owner. The owner is whoever can answer the question; name any go-between in brackets, e.g. "Client legal team (via the client stakeholder)".

When you can't fill a field from what you know, don't invent an answer. Ask the human (use the `interview-me` skill for anything that needs more than one question), or record it as an open question. A plausible answer that nobody gave you is worse than a visible gap. It reads as settled, and nobody re-examines it.

### Step 3: Write the boundaries

Boundaries tell downstream builders what they may decide alone and what needs the human. They are about the **product and its scope**. Coding rules (test before commit, dependency approval and so on) belong in the project's constraints file, not here.

| Tier | Meaning | Examples |
|---|---|---|
| **Always** | Do this without asking | Trace every change to an FR ID; meet every Non-Negotiable NFR; follow the flows as written |
| **Ask first** | Stop and get the approver's decision | Anything that adds, removes or reprioritises an FR; a new persona; a new external integration; changing an Out of Scope item |
| **Never** | Not permitted under any circumstances | Collect or store data not listed under Entities; ship behaviour not traced to an FR; weaken a Non-Negotiable NFR |

Start from these examples and make them specific to the product. A boundary that would apply to every product ever built adds no information.

### Step 4: Run the clarity checklist

Go through every item in *The "clear to the dot" checklist* against the written file, not against your memory of the conversation. For each failure, either fix it from information you already have or turn it into a question for the human. Repeat until every item passes or the only remaining failures are recorded as blocking open questions.

### Step 5: Hand off for approval

The PRD's Status moves through four values:

| Status | Meaning |
|---|---|
| `Draft` | Being written |
| `In Review` | The checklist is failing, or a blocking question is open |
| `Ready for approval` | The checklist passes and the approvers are named |
| `Approved` | Set only by a human approver, with their date |

When the checklist passes:

1. Fill the **Approvals** table with the approvers' roles and names. For a client engagement, list at least a client stakeholder and a delivery lead from the team building it. An internal project may have a single approver. If you don't know who approves, ask.
2. Set **Status** to `Ready for approval`.
3. Report to the human: the checklist result, the counts of FRs and BACs, and any non-blocking open questions.
4. **Stop.** Never set Status to `Approved` and never fill in an approval date. Approval is the human's act, and it's what the rest of the process trusts. An agent that approves its own PRD has removed the gate it was supposed to pass.

If a blocking open question remains, leave Status at `In Review` and say which question is blocking.

After approval, the architect role starts from `docs/PRD.md`.

## Writing a testable BAC

A BAC names an actor, a trigger and an observable outcome, with a number wherever a quantity is involved. Words like *fast*, *easy*, *user-friendly*, *intuitive*, *secure*, *robust*, *seamless*, *appropriate*, *etc.* and *as needed* are not criteria. They are invitations to argue.

```
VAGUE:     BAC-3 (FR-2): Search is fast and returns relevant results.

TESTABLE:  BAC-3 (FR-2): A signed-in member searching by exact product name
           sees that product as the first result.
           BAC-4 (FR-2): With a 10,000-product catalogue, search results
           appear within 1 second for 95% of queries.
```

If the human can't give you a number, ask what would make them say "that's too slow". The answer is usually the number.

## The "clear to the dot" checklist

The PRD isn't done until every item is true of the file as written. Report results by ID.

**Completeness**
- [ ] **C1** Every template section is filled in or explicitly marked "None", with no placeholder text left in brackets.
- [ ] **C2** Every objective has an observable success signal.
- [ ] **C3** Every persona appears in at least one user flow, and every flow is used by at least one FR.

**Requirements**
- [ ] **C4** Every FR states exactly one behaviour, has a priority, and names no technology.
- [ ] **C5** Every FR has at least one BAC, and every BAC links to exactly one existing FR.
- [ ] **C6** Every BAC is objectively verifiable: an observable outcome, numbers where a quantity is involved, none of the vague words listed above. A test planner could derive Verification Criteria from it without asking.
- [ ] **C7** IDs are unique and stable. In update mode no ID was renumbered or reused.

**Shared Contract and quality**
- [ ] **C8** Every entity named in a flow, FR or BAC appears under Entities, and nothing is listed there that no requirement uses.
- [ ] **C9** Every NFR (section 9) and Non-Negotiable NFR has a measurable target or a named obligation (law, contract, standard).
- [ ] **C10** Every edge case states the expected behaviour and relates to an FR or flow.

**Scope and boundaries**
- [ ] **C11** Out of Scope lists at least the items a reader could reasonably assume are in scope.
- [ ] **C12** All three boundary tiers have product-specific entries.

**Readiness**
- [ ] **C13** No open question is marked blocking, and every open question has an owner.
- [ ] **C14** The Approvals table names at least one approver, Status is `Ready for approval`, and no approval date has been filled in by the author.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The team knows what 'fast' means here." | The PRD outlives the conversation. The architect, the test planner and a developer three weeks from now each pick their own number. |
| "I'll leave BACs loose so the test planner has room." | Loose BACs push product decisions onto the test planner, who has no authority to make them. They either guess or come back to ask, and both cost more than asking now. |
| "This requirement is obvious, it doesn't need a BAC." | If it's obvious, the BAC takes one line. If it doesn't fit in one line, it wasn't obvious. |
| "I'll fill the gap with a sensible default and note it later." | An invented answer reads exactly like a real one. Record it as an open question or ask. |
| "The checklist passed in my head." | Run it against the file. The file is what downstream readers get. |
| "Everyone already agreed in the meeting, so I'll mark it Approved." | Approval is recorded by the approver, not by the author. Set `Ready for approval` and stop. |
| "Renumbering makes the IDs tidier after edits." | Every downstream reference breaks silently. Gaps in numbering are cheap. |
| "Naming the database here saves the architect time." | Technology choices belong to architecture, with their trade-offs recorded. Put the need (for example "data survives a server restart") in the PRD instead. |

## Red Flags

- BACs containing *fast*, *easy*, *intuitive*, *secure*, *robust*, *appropriate* or *etc.*
- An FR with no BAC, or a BAC pointing at an FR ID that doesn't exist
- Technology names (frameworks, databases, cloud services) in FRs or BACs
- Bracketed placeholder text left in `docs/PRD.md`
- Status set to `Approved`, or an approval date filled in, by the agent that wrote the PRD
- Open questions with no owner, or blocking questions alongside `Ready for approval`
- Entities mentioned in flows that are missing from the Shared Contract
- Boundaries copied word for word from the examples with nothing product-specific
- Verification Criteria or test scenarios written into the PRD
- Existing IDs renumbered during an update

## Verification

Before handing the PRD to the approver, confirm:

- [ ] `docs/PRD.md` exists and follows the section structure of [templates/prd.md](templates/prd.md)
- [ ] Every checklist item C1–C14 passes against the file, and the result is reported by ID
- [ ] FR and BAC counts are reported, and every FR has at least one BAC
- [ ] A search of the BACs for the vague words listed above finds none
- [ ] Status is `Ready for approval` (or `In Review` with the blocking question named), and no approval date is filled in
- [ ] In update mode, a diff against the previous version shows no renumbered or deleted IDs
