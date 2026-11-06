# Architecture Document

**Title:** QBR Tracker — internal tool for client Quarterly Business Reviews
**Date:** 2026-10-30
**Status:** Ready for design review
**Source PRD:** `docs/PRD.md`, Status Approved, dated 2026-10-27

### Approvals
| Role | Name | Date |
|------|------|------|
| Approver (owner of open decisions and CRM side) | Priya Castell, VP Sales | |

## 1. Overview
A server-rendered web application with one relational database and a scheduled job worker. It reads accounts from Corvid CRM and users from the company directory, and sends email only through one mail sender module.

## 2. Constraints & Non-Negotiables
| PRD Non-Negotiable | How it is held |
|---|---|
| No outside email | One mail sender module with a company-domain allowlist (ADR-0001, CONSTRAINTS N-1) |

## 3. Technology Stack
| Layer | Choice | ADR |
|---|---|---|
| Language / runtime | TypeScript on Node.js 22 | — (team standard) |
| Database | PostgreSQL 16 | — |
| Jobs | Job worker in the same codebase, every 15 minutes | ADR-0001 |
| Email | Company mail relay over SMTP, behind the mail sender module | ADR-0001 |
| Identity | Company identity provider, OIDC; every route except sign-in, sign-out and the health check needs a session (N-2) | — |

## 4. Components
- **Web app:** account list, scheduling, recording, action items, leadership list and admin. Serves FR-1 to FR-3, FR-5, FR-6, FR-9 to FR-11.
- **Domain:** due dates, reminder and overdue dates, time-zone conversion, with an injected clock. Serves FR-2, FR-4, FR-7.
- **CRM sync job:** reads all accounts from Corvid CRM every 6 hours (ADR-0002). Serves FR-1, FR-8, FR-11.
- **Directory sync job:** reads users (email, time zone, active/disabled) every 6 hours.
- **Notification job and mail sender:** daily rules create outbox rows; the mail sender delivers them (ADR-0001). Serves FR-4, FR-7, FR-8.

## 5. Integration Points
| System | Direction | Mechanism and schedule | Failure behaviour |
|---|---|---|---|
| Corvid CRM | Inbound only | Read of all accounts every 6 hours, read-only token | On a failed or partial read nothing is applied and "Account data last updated" does not advance (BAC-12). Mass-change guard (ADR-0002, N-4). |
| Company directory | Inbound only | Read of all users every 6 hours | Same complete-read rule as the CRM sync. |
| Company mail relay | Outbound only | From the mail sender only | A failed send stays in the outbox as Failed and alerts. |

## 6. NFR Mapping
| PRD NFR | Approach |
|---|---|
| Data freshness (24 h) | CRM and directory syncs every 6 hours (ADR-0002) |
| Email timing | The notification job sends day-based emails at 10:00 in the recipient's time zone (IST when none is set) (ADR-0001) |
| Time display | Domain time-zone service; IST fallback |
| Speed (95% within 2 s) | Server-rendered pages, indexed list queries; load test at 300 users and 200 accounts |

## 7. Testing Approach
- **Unit:** domain rules with the clock injected.
- **Integration:** jobs and the database, with external systems replaced by doubles:
  - a **fake CRM** serving scripted accounts, including failed and partial reads
  - a **fake directory** with scripted users, time zones and disabled users
  - a **captured outbox**: the mail sender's transport is replaced and nothing leaves the process
  - a **fixed clock** set per test
- **E2E:** browser tests of the user flows against a running app with the same doubles.
- **Non-functional:** a load test of the list pages at 300 users and 200 accounts.

## 8. Decisions
- [ADR-0001](adr/0001-scheduled-jobs-and-outbox.md) Scheduled jobs and notification outbox
- [ADR-0002](adr/0002-crm-read-only-sync-and-mass-change-guard.md) CRM read-only sync and mass-change guard

## 9. Open Questions
| # | Question | Owner | Blocking? |
|---|----------|-------|-----------|
| 1 | Confirm the stack at design review | Priya Castell | No |
