# Changelog

Earlier releases are described in their git tag messages (`git tag -n99 <version>`).

## 0.9.1 — 2026-11-12

### test-plan

- A PRD §8 Non-Negotiable NFR or §9 NFR without an ID gets a kebab-case tag derived from its PRD heading (`@NN-no-outside-email`, `@NFR-email-timing`). The plan's two coverage tables (Non-Negotiables and constraints; NFRs and edge cases) always have a **Tag** column holding each row's tag, unique across both tables, and feature files use it verbatim. An item with a PRD ID keeps the ID as its tag. Before this, plans could refer to these items only by heading, so no script could resolve their `@NN-`/`@NFR-` tags.
- In the checklist report, a T-line verified only by reading, with no tool run, says so: `T<n>: pass (by reading, not mechanically checked) — …`. T7 and T11 are checked with the Grep tool. T8 uses `git diff` when a shell is available; otherwise it is reported by reading and the human is asked to run `git diff`. T7 now also covers the Tag columns.

### Evals

- New `named-tags-agree` check (`evals/checks/test-plan.js`): both coverage tables have a Tag column with a unique tag on every row; every `@NN-` and `@NFR-` tag in `tests/features/*.feature` is in a Tag column; and every `@NN-`/`@NFR-` Tag column entry is on at least one scenario unless its row is Blocked, Pending architecture, Withdrawn, Tool check, Manual or Non-functional. Unit tests cover both directions, a missing Tag column and duplicate tags. Runs in test-plan evals 1 (C9) and 2 (C10).
- Test-plan eval 2 gains an expectation for heading-derived tags. Its mini fixture already has ID-less Non-Negotiables and NFRs, so it is unchanged.
