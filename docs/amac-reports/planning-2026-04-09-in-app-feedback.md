# AMAC Planning Report: In-app feedback modal (first-party MVP)

**Date:** 2026-04-09  
**Stack:** TypeScript / Next.js 15 App Router (not Angular / NDBX)  
**Branch:** `feat/in-app-feedback`  
**Confidence:** 86%  
**Strategic analysis:** [analysis-2026-04-09-in-app-feedback.md](./analysis-2026-04-09-in-app-feedback.md)

---

## Specialist debate summary

**Round 1:** Eight software-engineering roster specialists proposed independently from `shared-context.json` (architect, quality-engineer, pragmatist, frontend-specialist, resilience-performance, security-specialist, gdpr-compliance, api-contract-migration).  
**Round 2:** Tech Lead synthesized conflicts and merged into a single implementation plan.  
**Round 3:** Devil’s Advocate challenged assumptions (see below).

### Agreements (high confidence)

- First-party MVP only: no third-party feedback widgets; no CSP expansion for such scripts.
- `POST /api/feedback` with **Zod** validation, **Prisma** persistence, **optional** Better Auth `userId` from server session (never from client body).
- **IP-based rate limiting** with bounded in-memory map and periodic cleanup (pattern aligned with existing venue search route).
- **Categories:** bug, feature, general (enum in DB + Zod).
- **Global entry point** via `SessionAwareShell` so feedback is available outside layouts that only mount `Footer`.
- **Privacy policy** updated for purposes, legal basis, and retention before treating production as compliant.
- **UI:** reuse existing `Dialog`, `ToastProvider` / `useToast`, **SCSS modules** (project standard—not ngx-brand-kit).

### Conflicts resolved

| Topic | Resolution | Reasoning |
|--------|------------|-----------|
| UI component stack | Next.js Dialog + SCSS modules | Repo is Next.js; AMAC’s default Angular/NDBX wording does not apply. |
| Rate limit strictness | Stricter than venue search (e.g. ~12 submissions / 15 min / IP, 429 + `Retry-After`) | Public POST abuse risk; strategic analysis flagged spam. |
| Slack / email / admin UI | Out of MVP | Pragmatist + architect: triage via DB/Studio until volume justifies automation. |

### Adoption tracking

| Specialist        | Adopted (themes) | Rejected | Notes |
|-------------------|------------------|----------|--------|
| Architect         | 4 | 0 | Shell mount, `AppFeedback` naming |
| Quality Engineer  | 2 | 0 | Vitest on Zod; E2E deferred |
| Pragmatist        | 3 | 0 | No CAPTCHA/webhooks/admin v1 |
| Frontend          | 4 | 0 | a11y, modules, pathname context |
| Resilience        | 2 | 0 | Stricter limits, 429 semantics |
| Security          | 3 | 0 | Truncate UA, no body logging |
| GDPR              | 3 | 0 | Policy + retention copy |
| API & migration   | 3 | 0 | Additive contract, enum alignment |

---

## Implementation plan

**Files:** 5 new, 4 modified (**9 total**)

### Order

1. Prisma schema + migration; `yarn db:generate`  
2. `src/lib/feedback/schema.ts` + `schema.test.ts`  
3. `app/api/feedback/route.ts` (confirm Prisma client import style matches `src/lib/prisma.ts`)  
4. `FeedbackModal.tsx` + `FeedbackModal.module.scss` (trigger placement e.g. **bottom-left** to avoid PostHog consent **bottom-right**)  
5. Wire modal in `app/SessionAwareShell.tsx`  
6. `app/privacy/page.tsx` — purposes + retention  
7. `yarn test`, `yarn lint`; apply migration locally  

### Files (synthesised)

| Action | Path | Role |
|--------|------|------|
| MODIFY | `prisma/schema.prisma` | `AppFeedback` + enum + `User` relation |
| CREATE | `prisma/migrations/.../migration.sql` | DB enum + table + FK |
| CREATE | `src/lib/feedback/schema.ts` | Zod body schema |
| CREATE | `src/lib/feedback/schema.test.ts` | Vitest |
| CREATE | `app/api/feedback/route.ts` | POST handler |
| CREATE | `src/components/FeedbackModal/FeedbackModal.tsx` | Client UI |
| CREATE | `src/components/FeedbackModal/FeedbackModal.module.scss` | Styles |
| MODIFY | `app/SessionAwareShell.tsx` | Mount modal |
| MODIFY | `app/privacy/page.tsx` | GDPR copy |

---

## Quality gates

- **Critical addressed:** Zod validation; server-side session; no client-trusted identity; privacy documentation.  
- **High addressed:** Rate limits; accessible dialog/form; tests on schema.  
- **Unaddressed (explicit deferral):** In-app admin list, email/Slack notify, CAPTCHA.

---

## Risks

| Severity | Risk | Mitigation |
|----------|------|------------|
| MEDIUM | In-memory limiter per isolate (serverless) | OK for MVP; Redis later if needed |
| MEDIUM | Spam / shared-IP false positives | Monitor; tighten per-user when logged in |
| LOW | Draft files on branch out of sync with final imports | Reconcile in Phase 4 before merge |

---

## Devil’s advocate

**Verdict:** `CHALLENGES_FOUND` — **Highest severity:** `MEDIUM`

1. **Operations:** Without notification, feedback may sit unread—consider optional env webhook or manual review discipline.  
2. **Abuse / fairness:** IP-only limiting hurts NAT/shared offices—evolve to user-based limits for authenticated submits.  
3. **Consistency:** Existing draft implementation must be reconciled so Prisma types and imports match the repo generator output.

**Concessions:** First-party stack is the right GDPR posture for MVP; deferring CAPTCHA is acceptable with limits; schema-level tests are proportionate.

---

## Approval gate (Phase 3)

Per AMAC rules: **9 files ≥ auto_threshold** → **user approval required** before Phase 4 implementation.  
Devil’s Advocate highest severity is **MEDIUM** (not CRITICAL/HIGH block alone), but file count triggers review.

**Workspace note:** Partial drafts may already exist (`prisma/schema.prisma`, migration folder, `app/api/feedback`, `src/lib/feedback`). Implementation should **verify and align** rather than blindly duplicate.

---

## Next step

When you approve, proceed with **Phase 4 — implementation** using this report and `.claude/agents/allianz-mac/.temp/synthesised-plan.json` as the single plan of record.
