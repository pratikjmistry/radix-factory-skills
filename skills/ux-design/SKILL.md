---
name: ux-design
description: Designs the user experience of a product with a user interface from its PRD and the user-interface technology the architecture chose. Classifies every functional requirement as a screen, email, background job or non-UI, and writes docs/ux/ with a screen inventory, a storyboard per user flow, a design system with tokens and a contrast table, per-screen specs with element tables, and a clickable static HTML/CSS prototype for design review. Use when a PRD is approved or in review and screens, user flows, wireframes or a design system must be designed before UI development; when the architecture names the user-interface technology and a UX designer must turn the requirements into screens; or when a non-functional prototype is needed for a design review.
---

# UX Design

## Overview

The PRD says what users must be able to do. The architecture says what the interface is built with. This skill decides what users see: which requirements need a screen, which states each screen has, what every element is called, and how the screens join up into the PRD's flows. Reviewers judge the design from a clickable prototype. The developer builds from the screen specs, and test automation finds elements by the role and accessible name in the element tables. So an element with no requirement behind it is a feature nobody asked for, and a renamed button breaks every test that looks for it.

This skill writes, under `docs/ux/` only:

| File | Template | Holds |
|---|---|---|
| `UX.md` | [templates/ux.md](templates/ux.md) | Status, sources, FR classification, screen inventory (`SCR-n`), navigation, storyboard per flow, emails and background behaviour, Open Questions |
| `DESIGN-SYSTEM.md` | [templates/design-system.md](templates/design-system.md) | Stack target, tokens (names and roles), contrast table, accessibility baseline, breakpoints, components, patterns, brand |
| `screens/scr-NN-<slug>.md` | [templates/screen.md](templates/screen.md) | One per screen: roles, states, element table, copy, example data |
| `prototype/tokens.css` | [templates/tokens.css](templates/tokens.css) | Every design value. The only file that holds one. |
| `prototype/prototype.css` | — | Layout and component styles, using `var(--…)` only |
| `prototype/scr-NN-<slug>--<state>.html` | [templates/page.html](templates/page.html) | One static page per screen state |
| `prototype/index.html` | [templates/index.html](templates/index.html) | The storyboard: every flow in order, then the screens no flow uses |

It reads these sources and edits none of them. When two disagree, the higher one wins:

1. `docs/PRD.md`
2. `CONSTRAINTS.md`
3. `docs/ARCHITECTURE.md` and its ADRs (`docs/adr/`)

It also reads `docs/ux/brand/`, the human's brand input, and never writes there.

## When to Use

- A PRD is `Approved` or `In Review`, the architecture's Frontend row names a UI stack, and the screens must be designed before development
- A design review needs a clickable prototype of the PRD's flows
- Someone asks which requirements need a screen and which are only an email or a background job
- The PRD changed after `docs/ux/` was written (update mode)

**When NOT to use:**

- The PRD is `Draft` or missing: requirements come first (`write-prd`)
- Choosing the front-end framework or a component library: `solution-architecture`
- Building or fixing real components, such as making a modal trap focus: `frontend-ui-engineering`
- Shaping a rough product idea: `idea-refine`
- Deriving test scenarios: `test-plan`

## Terms

PRD terms (FR, BAC, Shared Contract, NFR) are used as defined in `write-prd`'s glossary. `N-x` and other row IDs are rows in `CONSTRAINTS.md`.

| Term | Meaning |
|---|---|
| **Class** | How an FR reaches users. `Screen`: users see or do something on a page; names its `SCR-n`. `Email`: its only output a user sees is an email; it gets no screen. `Background`: it happens without a user action (a scheduled job, a sync); if its effect shows on a page, that page's FR has the screen. `Non-UI`: no user-facing output of its own (sign-in through an identity provider, retention, audit). An FR with two outputs takes two classes, for example `Screen + Email`. |
| **SCR-n** | A screen: one page or view in the stack's terms. IDs are sequential and never renumbered or reused. A dropped screen is `Withdrawn` with a reason. |
| **State** | One way a screen can look: `default`, `empty`, `confirm`, `done`, `refused`, `permission-denied`, `validation`, `error`, `loading` and so on, named in kebab-case. A state exists because a BAC, an edge case or a pattern needs it. |
| **Element table** | Per screen: each interactive or meaningful element with its role (as the browser exposes it: `button`, `link`, `heading`, `textbox`, `table`, `status`, `alert`), its accessible name, and its exact text. The developer builds these names and test automation finds elements by them. |
| **Token** | A named design value (`--color-text`, `--space-3`) defined in `prototype/tokens.css` |

