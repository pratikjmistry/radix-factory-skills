# ADR-0001: Server-rendered pages with Django templates

**Status:** Proposed
**Date:** 2026-11-09

## Context
A small internal tool, desktop only, built and run by a team that works in Python. Every flow in the PRD is a short sequence of lists and forms.

## Decision
Render every page on the server with Django templates. Interactions are HTML forms that post to the server and links between pages. Plain CSS with custom properties; no CSS framework, no component library, no client-side framework.

## Consequences
- Every state of a screen (empty, error, refused, confirmation) is a server-rendered page or a section of one.
- Confirmation steps (for example "are you sure?") are their own page or a form section, not a script-driven dialog.
- Adding JavaScript, a CSS framework or a component library needs a new ADR.
