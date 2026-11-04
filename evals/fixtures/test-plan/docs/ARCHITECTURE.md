# Architecture Document

**Title:** QBR Tracker — internal tool for client Quarterly Business Reviews
**Date:** 2026-10-30
**Status:** Ready for design review
**Source PRD:** `docs/PRD.md`, Status Approved, dated 2026-10-27

### Approvals
| Role | Name | Date |
|------|------|------|
| Delivery lead | Marcus Oyelaran, Delivery Lead | |
| Approver (owner of open decisions and CRM side) | Priya Castell, VP Sales | |

## 1. Overview
QBR Tracker is a server-rendered web application with one relational database and a scheduled job worker. It reads account data from Corvid CRM and user data from the company directory, and it sends email only through one mail sender module. It meets the PRD's objectives by tracking each Customer account's QBR due date, the QBRs held and their action items, and by sending day-based reminders and escalations.

## 2. Constraints & Non-Negotiables
| PRD Non-Negotiable | How it is held |
|---|---|
| Larkspur staff only | Sign-in only through the company identity provider (OIDC); every route except sign-in requires a session (ADR-0003, CONSTRAINTS N-2) |
| Confidential client information | QBR content and action items are read only through the authorized query module, which applies the FR-42 rule (ADR-0003, N-3) |
| No outside email | One mail sender module with a company-domain allowlist (ADR-0001, N-1) |
| CRM is the source of account data | Read-only CRM sync; only the sync writes CRM-sourced fields (ADR-0002, N-4) |

## 3. Technology Stack
| Layer | Choice | Version | ADR |
|---|---|---|---|
| Language / runtime | TypeScript on Node.js | Node 22 LTS | — (team standard) |
| Web | Server-rendered pages with a small HTTP framework | current major | — |
| Database | PostgreSQL | 16 | — |
| Jobs | Scheduled job worker in the same codebase, triggered every 15 minutes | — | ADR-0001 |
| Email | Company mail relay over SMTP, behind the mail sender module | — | ADR-0001 |
| Identity | Company identity provider, OIDC | — | ADR-0003 |
| Testing | Unit, integration and e2e tooling as in ADR-0004 | — | ADR-0004 |

## 4. Component Architecture
### Web app
Pages for account lists, scheduling, recording, action items, leadership view and admin. Serves FR-1 to FR-27, FR-33 to FR-46.

### Domain
Pure rules: due dates, QBR status, overdue days, reminder dates, time-zone conversion. Serves FR-8 to FR-10, FR-15 to FR-17, FR-27 to FR-30. Takes the current time from an injected clock (N-7).

### Authorized query module
The only path to QBR content and action items; applies FR-41 and FR-42. Serves FR-41, FR-42.

### CRM sync job
Reads Customer and non-Customer accounts from Corvid CRM every 6 hours and updates name, tier, owner and Account Type. Serves FR-2 to FR-5, FR-9 (tier changes), FR-32.

### Directory sync job
Reads users (name, email, time zone, active/disabled) from the company directory every 6 hours. Serves FR-31, FR-45, edge cases 5 and 6.

### Notification job and mail sender
Daily rules create rows in a notification outbox; the mail sender delivers them. Serves FR-15 to FR-17, FR-28 to FR-30, FR-32, FR-45.

## 5. Data Model
Every Shared Contract entity is stored: Account, User, QBR, Recorded Attendee, Action Item, Due-Date Change, Agenda Template, Change Record, Tool Settings. Account name, tier, owner and Account Type are read-only, written only by the CRM sync. User name, email, time zone and active flag are read-only, written only by the directory sync. Notification Outbox is an internal table (no PRD entity): rule, subject, recipient, local send date, status.

## 6. Integration Points
| System | Direction | Mechanism and schedule | Authentication | Failure behaviour |
|---|---|---|---|---|
| Corvid CRM | Inbound only | REST read of all accounts every 6 hours | Read-only API token | On a failed or partial read, nothing is applied and "Account data last updated" does not advance (BAC-8, edge case 10). A run that would de-customer more than 10% of Customer accounts is held and alerts (mass-change guard, ADR-0002). An account deleted or merged in the CRM is treated like a change of Account Type away from "Customer": it leaves the lists and its records stay readable (FR-3). |
| Company directory | Inbound only | Read of all users every 6 hours | Service credential | Same complete-read rule and mass-change guard as the CRM sync: a user is marked disabled only when a complete read reports them disabled or absent. |
| Company mail relay | Outbound only | SMTP, from the mail sender only | Service credential | A failed send stays in the outbox as Failed and alerts; it is not retried automatically if the outcome is unknown. |
| Company identity provider | Inbound (sign-in) | OIDC | — | Sign-in unavailable means no access; no fallback sign-in method. |

## 7. Deployment Topology
Three environments (dev, staging, production), each with its own database and its own CRM and directory credentials. Staging reads a CRM sandbox.

## 8. Observability
Each job writes a heartbeat row on completion; a monitor alerts if a job has not completed within twice its interval. Failed sends in the outbox raise an alert. Held mass-change runs raise an alert. Logs contain IDs and codes only, never QBR content (N-6).

## 9. Security & Compliance Baseline
| PRD access rule | Enforced in |
|---|---|
| FR-1 staff only | Sign-in middleware on every route (N-2) |
| FR-38 leadership read-only | Leadership pages have no write actions; write handlers check FR-41 |
| FR-41 account manager only | Write handlers, through the authorized query module |
| FR-42 QBR content visibility | Authorized query module (N-3) |

Secrets live in the environment's secret store. Audit: every change to a QBR, action item or baseline date writes a Change Record in the same transaction (N-5).

## 10. NFR Mapping
| PRD NFR | Approach |
|---|---|
| Data freshness (24 h) | CRM and directory syncs every 6 hours; a sync not completed within 12 hours alerts |
| Email timing | The notification job sends day-based emails at 10:00 in the recipient's time zone (IST when none is set) (ADR-0001) |
| Time display | Domain time-zone service; IST fallback |
| Scale (300 users, 200 accounts) | Single database; no sharding |
| Speed (95% within 2 s) | Server-rendered pages, indexed list queries |
| Availability (99% in business hours) | Single region, health check, alerting in business hours |
| Retention | No delete paths for QBRs, action items or history (N-5) |
| Audit | Change Record written in the same transaction (N-5) |
| Devices | Desktop browsers; no mobile layouts |

## 11. Decisions
- [ADR-0001](adr/0001-scheduled-jobs-and-notification-outbox.md) Scheduled jobs and notification outbox
- [ADR-0002](adr/0002-crm-read-only-sync-and-mass-change-guard.md) CRM read-only sync and mass-change guard
- [ADR-0003](adr/0003-sign-in-and-authorization.md) Sign-in and authorization
- [ADR-0004](adr/0004-testing-approach.md) Testing approach

## 12. Traceability
Every Shared Contract entity is in section 5. Every Non-Negotiable NFR is in section 2. Every NFR is in section 10.

## 13. Risks from the PRD
None open: PRD open questions 1, 2, 3 and 8 were resolved before approval.

## 14. Dependencies
CRM sandbox access for staging (Priya Castell); a mail relay credential (Larkspur IT).

## 15. Open Questions
| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Confirm the TypeScript / PostgreSQL stack at design review | Marcus Oyelaran | No |
