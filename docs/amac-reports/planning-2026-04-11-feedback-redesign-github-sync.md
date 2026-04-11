# AMAC Planning Report: Feedback admin redesign + GitHub workflow sync

**Date:** 2026-04-11  
**Skill:** Allianz Multi-Agent Coder (AMAC) — Phases 0–2 + Devil’s Advocate  
**Repository:** concerts (Next.js App Router, Prisma, PostgreSQL)  
**Branch (suggested):** `feat/feedback-ops-v2`  
**Design system:** Pink Ink Editorial (`admin.scss`, `variables.scss`)

---

## Phase 0 — Setup & task definition (executed)

| Field | Value |
|--------|--------|
| **Task type** | Feature (UX) + workflow / integration |
| **Priority** | High |
| **Scope** | Full-stack (admin UI, APIs, optional cron, schema) |
| **Personal data** | Yes — feedback may contain PII; GitHub export already sanitized in places |
| **Breaking API** | No — additive fields and query params preferred |

**User goals (verbatim intent):**

1. **Visual / UX:** Feedback admin page feels inconsistent; align with Pink Ink Editorial and clarify hierarchy and scanability.  
2. **Workflow — queue growth:** After creating a GitHub issue, items remain visible forever; queue will pile up.  
3. **Workflow — GitHub truth:** No sync when the linked issue closes; app does not show GitHub issue state.

**Acceptance criteria (derived):**

- **AC-UX-1:** Inbox and detail use clear visual hierarchy consistent with admin dashboard sections (surfaces, radii, shadows, pink accents).  
- **AC-UX-2:** Default queue view focuses operators on **actionable** work (not “everything forever” unless chosen).  
- **AC-WF-1:** Operators can see **GitHub issue state** (open/closed, and optionally merged) for linked items.  
- **AC-WF-2:** Operators can **refresh** GitHub state on demand (and optionally automatic background sync).  
- **AC-WF-3:** Policy for “done” feedback is explicit: retention in DB vs. hiding from default queue vs. auto-status — documented and implemented consistently.  
- **AC-SEC-1:** No new secrets exposed to the client; sync uses existing server token patterns.  
- **AC-GDPR-1:** Archival / export behaviour remains privacy-aware; no expansion of PII to GitHub without controls.

---

## Phase 1 — Context snapshot (codebase)

**Current UI:** `FeedbackWorkspace` → nested `admin-card` + `feedback-workspace` grid (`minmax(320px, 38%)` | `1fr`). Queue and detail are separate bordered boxes with local styles; some hardcoded `#fff` instead of `$admin-surface`.

**Current APIs:** `GET /api/admin/feedback` (filters: status, priority, category, q); `GET/PATCH /api/admin/feedback/[id]`; `POST .../github` creates issue + optional Project V2.

**Current model (`AppFeedback`):** triage enums, `githubIssueNumber`, `githubIssueUrl`, `githubProjectItemId`, `closedAt` — **no** stored GitHub issue `state` or last-sync timestamp.

**Admin width:** `main.container:has(.admin-shell)` already widens admin routes via `$admin-main-max-width` (see `layout.scss`). Remaining feedback UX issues are **component-level**, not only container width.

---

## Round 1 — Eight specialist proposals (parallel)

### Architect
- **Structure:** Treat Feedback Ops as a **two-pane app shell** inside admin: **Inbox** (list + filters) and **Inspector** (detail + actions). Drop the “card inside card” (`admin-card` wrapping the whole workspace); use one **dashboard-grade surface** (same shadow/radius as `admin-dashboard__section`) or full-bleed panels with a shared toolbar.  
- **Navigation state:** Optional URL sync `?selected=` for deep-linking and refresh survival.  
- **Data boundary:** GitHub sync logic lives in `src/lib/github/`; a thin `syncFeedbackIssueState(feedbackId)` service called from route handlers or cron.

### Quality Engineer
- **Tests:** Unit-test mapping from GitHub API payload → domain fields; Zod schema for any new PATCH/query. Component tests for default filter behaviour (Active vs All).  
- **Definition of done:** Given a linked issue, when GitHub returns `closed`, UI shows closed and (if product agrees) triage moves to `DONE` with audit entry.

