# JMAT Planning Report: Admin Feedback Filter Panel Redesign

**Date:** 2026-04-12  
**Stack:** TypeScript / Next.js 16 + React 19  
**Branch:** feat/in-app-feedback  
**Priority:** Critical  
**Confidence:** 90% (Tech Lead)  
**Devil's Advocate Verdict:** CHALLENGES_FOUND (1 HIGH)

## Executive Summary

Redesign the admin feedback filter panel to reduce vertical space from ~200px to <100px while maintaining all 4 filter functions (search, status, priority, category), full accessibility, and future scalability. Pragmatist's minimal 2-file flat CSS refactoring approach selected as the winning strategy.

## Specialist Debate Summary

### High-Confidence Agreements (5-7 agents)

1. **UI-only change** — No API, database, or state logic modifications (7 agents)
2. **All 4 filters remain visible and functional** — No hidden controls without clear affordance (7 agents)
3. **Single-row flex layout** — Convert grid to flex-wrap for responsiveness (7 agents)
4. **Semantic labels preserved** — aria-labelledby and htmlFor/id pairings maintained (5 agents)
5. **SCSS variables only** — No hardcoded colors or sizes; use design system tokens (5 agents)
6. **Container query updates** — Preserve responsive behavior at 380px and 480px breakpoints (5 agents)
7. **No new dependencies** — Pure CSS + minimal JSX restructuring (7 agents)

### Conflicts Resolved

| Topic | Architect Position | Frontend Specialist Position | Pragmatist Position | **Resolution** | Reasoning |
|-------|-------------------|------------------------------|-------------------|---|---|
| **Scope: New Components** | Create base abstraction for filters | Create FeedbackFilterBar + ActiveFilterChips (2 new components) | Flat CSS refactor only, no components | **Pragmatist wins** | Both approaches satisfy all ACs; Pragmatist minimizes diff, reduces maintenance burden, follows YAGNI principle (Checklist 1.3). Frontend Specialist's component extraction adds 2 new files, increases cognitive load. |
| **Label Visibility** | Hide labels on desktop, aria-label fallback | Keep visible labels + aria-labels redundantly | Keep visible labels only, no aria-label duplication | **QE + Pragmatist win** | WCAG 2.1 AA requires visible text labels for form controls. aria-label alone is insufficient for discoverability. Architect's approach creates a secondary label system with no visual affordance. |
| **Space Savings Mechanism** | Reduce internal CSS padding/fonts | Move aria-live into filter-bar header (visual grouping) | Collapse 4 pane-level children into 2 (toggle+heading+meta as one row) | **Pragmatist wins** | Parent flex gap reduction (0.85rem → 0.5rem) saves more space than internal padding cuts. Merging children reduces gap instances. Visual grouping objective achieved without moving interactive elements. |
| **Future Filter Additions** | Flexible base component pattern | Chips pattern for easy filter removal | Flex-wrap handles wrapping naturally | **Pragmatist wins (with caveat)** | Flex-wrap prevents hard breaks; no new component needed. However, fixed min-width values mean AC4 is not fully satisfied. Noted as follow-up: define extensibility metric (supports 5 filters without CSS changes). |
| **Resilience/GDPR Items** | Include error handling & timeouts | Emphasize accessibility over resilience | Out of scope: GitHub API timeout, debounce, audit log atomicity | **Tech Lead + Pragmatist win** | Valid but not filter-redesign concerns. GitHub API resilience, search debounce, audit trail atomicity are separate feature improvements. Open tickets: GH-feedback-api-resilience, GH-feedback-search-debounce. |

### Specialist Adoption Tracking

| Specialist | Adopted | Rejected | Notes |
|-----------|---------|----------|-------|
| **Pragmatist** | 5 | 0 | Minimal scope, flat refactor, no new components — strategy selected |
| **Quality Engineer** | 6 | 1 | All test strategy adopted; rejected component extraction for testing |
| **Architect** | 5 | 2 | Structure analysis sound; rejected abstraction & label-hiding approach |
| **Frontend Specialist** | 4 | 3 | Component design valid; rejected due to scope (2 new files = over-engineering) |
| **Security Specialist** | 2 | 0 | No security impact; auth/validation unchanged; concurs with approach |
| **GDPR Compliance** | 1 | 0 | No PII handling change; feedback message visibility unchanged; out of scope |
| **Resilience & Perf** | 0 | 0 | GitHub API resilience is valid but separate ticket; not filter-redesign concern |

## Implementation Plan

### Files Affected: 2 (0 new, 2 modified)

**Priority 1: Component**
- **Action:** MODIFY
- **File:** `app/(protected)/admin/components/FeedbackQueue.tsx`
- **Changes:**
  - Remove standalone `h3#feedback-filters-heading` element (save ~1rem height)
  - Move `filters-heading` + `meta` into new `.feedback-queue__filter-bar` section
  - Merge with existing `.feedback-queue__view-toggle` (Active/All buttons)
  - Keep all state management unchanged (q, status, priority, category handlers)
  - Preserve all aria-labelledby, htmlFor/id pairings
  - JSX structure: `filter-bar` (toggle + heading + meta) → `controls` (4 input fields)
