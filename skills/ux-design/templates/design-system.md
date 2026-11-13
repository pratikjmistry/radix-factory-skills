# Design System

**Title:** [Product title, as in the PRD]
**Date:** [YYYY-MM-DD]
**Status:** [Draft | Ready for review], as `UX.md`
**Stack target:** "[Frontend row text]" ([ADR-nnnn]) [— provisional, if the architecture is below design review]
**Tokens:** `docs/ux/prototype/tokens.css`, the only file holding design values
**Brand source:** [`docs/ux/brand/<file>`, or "none supplied: neutral defaults, see UX.md Open Questions #n"]

## 1. Stack Target

[What the Frontend row allows and rules out, e.g. "server-rendered templates, plain CSS, no client-side framework or component library (ADR-0001)". How components map to it: template partials, plain HTML elements. Dependencies added by this design: none. Anything that seemed to need one is in UX.md Open Questions, owned by the architect.]

## 2. Tokens

Names and roles only; values live in `tokens.css`.

| Token | Role | Notes |
|-------|------|-------|
| `--color-text` | [Body text] | [Brand "Ink"] |
| `--color-bg` | [Page background] | |
| `--color-link` | [Link text] | [Why this value and not the brand's, if they differ] |
| `--color-focus` | [Focus indicator] | |
| `--space-1` … `--space-n` | [Spacing scale] | |
| `--font-family-base`, `--font-size-*` | [Type] | |

## 3. Contrast

Every ratio is computed from `tokens.css` with the WCAG 2.1 relative-luminance formula, to two decimals. Required: 4.5 for text; 3 for large text (24 px, or 18.66 px bold), UI component boundaries and focus indicators.

| Foreground | Background | Ratio | Required | Result | Used for |
|------------|------------|-------|----------|--------|----------|
| `--color-text` | `--color-bg` | [n.nn:1] | 4.5 | [Pass / Fail] | [Body text] |
| `--color-brand-accent` | `--color-surface` | [n.nn:1] | 4.5 | [Fail] | [Not used for text; see UX.md Open Questions #n] |

## 4. Accessibility Baseline

- **Intent:** WCAG 2.1 AA.
- **Enforcement:** [Copied from CONSTRAINTS.md with its row ID, e.g. "M-1: measured, not yet enforced; an automated scan reports, a finding does not fail the build". Or "CONSTRAINTS.md has no accessibility row; see UX.md Open Questions #n".]
- Every control is reachable and operable by keyboard, in reading order, with a visible focus indicator (`--color-focus`, at least 3:1).
- Every control has an accessible name, listed in its screen's element table.
- Colour is never the only cue: states also carry text or an icon with a text alternative.
- Each page has a skip link, landmarks and one `h1`; headings don't skip levels.
- Messages that appear after an action use `role="status"` (outcome) or `role="alert"` (refusal or error).

## 5. Breakpoints

From the PRD's device NFR: "[quote it]".

| Name | Min width | Layout |
|------|-----------|--------|
| [desktop] | [1280 px] | [Layout description] |

[No other breakpoints: state why, e.g. "mobile layouts are out of scope (PRD §3)".]

## 6. Components

| Component | Used on | States | Keyboard and focus | Accessible name from | Stack mapping |
|-----------|---------|--------|--------------------|----------------------|---------------|
| [Primary button] | [SCR-1, SCR-3] | [default, hover, focus, disabled] | [Tab to focus; Enter or Space activates] | [Its visible text] | [`<button>` in a template partial] |

## 7. Patterns

| Pattern | When | Structure | Copy from |
|---------|------|-----------|-----------|
| Empty | [A list with no rows] | [Message with `role="status"`, plus the next action as a link] | [BAC-n, verbatim] |
| Loading | [When, or "Not used: pages are rendered whole on the server"] | | |
| Error | [A stated failure] | [`role="alert"` message at the top of `main`, focusable] | [Edge case n] |
| Permission denied | [A role a BAC excludes] | [Heading and message; no controls for the excluded action] | [BAC-n] |
| Validation | [A form with rules] | [Message next to the field, linked with `aria-describedby`, plus a summary] | [BAC-n, or a question] |

## 8. Brand

[What was taken from the brand source, and every deviation with its reason and question number, e.g. "Larkspur Sky (3.62:1 on white) is not used for text; links use `--color-link` instead (UX.md Open Questions #n)".]