### Pragmatist
- **Ship in slices:** (1) UI polish + default **Active** queue filter — *immediate win, no GitHub rate-limit risk*. (2) Add `githubIssueState` + **Refresh** button using REST `GET /repos/.../issues/{n}`. (3) Optional cron later.  
- **Avoid premature webhooks** until traffic justifies ops complexity.

### Frontend specialist (Pink Ink Editorial)
- **Typography:** Match `admin-header` / `admin-dashboard__section-title` scale for page title; demote redundant “Feedback Workspace” H2 or merge into toolbar.  
- **Panels:** Use `$admin-surface`, `$admin-shadow-md`, **20px** section radius to match bento cards; replace nested white-on-white boxes with **column chrome** (subtle header strip per pane with `aria-labelledby`).  
- **Chips:** Unify `feedback-chip` with admin status language (success/warning surfaces from variables).  
- **GitHub strip:** Prominent **status pill** (Open / Closed / Unknown), **Last synced** text, **Refresh** control, external link with `rel="noreferrer"`.  
- **Density:** Slightly tighter list rows; reserve “card” feel for selected row only.

### Resilience & performance
- **Rate limits:** GitHub REST **5,000/hr** classic; batch sync cron must throttle (e.g. 30 items/min) and backoff on **403/429**.  
- **On-demand refresh:** Debounce per feedback id; disable button while loading.  
- **Stale data:** Show `githubSyncedAt` so operators trust/distrust the pill.

### Security specialist
- **Token:** Reuse server-only PAT; never return token or raw GitHub errors to browser — map to safe messages.  
- **Cron:** If adding `/api/cron/...`, protect with `CRON_SECRET` header and **admin-only** or Vercel cron IP assumptions — follow existing project patterns.  
- **Webhook (future):** `X-Hub-Signature-256` verification mandatory if ever implemented.

### GDPR compliance
- **Retention:** Keeping rows in DB is **not** a GDPR violation per se if lawful basis and retention policy are documented; **hiding** from default queue is a UX/product choice.  
- **Minimization:** Sync stores **state + timestamps**, not issue body from GitHub.  
- **Erasure:** If user requests deletion, feedback rows may need redaction workflow — flag for policy, out of scope for v1 unless required.

### API contract & migration
- **Additive migration:** `githubIssueState` `VARCHAR` or enum `OPEN | CLOSED | UNKNOWN`, `githubSyncedAt` `TIMESTAMP` nullable.  
- **List API:** Optional `queue=active|all` (active = exclude `DONE`, `DISCARDED`, and optionally `githubIssueState=CLOSED` when linked). Document query contract in README.  
- **New route (optional):** `POST /api/admin/feedback/[id]/github/sync` or query param on GET detail to avoid overloading PATCH.

---

## Round 2 — Tech Lead synthesis

### Agreements (high confidence — 5+ specialists)
- Default queue should **not** show “completed” work unless the operator opts in.  
- Persist **GitHub issue state** + **sync timestamp** server-side; display in UI.  
- Implement **on-demand refresh** before background automation.  
- Visual alignment with **existing admin dashboard** tokens (not a second design language).  
- **Additive** schema and APIs.

### Conflicts resolved

| Topic | Resolution |
|--------|--------------|
| Delete vs hide vs auto-`DONE` | **Do not hard-delete** feedback for audit; **default filter “Active”** hides `DONE`/`DISCARDED` and optionally closed GitHub issues; offer **“Mark done”** / existing triage. Optional automation: **when GitHub closed → set `DONE`** with `AdminActivity` log (config flag). |
| Webhook vs polling vs on-demand | **Phase A:** on-demand **Refresh** + list/detail read model. **Phase B:** scheduled job for stale linked issues. **Phase C (later):** webhooks if scale requires. |
| URL state for selected row | **Should-have:** `?id=` sync for supportability; can follow slice 1 if timeboxed. |

### Synthesised implementation plan

#### Slice 1 — UX / Pink Ink (no schema)
- Restructure `FeedbackWorkspace`: remove redundant nesting; align classes with dashboard sections; shared **toolbar** (search, filters, **view toggle**: Active / All).  
- **Default `queue=active`** behaviour: client sends `status` exclude list or server interprets `?queue=active` (exclude `DONE`, `DISCARDED`).  
- SCSS: replace hardcoded `#fff` with variables; harmonise radii/shadows; improve empty/loading states.  
- **Accessibility:** landmarks, focus order between list and detail, live region for sync result.