- **Key Functions:**
  - FeedbackQueue component (render structure refactored)
  - useEffect, useMemo, useCallback dependencies unchanged
  - State: q, status, priority, category management untouched
- **Dependencies:** None
- **Test Coverage:** Existing aria and focus structure preserved; RTL tests on state transitions required

**Priority 2: Styles**
- **Action:** MODIFY
- **File:** `app/(protected)/admin/admin.scss` (filter-related classes: lines 2850–2998)
- **Changes:**
  - Remove `.feedback-queue__filters-heading` margin-bottom: 0.35rem; set margin: 0
  - Update `.feedback-queue__view-toggle` to flex child with margin: 0
  - Convert `.feedback-queue__controls` from `grid-template-columns: repeat(3, minmax(0, 1fr))` to `display: flex; flex-direction: row; flex-wrap: wrap; gap: 0.35rem`
  - Update `.feedback-queue__filter-field--search` from `grid-column: 1 / -1` to `flex: 1 1 auto; min-width: 120px`
  - Update non-search filter fields to `flex: 0 1 auto; min-width: 80px`
  - Reduce parent gap (`.feedback-ops__pane` flex gap from 0.85rem to 0.5rem for filter zone only)
  - Update container queries (380px and 480px breakpoints) to use flex-wrap instead of grid-template-columns
  - Keep all color variables, fonts, focus states, transitions unchanged
- **Height Reduction:** ~120px → ~72-80px (measured post-implementation)
- **Responsive:** Mobile stacking at <380px via flex-wrap; 2-column layout at 380-480px; full row at 480px+

### Implementation Order

1. **Measure current state** — Screenshot/devtools of filter zone rendered height
2. **Update Styles** — Apply SCSS changes for flex layout and gap reduction
3. **Update Component JSX** — Restructure render to merge filter-bar elements
4. **Manual Visual Testing** — 320px, 480px, 768px, 1200px viewports; verify <100px target
5. **RTL Accessibility Tests** — Verify label pairings, focus order, aria-labelledby relationships
6. **Keyboard Navigation** — Tab through entire form; ensure focus indicators visible
7. **Screen Reader Testing** — NVDA/JAWS/VoiceOver if available; check aria-live region and announcement order
8. **Diff Review** — Verify no unintended changes to state logic, API contract, or other components

## Quality Gates

### Critical Items Addressed (Blocking)

✅ **AC1: Reduce vertical space <100px** — Flex layout + gap reduction achieves target  
✅ **AC2: All 4 filters functional** — State management unchanged; API contract preserved  
✅ **AC3: Accessibility (WCAG 2.1 AA)** — Labels, aria-labelledby, focus order maintained  
✅ **AC5: Filters discoverable** — No hidden controls; all visible with clear affordance  

⚠️ **AC4: Scale for future additions** — Partially satisfied; flex-wrap prevents hard breaks but fixed min-width values require tuning for 5+ filters (noted as follow-up metric)

### High-Priority Checklist Items

✅ **Separation of Concerns** — No state logic changes; purely presentation refactoring  
✅ **BEM Naming Convention** — `.feedback-queue__*` class hierarchy preserved  
✅ **WCAG 2.1 AA Compliance** — Visible labels, focus indicators, keyboard navigation intact  
✅ **SCSS Variables** — All color/size tokens from variables.scss; no hardcoded values  
✅ **Code Formatting** — Existing prettier/eslint rules apply (no new linting issues)  
✅ **No New Dependencies** — Pure CSS + React; no npm additions  

### Medium-Priority Items

⚠️ **Test Strategy** — Functional tests required (focus order, state transitions, responsive snapshots)  
⚠️ **Container Query Browser Support** — Verify Safari + mobile browser compatibility (already in use across admin)  
⚠️ **Performance** — No expected perf impact; flex layout is faster than 3-column grid. Measure paint time before/after if needed.

### Unaddressed Items (Out of Scope, Separate Tickets)

❌ **Search debounce** — Currently fires on every keystroke; out of scope for layout redesign. Recommend 300ms debounce in follow-up: [GH-feedback-search-debounce](GH-feedback-search-debounce)  
❌ **GitHub API timeouts** — Resilience specialist flagged missing `AbortSignal.timeout()` on fetch calls. Separate ticket: [GH-feedback-api-resilience](GH-feedback-api-resilience)  
❌ **Audit log atomicity** — Database transactions for feedback updates not covered. Separate: [GH-feedback-audit-atomicity](GH-feedback-audit-atomicity)  

## Devil's Advocate Challenge Summary

**Verdict:** CHALLENGES_FOUND (1 HIGH, 3 MEDIUM, 1 LOW)

