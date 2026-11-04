# ADR-0003: Sign-in and authorization

**Status:** Proposed
**Date:** 2026-10-30

## Context
Only signed-in Larkspur staff may use the tool (PRD §8 "Larkspur staff only", FR-1, BAC-1, BAC-2). QBR content is confidential (PRD §8) and visible only as FR-42 allows (BAC-60). Only an account's account manager may change it (FR-41, BAC-59). The leadership view is read-only (FR-38, BAC-55; PRD open question 2, resolved).

## Decision
- Sign-in uses the company identity provider over OIDC. Sessions are accepted only for accounts in the Larkspur organisation that are active.
- A fallback rule requires a session on every route; only sign-in, sign-out and the health check are anonymous, and the health check returns no data.
- Roles: account manager (derived from CRM ownership), leadership (leadership list), admin.
- QBR content and action items are read only through the authorized query module, which applies FR-41 and FR-42.

## Alternatives considered
- Per-page permission checks: easy to miss on a new page.

## Consequences
A new page is protected by default. A new query for QBR content must go through the module (CONSTRAINTS N-3).