## The Process

### Step 1: Check the statuses

Read the **Status** of `docs/PRD.md`, the **Status** of `docs/ARCHITECTURE.md` and its Technology Stack **Frontend** row before anything else.

| Input state | What this skill does | Highest `UX.md` status |
|---|---|---|
| PRD `Draft`, missing, or no status | **Refuse.** Write nothing under `docs/ux/`. Tell the human the PRD must reach review first, and route them to the BA (`write-prd`). | — |
| No `docs/ARCHITECTURE.md`, no Frontend row, or the row is blank or a placeholder | **`BLOCKED: front-end stack not decided`.** Write nothing. Route to the architect (`solution-architecture`). | — |
| Frontend row reads `None (no user interface)` | **`BLOCKED: no user interface`.** Write nothing. | — |
| PRD `In Review` or `Ready for approval` | Draft. A screen or state is `Blocked (PRD OQ n)` when a blocking open question names its FR, one of its BACs, or its flow step. A blocked screen keeps its inventory row and gets no pages. | `Draft` |
| Architecture below `Ready for design review`, Frontend named | Draft. Mark the stack mapping `provisional`. | `Draft` |
| PRD `Approved`, architecture at `Ready for design review` or later, nothing blocked | Full run | `Ready for review` |

When several rows apply, apply every treatment; the lowest ceiling wins. On a refusal or a BLOCKED result, report that one line and its route, and stop: no files and no checklist.

Never set `Approved`. The design review is the human's gate.

If `docs/ux/UX.md` already exists, you are in **update mode**: keep every `SCR-n`, mark the screens of withdrawn FRs `Withdrawn` (and delete their pages), give new screens the next free number, unblock screens whose questions were resolved, and re-run Steps 2 to 9.

### Step 2: Read what must be designed

From the files, list:

