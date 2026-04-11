# AMAC Planning Report: Wider `/admin/*` layout (Pink Ink Editorial)

**Date:** 2026-04-11  
**Stack:** TypeScript / Next.js App Router / SCSS  
**Branch:** `feat/in-app-feedback` (or current admin branch)  
**Roster:** software-engineering (8 specialists)  
**Confidence (synthesis):** 88%

## Task (from product)

Make **all admin routes** (`/admin/*`) **visibly wider** than the rest of the authenticated app, treating the whole admin area as one **dashboard workspace** with sub-pages. Preserve and extend the **Pink Ink Editorial** system (surfaces, pink accent, Rubik headings, rounded cards, soft shadows).

---

## Round 1 — Eight specialist proposals (independent)

### Architect
- **Diagnosis:** `main.container` uses CSS Grid with `justify-items: center`. The only child (`admin-shell`) gets `justify-self: center` and **shrinks to max-content**, so the admin UI sits in a narrow column (~880px) inside a wider `main`.
- **Approach A (minimal):** `main.container:has(.admin-shell) { justify-items: stretch; }` plus optional `max-width` bump for admin-only `main`.
- **Approach B (structural):** Split `(protected)` into two route groups: one `layout` with `main.container` for “site” pages, one `layout` with `main.admin-main` for `/admin` only — no `:has()`.
- **Recommendation:** Start with **A** (low blast radius); move to **B** if more divergent shells are needed later.

### Quality Engineer
- **Regression targets:** Visual snapshot or Playwright smoke on `/admin`, `/admin/feedback`, `/settings` (ensure non-admin pages **unchanged**).
- **Acceptance checks:** Sidebar + content share full intended width; no horizontal overflow on 1280 / 768 / 375 widths; focus rings on sidebar links still visible.
- **Tests:** Prefer one E2E “admin layout width” assertion optional; SCSS change is primary.

### Pragmatist
- **Ship the smallest fix first:** One or two SCSS rules on `main.container:has(.admin-shell)` + bump `.admin-dashboard` `max-width` from **1400px → ~1600–1680px** (or `min(100rem, 100%)`) so the bento grid breathes.
- **Defer:** Full route-group split until a second admin-only layout requirement appears.

### Frontend Specialist (Pink Ink Editorial)
- **Visual hierarchy:** Wider canvas = **more horizontal rhythm**, not smaller type. Keep **20px card radius**, `$admin-shadow-md`, pink accent only for **primary metrics + active nav**.
- **Tokens:** Introduce optional SCSS variables: `$admin-layout-max-width`, `$admin-content-max-width`, `$admin-shell-gutter` using `clamp()` for fluid side padding (e.g. `clamp(1rem, 2.5vw, 2.5rem)`).
- **Sidebar:** Keep **~15.5rem** width; let **content** absorb extra width. Optional: slightly taller sticky sidebar alignment with header offset.

### Resilience & Performance
- **`:has()` support:** Safari 15.4+ — acceptable for this app’s audience; document fallback if corporate Safari is a concern (then use route-group layout).
- **CLS:** Width change may shift layout once; no async font-driven jump expected if tokens unchanged.
- **No new JS** for layout — CSS-only preferred.

### Security Specialist
- **No security change** from widening layout; ensure **no admin-only data** leaks via viewport assumptions.
- **CSP / inline:** N/A if only SCSS.

### GDPR Compliance
- **No new personal data** in layout; admin pages already show PII in tables — width does not change compliance posture.
- **Reminder:** Wider tables can expose more columns at once; ensure **sensitive columns** remain intentional (existing product decision).

### API Contract & Migration
- **No API or schema changes.**
- **Contract:** Pure presentation layer; admin JSON responses unchanged.

---

## Round 2 — Tech Lead synthesis

### Agreements (high confidence)
1. **Root cause** of narrow admin is **`justify-items: center`** on `.container`, not only `max-width: 1400px` on `.admin-dashboard`.
2. **Admin should stretch** to use available `main` width; **non-admin** protected pages keep current centered behavior.
3. **Pink Ink** is preserved by **tokens + spacing**, not new colors.
4. **Implementation is primarily SCSS**; optional follow-up is route-group split.

