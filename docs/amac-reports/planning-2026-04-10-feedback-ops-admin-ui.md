# AMAC Planning Report: Feedback Ops Admin UI + GitHub Escalation

**Date:** 2026-04-10  
**Stack:** TypeScript / Next.js App Router  
**Branch:** `feat/in-app-feedback`  
**Confidence:** 87%

## Specialist Debate Summary

### Agreements (High Confidence)
- Build a dedicated admin workspace at `/admin/feedback` with queue + detail triage panel.
- Keep feedback intake (`POST /api/feedback`) unchanged; add additive admin APIs.
- Extend `AppFeedback` with triage fields rather than introducing a second core table.
- Add admin-only GitHub issue escalation with minimized payload and persisted references.
- Use phased delivery to reduce integration risk.

### Conflicts Resolved
- **Kanban vs table-first:** table/detail won for V1 speed and fit with existing admin architecture.
- **ProjectV2 sync timing:** GitHub issue creation in V2, project field sync in V3 due complexity.

### Adoption Tracking
| Specialist | Adopted | Rejected | Notes |
|------------|---------|----------|-------|
| Architect | 4 | 0 | Module boundaries accepted |
| Quality Engineer | 3 | 0 | Test matrix accepted |
| Pragmatist | 3 | 0 | Phased delivery accepted |
| Frontend Specialist | 4 | 0 | Workspace UX accepted |
| Resilience & Perf | 3 | 0 | Pagination/retries accepted |
| Security | 4 | 0 | Sanitization/token handling accepted |
| GDPR | 4 | 0 | Minimization + policy updates accepted |
| API Contract | 4 | 0 | Additive endpoints/migration accepted |

## Research Snapshot (effective triage patterns)
- Feedback operations work best when severity and business priority are separated and then combined for ranking.
- High-performing teams use a named owner + recurring triage cadence (e.g., weekly) to prevent queue rot.
- GitHub Projects with custom fields and automation is a practical issue-operations backbone for triage workflows.

## Implementation Plan

**Files:** 9 new, 8 modified (17 total)

### Key new routes/services
- `GET /api/admin/feedback` — list with filters, pagination.
- `GET/PATCH /api/admin/feedback/[id]` — detail and triage mutation.
- `POST /api/admin/feedback/[id]/github` — create GitHub issue + persist references.
- `src/lib/github/feedback-issues.ts` — GitHub integration wrapper.

### UI/UX
- Add `/admin/feedback` nav item and page.
- Queue table (left): category/status/priority/updatedAt/search.
- Detail panel (right): full message, metadata, status/priority/owner/tags/notes, "Create GitHub issue" action.
- Keep styling in existing admin visual language (`admin.scss`) and full keyboard accessibility.

### Data model additions (to `AppFeedback`)
- `triageStatus` (`new`, `triaged`, `in_progress`, `done`, `discarded`)
- `priority` (`p1`..`p5`)
- `ownerUserId` (nullable FK)
- `internalNotes` (text)
- `githubIssueNumber`, `githubIssueUrl`, optional `githubProjectItemId`
- `triagedAt`, `closedAt`
- indexes on `triageStatus`, `priority`, `updatedAt`

## Devil’s Advocate
**Verdict:** `CHALLENGES_FOUND` (highest: `MEDIUM`)

- Process risk: no SLA/owner model means stale backlog even with good UI.
- Privacy risk: raw feedback may include personal data; must redact/confirm before GitHub export.
- Delivery risk: 17-file scope may be better split into two PRs.

## Recommended Delivery Slices
1. **PR1 (core triage):** schema + migration, admin feedback page, list/detail APIs, triage edits, audit logs.  
2. **PR2 (escalation):** GitHub issue creation, optional ProjectV2 integration, privacy-safe export UX.

## Target Integration
- GitHub project for escalation workflow: [Concertivity Project](https://github.com/users/Juuro/projects/2/views/1)

---

## AMAC loop closeout (Phase 2–5, 2026-04-10)

**Status:** Implementation already merged on branch `feat/in-app-feedback`; this section records the **retroactive** specialist round + Tech Lead synthesis after **Project V2** shipped and the **user vs. organization** GraphQL fix.

### Round 1 (8 specialists)
Independent proposals aligned on: admin-only APIs, Zod validation, server-side tokens, additive Prisma schema, table + detail UX, rate-limited public intake, `AdminActivity` on GitHub create, graceful Project V2 failure after issue exists.

### Round 2 (Tech Lead synthesis)
- **Confidence:** 91%  
- **Files (plan):** ~14 new, ~10 modified (~24 total)  
- **Key conflict resolved:** Single GraphQL query `user` + `organization` caused top-level errors when `organization(login)` could not resolve a **user** login (e.g. `Juuro`). **Resolution:** query **user** first, then **organization** only if the project was not found.

### Round 3 (Devil’s Advocate)
- **Verdict:** `CHALLENGES_FOUND` — **highest:** `LOW`  
- Residual: structured error codes for GitHub failures (optional); mocked tests for GitHub REST/GraphQL (optional).

### Verification
- `yarn test` — 22 files, 317 tests passed (2026-04-10).

### Phase 3 gate
- Met auto-implement criteria post-hoc (`confidence` ≥ 70, DA severity not CRITICAL/HIGH); work was completed before this checkpoint.