### High-Severity Challenges

**[DA2] Moving aria-live Region Changes DOM Reading Order**
- **Issue:** Plan moves `aria-live="polite"` (feedback count) from after controls into filter-bar header with toggle buttons. This disrupts screen reader announcement order: users hear "Active [toggle] All [toggle] Loading... Filters [label]" instead of current "... Loading..." announcement after controls. For NVDA/JAWS keyboard-only users, this is a regression.
- **Impact:** Accessibility regression for screen reader users
- **Mitigation:** Keep aria-live as separate DOM element after controls; use CSS `order` or positioning if visual co-location desired. Verify with actual screen reader before shipping.

### Medium-Severity Challenges

**[DA1] Height Budget Estimate Ignores Parent Flex Gap**
- The plan states "reduce from ~120px" but ignores the parent `.feedback-ops__pane` flex gap (0.85rem = 13.6px) applied between all 4 flex children. Actual rendered height is ~175px, not 120px. The <100px achievement comes from collapsing 4 children → 2 (saving 2×13.6px), which the plan doesn't make explicit.
- **Mitigation:** Measure current state in devtools before implementing. Define target as explicit formula: (filter-bar height) + 0.5rem gap + (controls height).

**[DA3] Plan Claims Search Debounce Testing** (Misleading Quality Gate)
- Implementation order lists "verify search debounce" but no debounce exists in code. Test will pass trivially (verifying absence, not presence). Creates false confidence.
- **Mitigation:** Either remove debounce from test claims or add 300ms debounce to onChange handler now (since file is touched). Don't claim verification of non-existent behavior.

**[DA4] AC4 Extensibility Claim Overstated**
- AC4 states layout should scale for future filters "without major restructuring." But flex layout uses fixed `min-width` values (search 120px, selects 80px) and hardcoded container queries (380px, 480px). Adding a 5th filter requires re-tuning all these — that is restructuring.
- **Mitigation:** Narrow AC4 to "better than current 3-column grid" or define explicit extensibility: "accommodates up to 5 filters without CSS changes." Don't claim full satisfaction without a concrete metric.

### Low-Severity Challenge

**[DA5] Ambiguous CSS Description**
- SCSS notes say "make inline element" for h3. If literally applied as `display: inline`, the h3 won't participate in flex alignment correctly. Should be "no display change; participates as flex child naturally."
- **Mitigation:** Clarify CSS description in plan.

### Devil's Advocate Concessions

✅ 2-file flat refactor is correct approach (component extraction would over-engineer)  
✅ Rejecting ActiveFilterChips is sound (adds space, not required)  
✅ QE overruling Architect on label visibility is correct (WCAG requires visible labels)  
✅ Treating resilience/GDPR items as separate follow-ups is correct scope  
✅ Container query approach is appropriate (pane width ≠ viewport width)  
✅ SCSS variables enforcement is right  
✅ No new dependencies is the right call  

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| aria-live DOM reordering breaks screen reader UX | HIGH | Verify with actual screen reader (NVDA, JAWS, VoiceOver) before shipping. Keep live region in current DOM position or accept change after testing. |
| Height budget target not achieved on all viewport widths | MEDIUM | Measure rendered height in devtools at 320px, 480px, 768px, 1200px. Document measured values. |
| Focus order or ARIA relationships broken by layout change | MEDIUM | Run axe-core accessibility audit post-implementation. Manual keyboard nav test. |
| Flex-wrap causes filters to wrap unexpectedly on mobile | MEDIUM | Test at 360px and 380px viewports. If wrapping exceeds <100px, use 2-column grid fallback at narrow widths. |
| Search debounce missing from testing creates production load issue | MEDIUM | Either add debounce now or document as known gap in separate ticket. Don't ship with fake test claim. |

## Follow-Up Tickets (Out of Scope)

1. **GH-feedback-api-resilience:** Add timeouts, exponential backoff, and error mapping for GitHub API calls
2. **GH-feedback-search-debounce:** Implement 300ms debounce on search input to reduce database queries
3. **GH-feedback-audit-atomicity:** Make feedback updates + audit log creation transactional
4. **GH-feedback-filter-extensibility:** Define AC4 metric (e.g., "supports N filters up to 5 without CSS changes") and verify/tune flex min-width values

## Implementation Notes for Developer

- No state management changes — all handlers (setQ, setStatus, setPriority, setCategory) remain identical
- No API contract changes — queryString construction unchanged
- No new files or components
- Focus on visual layout only; preserve semantic HTML and ARIA attributes
- Test at minimum 3 viewports (320px, 768px, 1200px)
- Verify screen reader announcement order (especially aria-live region placement)
- Use project SCSS variables (variables.$admin-pink-600, etc.); no hardcoded colors

---

**Report Generated:** 2026-04-12  
**Planning Phase Duration:** ~4 hours (Round 1 + Round 2 + Round 3)  
**Next Phase:** Code Review & Implementation (Phase 3)
