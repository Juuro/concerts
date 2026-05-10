# JMAT Codebase Evaluation: concerts

**Date:** 2026-04-14  
**Stack:** typescript / nextjs  
**Overall Health Score:** 64/100

## Domain Scores

| Domain | Score | Assessment |
|--------|-------|------------|
| Architecture | 7/10 | Layering mostly coherent with some route/service coupling. |
| Quality | 6/10 | Strong tests in libs, weak API route test coverage. |
| Security | 7.1/10 | Auth is strong; dependency/rate-limit gaps remain. |
| GDPR | 6/10 | Good foundations but retention/export coverage gaps. |
| API Contract | 6/10 | Inconsistent validation/migration safety hardening. |
| Resilience & Perf | 7/10 | Good baseline with timeout/clamp gaps. |
| Frontend | 6/10 | Solid UX baseline, a11y/token consistency gaps. |
| Pragmatism | 6/10 | Some complexity and migration debt hotspots. |

## Coding Checklist Scorecard

| # | Section | Status |
|---|---------|--------|
| 1 | Architecture Design | PARTIAL |
| 2 | Security Input Validation | PARTIAL |
| 3 | Error Handling | PARTIAL |
| 4 | Logging Observability | FAIL |
| 5 | Performance Scalability | PARTIAL |
| 6 | Testing | PARTIAL |
| 7 | Naming Documentation | PARTIAL |
| 8 | Database Data Access | PARTIAL |
| 9 | Frontend | N/A |
| 10 | Resilience External Integrations | PARTIAL |
| 11 | Code Quality | PARTIAL |
| 12 | Gdpr Data Compliance | PARTIAL |
| 13 | Api Contract Migration Safety | PARTIAL |

**Result: 0/13 passing**

## CRITICAL Findings (0)

## HIGH Findings (14)
- F-DEP-001: Next.js 16.1.6 has multiple high-severity published advisories (DoS, request-smuggling)
- F-DEP-002: Critical axios advisories transitively introduced via contentful SDK
- F-SEC-001: Venue search rate limiter fails open when map reaches capacity
- F-VAL-001: Input validation inconsistent across mutation endpoints — Zod only in newer routes
- F-OBS-001: No structured logger; widespread console.error in server paths with PII/exposure risk
- F-TEST-001: Zero API route integration tests across 42 route handler files
- F-RES-001: No timeout on Photon reverse-geocoding fetch in concert create flow
- F-RES-002: User-controlled pagination limit not clamped to safe upper bound
- F-PRAG-001: Pagination function is ~280-line complexity hotspot mixing multiple responsibilities
- F-PRAG-002: Migration-era dual execution paths in statistics runtime code
- F-FE-001: Hardcoded hex/rgba values instead of SCSS design tokens in component styles
- F-GDPR-001: Feedback retention enforcement is optional — skipped when env var unset
- F-GDPR-002: User data export omits AppFeedback and consent data (Art. 15 incomplete)
- F-MIGR-001: Migration SQL uses bare DROP INDEX without IF EXISTS or CONCURRENTLY

## Cross-Cutting Themes
- Validation inconsistency: Zod is used correctly in newer endpoints (feedback, export) but core mutation routes still use ad-hoc truthy checks. This inconsistency undermines contract reliability, security posture, and API documentation quality simultaneously.
- Migration debt accumulation: Deprecated compatibility fields, dual execution paths in stats, legacy Concert.userId→UserConcert migration, and unsafe migration SQL patterns indicate a pattern of incomplete migration follow-through that compounds complexity over time.
- Observability gap: No structured logging, inconsistent error capture across CRUD handlers, raw console.error with PII exposure risk, and no correlation IDs create a systemic observability blind spot that impacts debugging, security monitoring, and GDPR compliance.
- Route handler bloat: Route handlers and pages mix transport concerns, business logic, validation, cache invalidation, and Prisma queries. This pattern makes handlers hard to test, creates duplication, and resists incremental improvement.
- Dependency hygiene: Framework (Next.js) and transitive (axios via contentful) vulnerabilities are present alongside an unused dependency (react-helmet). Active dependency management and CI audit gates are not in place.