- **PRD:** every FR and BAC (with each BAC's quoted copy), every user flow step in order, the personas and what each role may see or do, the Non-Negotiables, every NFR about devices, accessibility and how dates or numbers are written, every edge case, and every blocking open question with the IDs it names
- **`CONSTRAINTS.md`:** the precedence block and the accessibility row, if any, with its ID and enforcement level
- **Architecture and ADRs:** the Frontend row and its ADR, what the stack rules out (for example "server-rendered pages only"), and any component library it names
- **`docs/ux/brand/`:** colours, type and voice. If the folder is empty or missing, use the neutral defaults in [templates/tokens.css](templates/tokens.css) and raise a non-blocking question for the brand owner (the PRD's approver, via the BA).

### Step 3: Classify every FR

Fill the FR classification table in `UX.md`: one row per FR, its class, its screens, and a reason. A reason says what the user sees: "only output is the confirmation email (BAC-5)", not "Email".

- Don't invent a screen for an `Email` or `Background` FR to make the prototype look complete. Record what the user receives in `UX.md`'s emails and background section, with any quoted subject or copy verbatim.
- An FR that no flow uses (often an admin FR) still gets a screen when users act on it. The storyboard lists it under "Screens no flow uses", with how it is reached.

### Step 4: Inventory the screens and their states

For each `Screen` FR, decide the screens and fill the inventory: `SCR-n`, name, FRs, BACs and edge cases, roles, states, spec link and status.

- **Every screen traces to an FR, and every element traces to an FR or BAC.** A flow step that names no FR, such as "they narrow the list to one floor", is not designed. It becomes a routed question to the PRD's approver (via the BA), and its storyboard row reads `Not designed: no FR (Open Questions #n)`.
- **States come from the requirements.** Each BAC outcome a user sees is a state or part of one. Add the states the patterns need where they apply: `empty` for a list that can be empty, `permission-denied` for a role a BAC or Non-Negotiable excludes, `validation` for a form with rules, `error` for a stated failure. Name the BAC or edge case that needs each state.
- **Per-role visibility.** A BAC that says one role can't do something means that role's view has no control for it, and a `permission-denied` state when they reach the screen.
- **Respect the stack.** A server-rendered stack has no script-driven dialog: a confirmation is its own page or state, as the architecture's ADR describes.

### Step 5: Write the design system

Copy [templates/tokens.css](templates/tokens.css) to `docs/ux/prototype/tokens.css` and [templates/design-system.md](templates/design-system.md) to `docs/ux/DESIGN-SYSTEM.md`.

- **Tokens.** Brand values become tokens, named by role (`--color-link`), not by hue. Every value lives in `tokens.css` only. `DESIGN-SYSTEM.md` names tokens and their roles; it never copies a value, so the two can't drift.
- **Contrast table.** For every text colour on every background it is used on, and every UI boundary or focus colour, compute the ratio from `tokens.css` with the WCAG 2.1 formula. For each channel `c = value / 255`, linearise: `c ≤ 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4`. Then `L = 0.2126 R + 0.7152 G + 0.0722 B`, and `ratio = (L_lighter + 0.05) / (L_darker + 0.05)`. Write it to two decimals. Required: 4.5 for text, 3 for large text (24 px, or 18.66 px bold) and for UI components and focus indicators.
- **A brand colour that fails** its use is not used for that use. A colour under 4.5:1 on its background is never body text, link text or the background behind text. It may serve where its ratio meets the minimum (a 3:1 border or focus ring), or not at all. Record the failing row in the table, give the role a passing token, and raise a question for the brand owner.
- **Accessibility baseline.** WCAG 2.1 AA is the design intent. Copy the enforcement level from `CONSTRAINTS.md` with its row ID, for example "M-1: measured, not yet enforced". Never call it enforced when `CONSTRAINTS.md` says measured, and never restate its numbers. If `CONSTRAINTS.md` has no accessibility row, say so and raise a non-blocking question for the architect. Apply `frontend-ui-engineering`'s "Accessibility (WCAG 2.1 AA)" and "Color" sections: keyboard access, visible focus, labelled controls, and colour never the only cue.
- **Breakpoints** come only from the PRD's device NFR. If the PRD rules mobile out, design no mobile layout. If it is silent, design for desktop and raise a question.
- **Components.** For each one: where it's used, its states, keyboard and focus behaviour, where its accessible name comes from, and how it maps to the stack (a template partial, a plain HTML element). A component library, CSS framework or script not in the architecture is not used. If the design seems to need one, raise a question for the architect (a new dependency is the architect's call).
- **Patterns** for empty, loading, error, permission-denied and validation states: structure and where the copy comes from. Follow `frontend-ui-engineering`'s "Meaningful Empty and Error States" section. Skip `loading` when the stack renders whole pages on the server, and say why.

### Step 6: Write a spec per screen

Copy [templates/screen.md](templates/screen.md) to `docs/ux/screens/scr-NN-<slug>.md` for each screen (NN zero-padded, slug in kebab-case).

- **States table:** each state, the BAC or edge case that needs it, and its prototype page.
- **Element table:** every heading, control, message and data region, with its role, accessible name and exact text. The accessible name is what a person using a screen reader hears and what `getByRole(role, { name })` matches. A BAC's quoted copy goes in exactly as written, including its punctuation. Never paraphrase it.
- **Example data** comes from the PRD's examples: its names, dates, numbers and formats. No lorem ipsum and no invented sample people when the PRD gives examples.

### Step 7: Build the prototype

Static HTML and CSS, opened from disk with no build step and no server. Use [templates/page.html](templates/page.html) for every page.

- **One page per screen state:** `prototype/scr-NN-<slug>--<state>.html`, the state's name exactly as in the inventory. No page for a state the inventory doesn't list, and no state without a page.
- **Every page** has the "Prototype, not functional" banner, a skip link to `<main id="main">`, the stack's landmarks (header, navigation, main), one `h1`, and links to the screen's other states. The prototype banner and state links are review aids, not part of the design, and stay out of the element table.
- **The design's own elements** use the roles, accessible names and exact text of the element table, and its example data.
- **Interactions** are links and forms. A form's `action` is the next state's page with `method="get"`, so a click shows the outcome and nothing is sent anywhere.
- **Never:** `<script>`, inline event handlers, `javascript:` URLs, or any `http://` or `https://` URL, including web fonts, images and icon sets. A link is relative and resolves to a file in `docs/ux/`.
- **Styles:** `tokens.css`, then `prototype.css`. `prototype.css` and the pages use `var(--…)` names only, never a raw colour, and define no custom properties. Don't use `style=""` attributes.

### Step 8: Storyboard the flows

In `UX.md`, give each PRD flow a table with one row per step, in the PRD's order: the step, its FR, its screen and the page that shows it. `prototype/index.html` repeats this as the storyboard: each flow as an ordered list of links. It also lists "Screens no flow uses" and every screen with links to all its states.

### Step 9: Route problems back, don't fix them

**Never edit** `docs/PRD.md`, `docs/ARCHITECTURE.md`, an ADR, `CONSTRAINTS.md`, `docs/TEST-PLAN.md`, `tests/features/` or anything in `docs/ux/brand/`. Each problem becomes its own row in `UX.md`'s Open Questions:

- **Owner:** whoever can answer. A product question (a flow step with no FR, copy a BAC doesn't give, a role with unclear access) goes to the PRD's approver, "(via the BA)". A stack question (a component library, a script, a second stylesheet tool) goes to the architect. A brand question goes to the brand contact the brand file names, or else the PRD's approver (via the BA).
- **Blocking:** only if the answer could change a screen, a state or an element. A blocking question lists what it blocks in the **Blocks** column, as IDs only (`SCR-3, FR-5`).
- Ask nobody directly. Questions go in the table, where the design review sees them.

### Step 10: Run the checklist and hand off

Run every item below against the written files, not your memory. Fix what you can and route the rest. Then:

1. Set Status, never higher than Step 1 allows.
2. Fill the Approvals table from the PRD's approver roles. If none are stated, add a non-blocking question "Who reviews the UX design?" for the PRD's approver (via the BA), and leave one row reading "To be named (see Open Questions #n)".
3. Report, in this order:
   ```
   UX design: <Status>
   Worked from: PRD <status>; architecture <status>, Frontend "<row text>"; CONSTRAINTS.md <present/absent>; brand <source or "none">
   Files: <every file written>
   Counts: FRs <n> (Screen <a>, Email <b>, Background <c>, Non-UI <d>); screens <n>; states <n>; components <n>; pages <n>
   U1: <result>
   …
   U15: <result>
   Blocked: <items, each with its question, or "none">
   Routed questions: <#n, owner, blocking or not — one line each>
   Prototype: docs/ux/prototype/index.html
   ```
   Each checklist line takes one of three forms, one item per line, U1 to U15 in order. Never a blanket "all pass".
   ```
   U<n>: pass — <evidence>
   U<n>: pass (by reading, not mechanically checked) — <evidence>
   U<n>: fail — <what is missing>
   ```
   Use plain `pass` only when you ran a tool for that item and the evidence names it. Run the mechanical check wherever one is possible:
   - **U1:** if you have a shell, `git diff -- docs/PRD.md docs/ARCHITECTURE.md docs/adr CONSTRAINTS.md docs/TEST-PLAN.md tests/features docs/ux/brand`. Without one, report it by reading and ask the human to run that command.
   - **U3 and U14:** Grep `docs/ux/prototype/` for `var(--` names, raw colours (`#` hex, `rgb(`, `hsl(`) outside `tokens.css`, `<script`, ` on…=` handlers and `http`.
   - **U8:** count the PRD's FR rows and the classification rows.
   - **U13:** Glob the pages and compare them with the inventory's states.
   - **U4:** recompute every contrast row from the values in `tokens.css`.
4. **Stop.**

## The UX checklist

Report results by ID.

**Sources and status**
- [ ] **U1** Statuses read and recorded in `UX.md`'s header; Status within Step 1's ceiling and never `Approved`. The PRD, architecture, ADRs, `CONSTRAINTS.md`, test plan, feature files and `docs/ux/brand/` are unchanged.
- [ ] **U2** The stack target is named from the Frontend row and its ADR. No component library, CSS framework, script or other dependency outside the architecture; any need for one is a question for the architect.

**Design system**
- [ ] **U3** Design values only in `tokens.css`. Every `var(--x)` used is defined there; no raw colour and no custom property definition outside it.
- [ ] **U4** `DESIGN-SYSTEM.md` has a contrast table whose ratios match `tokens.css`: at least 4.5:1 for text, 3:1 for large text and UI components. A brand colour that fails is not used for text, its failing row is recorded, and a question is raised.
- [ ] **U5** Accessibility baseline: WCAG 2.1 AA as the intent, the enforcement level copied from `CONSTRAINTS.md` with its row ID, and colour never the only cue.
- [ ] **U6** Each component has its states, keyboard and focus behaviour, accessible-name source and stack mapping. Patterns cover empty, loading (or why not), error, permission-denied and validation.
- [ ] **U7** Breakpoints come only from the PRD's device NFR.

**Screens**
- [ ] **U8** Every FR is classified `Screen` (with its `SCR-n`), `Email`, `Background` or `Non-UI`, with a reason.
- [ ] **U9** Every screen traces to an FR. No element exists without an FR or BAC behind it; a gap is an open question.
- [ ] **U10** The storyboard covers every flow step in order, including the undesigned ones, and `index.html` links it. Screens no flow uses are listed and reachable.
- [ ] **U11** Each screen spec has the states its BACs and edge cases need, per-role visibility, and an element table (role, accessible name, exact text).

**Prototype**
- [ ] **U12** Every BAC's quoted copy appears verbatim on its screen's pages. Data comes from the PRD's examples; no lorem ipsum.
- [ ] **U13** One page per screen state, named `scr-NN-<slug>--<state>.html`; the banner on every page.
- [ ] **U14** Every relative link resolves. No `<script>`, no event handler, no `http(s)://`.

**Readiness**
- [ ] **U15** Every open question has an owner, a blocking flag and, if blocking, its Blocks. Nothing is asked of the human outside the table. The brand source is cited, or a neutral default is used with a question.

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "The flow says they filter by floor, so I'll add a floor filter." | A flow step with no FR is a requirement nobody agreed. Leave it out, show it as not designed, and ask the PRD's approver. |
| "The confirmation email needs a screen so the prototype is complete." | An Email FR has no screen. Record what the user receives, and don't add a page nobody will build. |
| "The brand says Sky for links, so links are Sky." | At 3.6:1 on white, Sky text fails 4.5:1. Use a passing link colour, record the failing row, and ask the brand owner. |
| "I'll tidy the BAC's wording on the page; it reads better." | The BAC's copy is what the business approved and what tests will look for. Copy it exactly, or raise a question. |
| "A modal would be nicer than a confirmation page." | The architecture chose server-rendered pages. A script-driven dialog is a stack decision, which belongs to the architect. |
| "WCAG AA is the target, so I'll write that accessibility is enforced." | `CONSTRAINTS.md` decides enforcement. Copy its level and row ID; the design intent is a separate line. |
| "A hex value in prototype.css just this once is harmless." | Then `tokens.css` is no longer the source of truth, and the code reviewer can't tell a token from a stray. |
| "I'll pull the brand font from a font CDN." | The prototype opens from disk with no external URLs, and the brand file asks for the system stack anyway. |
| "The ratios look about right." | Reviewers trust the table. Recompute each row from `tokens.css`. |
| "I'll add a mobile layout to be safe." | The PRD rules mobile out. A breakpoint nobody asked for is design and test work nobody planned. |

## Red Flags

- Any file under `docs/ux/` written while the PRD is `Draft` or the Frontend row is blank, a placeholder or `None (no user interface)`
- A write to `docs/PRD.md`, `docs/ARCHITECTURE.md`, an ADR, `CONSTRAINTS.md`, the test plan, a feature file or `docs/ux/brand/`
- `Ready for review` while the PRD isn't `Approved` or the architecture isn't at design review; `Approved` set by the agent
- A screen for an Email-only FR, or a control for a flow step no FR backs
- An FR missing from the classification table, or a class with no reason
- A hex, `rgb()` or named colour outside `tokens.css`; a `var(--x)` with no definition
- A contrast ratio copied from the brand file or estimated, not computed from `tokens.css`; a failing brand colour used for text
- "Enforced" accessibility when `CONSTRAINTS.md` says measured, or no row ID cited
- A BAC's quoted copy paraphrased or truncated on its page; lorem ipsum or invented names when the PRD gives examples
- A screen state with no page, a page for an unlisted state, or a page without the banner
- `<script>`, an `onclick`, a `javascript:` link, or any `http(s)://` URL in the prototype
- A component library, CSS framework or web font the architecture doesn't name
- A checklist line reported as plain `pass` with no tool run behind it, or U1 by reading without asking the human for `git diff`
- The checklist printed after a refusal or a BLOCKED result

## Verification

Before handing off, confirm:

- [ ] Step 1's gate was applied and the statuses are in `UX.md`'s header
- [ ] Every file follows its template and sits under `docs/ux/`
- [ ] The source files and `docs/ux/brand/` are unchanged (`git diff`, or the human asked to run it)
- [ ] The FR classification has one row per FR, and every `Screen` row names an inventory screen
- [ ] Each inventory state has exactly one page, each page has the banner, and every link resolves
- [ ] Grep finds no `<script`, `http`, or raw colour outside `tokens.css` in `docs/ux/prototype/`
- [ ] Every contrast row was recomputed from `tokens.css`, and no failing pair carries text
- [ ] Every BAC's quoted copy is on its screen's page, character for character
- [ ] U1–U15 reported one line each, in the three forms
- [ ] Status no higher than Step 1 allows, and nothing marked `Approved`

## See Also

- `write-prd`: the FRs, BACs and flows this skill designs, and where product questions go back
- `solution-architecture`: the Frontend row and stack, and where stack questions go back
- `frontend-ui-engineering`: building the real components to these specs, including its accessibility, colour and empty-state sections
- `test-plan`: the scenarios that will find elements by the element tables' roles and names
- `constraint-driven-development`: the accessibility row whose enforcement level the design system copies