#### Slice 2 — GitHub state persistence
- Migration: `githubIssueState`, `githubSyncedAt`.  
- `src/lib/github/issue-status.ts`: fetch issue by number from `GITHUB_FEEDBACK_REPO`, map `state` + optional `state_reason`.  
- `POST /api/admin/feedback/[id]/github/sync` (admin-only): updates DB + returns JSON for UI.  
- `FeedbackDetailPanel`: GitHub **panel** with pill + Refresh + last synced.  
- `FeedbackQueue`: optional small icon/badge for linked+closed on list rows (after sync).

#### Slice 3 — Automation (optional)
- Vercel Cron (or similar) hitting secured route: process feedback where `githubIssueUrl` set and `githubSyncedAt` older than N hours, with strict rate limit.  
- Optional: auto `triageStatus=DONE` when GitHub closed (feature flag env).

### Quality gates (checklist alignment)
- Critical: authz on all new routes; no secret leakage.  
- High: Zod validation; Prisma migration; error handling for GitHub API failures.  
- Medium: operator-visible sync timestamp; audit log for auto-done if enabled.

### Confidence
**86%** — well-scoped; main risk is GitHub API rate limits and product policy on auto-`DONE`.

---

## Round 3 — Devil’s Advocate

**Verdict:** `CHALLENGES_FOUND`  
**Highest severity:** `MEDIUM`

1. **Product ambiguity:** “Active” excluding closed GitHub issues **before** first sync may hide items that are actually closed on GitHub — operators need clear **“Unknown (never synced)”** vs **Open** vs **Closed** semantics.  
2. **Automation trust:** Auto-setting `DONE` when GitHub closes can **desync** from internal triage (issue closed but work not shipped). Mitigation: default off or require explicit org setting.  
3. **Multi-repo / transfer:** If an issue moves repo or number changes, stored URL/number may break — document limitation; v1 assumes stable `GITHUB_FEEDBACK_REPO`.  
4. **Concurrency:** Two admins refreshing simultaneously — harmless overwrite if last-write-wins; still log sync in activity.

**Concessions:** On-demand refresh + visible timestamp is low-risk and high value; default Active queue is the right fix for “pile up” without deleting audit data.

---

## File-level implementation map (for later PRs)

| Action | File / area |
|--------|----------------|
| MODIFY | `FeedbackWorkspace.tsx`, `FeedbackQueue.tsx`, `FeedbackDetailPanel.tsx` |
| MODIFY | `app/(protected)/admin/admin.scss` (feedback workspace block) |
| MODIFY | `app/api/admin/feedback/route.ts` (`queue=active` or equivalent) |
| CREATE | `app/api/admin/feedback/[id]/github/sync/route.ts` (or sibling) |
| CREATE | `src/lib/github/issue-status.ts` (REST fetch + types) |
| MODIFY | `prisma/schema.prisma` + migration |
| MODIFY | `GET /api/admin/feedback/[id]` response shape (include new fields) |
| OPTIONAL | `app/api/cron/feedback-github-sync/route.ts` + `vercel.json` cron |
| MODIFY | `AdminActivity` details for `feedback_github_sync` / auto-done |

---

## Summary for stakeholders

- **“Pile up”** is addressed by **product semantics**: keep an audit trail in the DB, but default the UI (and list API) to an **Active** queue. Operators can switch to **All** when needed.  
- **GitHub truth** is addressed by **persisting issue state**, showing **last synced**, and **refresh** (then optional cron).  
- **Beauty / Pink Ink** is addressed by **reusing dashboard section DNA** (surfaces, shadows, radii, type scale) and **clearer two-pane IA**, not new colors.

---

## Checkpoint (AMAC)

- **Next step:** Approve slices → implement Slice 1 → Slice 2 → optional Slice 3.  
- **Estimated effort:** Slice 1: 0.5–1 d; Slice 2: 1–1.5 d; Slice 3: 0.5 d + ops.