## Strengths
- Authentication & Authorization: Session and role checks are consistently enforced across protected and admin endpoints. Object-level authorization verifies user ownership on concert mutations. Better Auth integration is centralized with typed session extensions.
- Domain Model Design: Multi-tenant attendance separation (Concert + UserConcert) is well-modeled with useful indexes and explicit Prisma relations. Concert mutation logic handles deduplication, attendance linking, and fork behavior cohesively.
- External Integration Resilience: Venue search runs independent sources in parallel with per-source timeouts and fallback empty results. Last.fm, MusicBrainz, and Ticketmaster clients include cooldown-based circuit breakers, request dedup, and bounded retries.
- Pagination Architecture: Keyset cursor-based pagination with typed ConcertFilters and PaginatedConcerts prevents ad-hoc shape drift and supports bidirectional navigation with anchor recovery.
- Privacy Foundations (RTBF & Consent Gating): Prisma relations use explicit onDelete strategies enabling user erasure. PostHog starts only when feature-enabled and explicit consent is granted. Sentry configured with sendDefaultPii: false. Email-like strings are redacted before GitHub sync.
- Frontend Interaction Quality: Combobox/listbox keyboard semantics implemented (role=combobox, aria-activedescendant, arrow/enter/escape). Global reduced-motion handling present. No raw <img> usage. Dialog close control has accessible naming.
- Test Infrastructure: Vitest configured with strict 80% coverage thresholds (perFile=true). 350 passing tests covering core lib modules (concert mutations, pagination, venue search, export, feedback schemas). Good naming conventions in existing tests.
- Injection Prevention: Prisma parameterized queries used throughout. Raw SQL uses tagged template parameters (venues, pagination). No string-concatenated SQL found.

## Top 5 Recommended Actions
- [S] Upgrade Next.js to >=16.2.3 and resolve contentful/axios transitive chain -- F-DEP-001, F-DEP-002
- [S] Fix venue search rate limiter to fail-closed (return 429 at capacity) -- F-SEC-001
- [S] Add AbortController timeout (3-5s) to Photon geocoding fetch and clamp pagination limit to max 100 -- F-RES-001, F-RES-002
- [S] Set mandatory default FEEDBACK_RETENTION_DAYS (e.g. 90); fail health check when unset -- F-GDPR-001
- [M] Introduce shared Zod schemas for concert, profile, and band mutation routes; export inferred types for client parity -- F-VAL-001

## Devil's Advocate
**Verdict:** CHALLENGES_FOUND
- [HIGH] score_accuracy: The overall health score is not trustworthy because 20 of 33 retained findings are explicitly unverified, yet they still influence domain narratives and prioritization.
- [MEDIUM] score_accuracy: The weighting method (security/gdpr 1.5x) is applied without confidence weighting, so low-confidence security/GDPR findings can distort the weighted total disproportionately.
- [HIGH] missing_problem: Dependency risk coverage is incomplete: Vite advisories detected in context are not represented as a finding or action item, creating a false sense that dependency risk is fully captured.
- [HIGH] priority: Priority ordering is inconsistent with assigned severity: a declared HIGH finding ('zero API route integration tests across 42 route handlers') is deprioritized below medium-importance refactor/debt work.
- [MEDIUM] false_positive: At least one security finding is likely overstated: missing API CSP/security headers is treated as a gap without proving an exploitable condition for JSON API handlers.
- [HIGH] systemic: The evaluation process has a systemic verification bottleneck: too many findings are carried forward as 'skipped/lower confidence', which turns the report into a hypothesis list instead of an actionable audit.

## Evaluation Stats
- Specialists: 8
- Findings: 33 (15 verified, 0 filtered)
- Root-cause groups: 33
