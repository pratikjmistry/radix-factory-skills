# Changelog

Earlier releases are described in their git tag messages (`git tag -n99 <version>`).

## 0.10.0 — 2026-11-13

### ux-design (new)

- New skill for the ux-designer agent. From an `In Review` or `Approved` PRD and the architecture's Frontend row, it classifies every FR (`Screen`, `Email`, `Background`, `Non-UI`, with a reason) and writes, under `docs/ux/` only: `UX.md` (FR classification, screen inventory `SCR-n`, navigation, a storyboard per flow, emails and background behaviour, Open Questions with a Blocks column), `DESIGN-SYSTEM.md` (stack target, token roles, a contrast table recomputed from `tokens.css`, accessibility baseline with the enforcement level copied from `CONSTRAINTS.md`, breakpoints from the PRD's device NFR, components, patterns), `screens/scr-NN-<slug>.md` with element tables (role, accessible name, exact text), and a static HTML/CSS prototype (`prototype/index.html` storyboard, `tokens.css`, `prototype.css`, one `scr-NN-<slug>--<state>.html` page per screen state, no script, no remote URLs, a "Prototype, not functional" banner on every page).
- Status gate: a `Draft` or missing PRD is refused and routed to the BA; no Frontend decision gives `BLOCKED: front-end stack not decided`; Frontend `None (no user interface)` gives `BLOCKED: no user interface`. `Ready for review` needs an `Approved` PRD and the architecture at `Ready for design review` or later; never `Approved`. Checklist U1–U15, reported one line each in the same three forms as test-plan.
- Templates: `ux.md`, `design-system.md`, `screen.md`, `tokens.css`, `page.html`, `index.html`.

### solution-architecture

- The architecture template's Frontend row reads `None (no user interface)` for a product with no user interface, which ux-design reads as `BLOCKED: no user interface`.

### Evals

- `evals/cases/ux-design.json`: trigger cases (negatives route an accessible modal to frontend-ui-engineering, choosing the stack to solution-architecture, refining an idea to idea-refine); gating eval 1 on the new `ux-larkspur` fixture (Approved desk-booking PRD with 3 flows, 9 FRs including an email-only FR and an admin FR no flow uses, 11 BACs with quoted copy, an empty and a permission-denied state, a flow step with no FR; server-rendered architecture at `Ready for design review`; accessibility measured, not enforced; a brand colour that fails 4.5:1 on white); gating eval 2 on `ux-larkspur-draft-prd` (Draft PRD refusal, nothing written under `docs/ux/`).
- New deterministic checks in `evals/checks/ux-design.js`, with unit tests in `scripts/run-evals-test.js`: `contrast-recomputed`, `tokens-defined`, `frs-classified`, `page-per-state`, `links-resolve`, `no-script-or-remote`, `bac-copy-verbatim`.

## 0.9.1 — 2026-11-12

### test-plan

- A PRD §8 Non-Negotiable NFR or §9 NFR without an ID gets a kebab-case tag derived from its PRD heading (`@NN-no-outside-email`, `@NFR-email-timing`). The plan's two coverage tables (Non-Negotiables and constraints; NFRs and edge cases) always have a **Tag** column holding each row's tag, unique across both tables, and feature files use it verbatim. An item with a PRD ID keeps the ID as its tag. Before this, plans could refer to these items only by heading, so no script could resolve their `@NN-`/`@NFR-` tags.
- In the checklist report, a T-line verified only by reading, with no tool run, says so: `T<n>: pass (by reading, not mechanically checked) — …`. T7 and T11 are checked with the Grep tool. T8 uses `git diff` when a shell is available; otherwise it is reported by reading and the human is asked to run `git diff`. T7 now also covers the Tag columns.

### Evals

- New `named-tags-agree` check (`evals/checks/test-plan.js`): both coverage tables have a Tag column with a unique tag on every row; every `@NN-` and `@NFR-` tag in `tests/features/*.feature` is in a Tag column; and every `@NN-`/`@NFR-` Tag column entry is on at least one scenario unless its row is Blocked, Pending architecture, Withdrawn, Tool check, Manual or Non-functional. Unit tests cover both directions, a missing Tag column and duplicate tags. Runs in test-plan evals 1 (C9) and 2 (C10).
- Test-plan eval 2 gains an expectation for heading-derived tags. Its mini fixture already has ID-less Non-Negotiables and NFRs, so it is unchanged.