### Conflicts resolved
| Topic | Resolution |
|--------|------------|
| `:has()` vs route-group | **Use `:has(.admin-shell)` first** for speed; document **B** as escape hatch. |
| How much wider | **Stretch to `main`** first; raise **inner** `.admin-dashboard` cap to **~100rem / 1600px** so bento uses width without infinite line length on ultra-wide. |

### Implementation plan (ordered)

1. **`src/styles/layout.scss`** (or co-located global layout partial)  
   - Add `main.container:has(.admin-shell)` rules:  
     - `justify-items: stretch`  
     - Optional: `max-width: min(120rem, 100%)` so admin **`main` can exceed** the default `100rem` site column if desired.  
   - Fluid horizontal padding via `clamp()` for large screens.

2. **`app/(protected)/admin/admin.scss`**  
   - Increase `.admin-dashboard` **max-width** (currently **1400px**) to align with new shell (e.g. **100rem** or **min(100rem, 100%)**).  
   - Tune `.admin-shell__content` gutters to match Pink Ink spacing scale.  
   - Review **feedback workspace** and **management** sections for `max-width` outliers.

3. **Verification**  
   - Manual: `/admin`, `/admin/bands`, `/admin/feedback`, `/settings` (non-admin).  
   - Optional: screenshot diff or Playwright `boundingBox` width check.

4. **Docs**  
   - Short note in `CLAUDE.md` or admin section of README: “Admin uses full `main` width via `:has(.admin-shell)`.”

### Quality gates
- **Critical:** Non-admin protected routes **unchanged** visually.  
- **High:** No horizontal scroll at 1280px on dashboard.  
- **Medium:** Keyboard focus and sidebar semantics unchanged.

### Risks
| Risk | Severity | Mitigation |
|------|----------|------------|
| Old browsers without `:has` | Low | Route-group layout fallback if analytics show demand |
| Ultra-wide monitors look “too flat” | Low | Keep inner `max-width` on `.admin-dashboard` |

### Adoption tracking (synthetic)
| Specialist | Adopted | Notes |
|------------|---------|--------|
| Architect | 4/4 | `:has` first, route-group documented |
| QE | 3/3 | Visual + breakpoint checks |
| Pragmatist | 3/3 | Minimal SCSS first |
| Frontend | 4/4 | Pink Ink tokens + clamp gutters |
| Resilience | 2/2 | Safari OK |
| Security | 1/1 | N/A |
| GDPR | 1/1 | N/A |
| API Contract | 1/1 | N/A |

---

## Round 3 — Devil’s Advocate

**Verdict:** `CHALLENGES_FOUND` — **highest severity: LOW**

- **Ultra-wide readability:** Stretching without an inner cap can make **single-line titles** and **sparse bento** feel lost; **mitigation:** keep `.admin-dashboard` max-width, only widen **shell**.
- **`:has()` maintenance:** Future devs may not know why admin is special; **mitigation:** comment + docs + consider route-group if the pattern spreads.
- **Consistency creep:** Per-page `max-width` overrides in admin SCSS may **fight** the shell; **mitigation:** grep `max-width` under `admin.scss` in a follow-up pass.

**Concessions:** Route-group split is cleaner long-term; `:has` is acceptable for a single clear marker (`.admin-shell`).

---

## Recommended acceptance criteria

1. On a **≥1440px** viewport, `/admin` **content area** (sidebar + main) uses **substantially more** horizontal space than before (~880px band).  
2. **Non-admin** protected pages (e.g. settings) **match prior** width/centering.  
3. **Pink Ink** surfaces, shadows, and accent usage remain **coherent**; no new arbitrary hex outside `variables.scss` admin tokens.  
4. **No regression** at 768 / 375 for sidebar stack + scroll.

---

## Implementation status

**Applied in-repo (Phase 4-style):**

| Area | Change |
|------|--------|
| `src/styles/variables.scss` | `$admin-main-max-width` (120rem), `$admin-dashboard-inner-max-width` (100rem) |
| `src/styles/layout.scss` | `main.container:has(.admin-shell)` → `justify-items: stretch`, wider max-width, fluid horizontal padding |
| `app/(protected)/admin/admin.scss` | `.admin-dashboard` max-width uses `$admin-dashboard-inner-max-width` (was 1400px) |
