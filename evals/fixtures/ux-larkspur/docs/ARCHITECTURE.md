# Architecture Document

**Title:** Desk Booking — book a hot desk at a Larkspur office
**Date:** 2026-11-09
**Status:** Ready for design review
**Source PRD:** `docs/PRD.md`, Status Approved, dated 2026-11-02

### Approvals
| Role | Name | Date |
|------|------|------|
| Approver (owner of open decisions) | Tomas Reyl, Facilities Director | |

## 1. Overview
A server-rendered web application with one relational database and a scheduled job. Every page is rendered on the server as plain HTML forms and links; there is no client-side framework. Sign-in goes through the company identity provider, and email goes out through one mail sender module.

## 2. Constraints & Non-Negotiables
| # | Constraint | Source | Held by |
|---|------------|--------|---------|
| 1 | Larkspur staff only | PRD §8 | Company sign-in on every route (CONSTRAINTS N-1) |
| 2 | One desk, one person, one day | PRD §8 | Unique constraint on desk and date (CONSTRAINTS N-2) |

## 3. Technology Stack
| Layer | Technology | Version / Constraint | Decided in |
|-------|------------|----------------------|------------|
| Frontend | Server-rendered HTML with Django templates; plain CSS, no client-side framework, no component library | Django 5.1 | ADR-0001 |
| Backend | Python, Django | Python 3.12, Django 5.1 | ADR-0001 |
| Database | PostgreSQL | 16 | — |
| Data access | Django ORM | 5.1 | ADR-0001 |
| Authentication | Company identity provider over OIDC | — | — |
| Background jobs / scheduling | Scheduled management command every 5 minutes (release at 10:00) | — | — |
| Hosting / infrastructure | One container behind the company reverse proxy | — | — |

### Constraints on future choices
Server-rendered pages only: every interaction works as an HTML form post or a link. JavaScript may only enhance a page that already works without it, and needs an ADR before it is added.

## 4. Component Architecture
### Web app
- Responsibility: find a desk, book, my bookings, cancel, check in, desk management
- Boundaries: does not send email itself
- Serves: FR-1, FR-2, FR-4, FR-5, FR-6, FR-8, FR-9

### Release job
- Responsibility: release bookings with no check-in at 10:00 office time
- Serves: FR-7

### Mail sender
- Responsibility: the only module that sends email; Larkspur addresses only
- Serves: FR-3

## 5. Data Model
| Entity (PRD §8) | Owned by | Key attributes | Notes |
|-----------------|----------|----------------|-------|
| Office | This system | name, floors | Seeded: Leeds, Bristol |
| Desk | This system | number, office, floor, active | Removed desks are kept, inactive |
| Booking | This system | user, desk, date, status, checked_in_at | Unique (desk, date) and (user, date) for active bookings |
| User | Company directory, read-only | name, email, office_manager_for | |

## 6. Decisions
- [ADR-0001](adr/0001-server-rendered-pages.md) Server-rendered pages with Django templates

## 7. Open Questions
| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Container hosting cost estimate | Tomas Reyl, with the architect | No |
