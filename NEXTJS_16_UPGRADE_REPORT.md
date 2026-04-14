# Next.js 16 Upgrade Report

## Summary
- **Current Version**: ^16.1.6 (upgraded from ^15.5.10)
- **On Beta**: No
- **Target Version**: 16 (stable channel)
- **Package Manager**: yarn
- **Monorepo**: No (single app at project root)

## Phase 1: Pre-Flight Checks
- [x] Monorepo structure: Not a monorepo (no workspaces, pnpm-workspace, lerna, nx, turbo)
- [x] Working directory: /Users/juuro/Repos/concerts
- [x] Node.js version: v22.22.0 (≥ 20.9 ✓)
- [x] TypeScript: ^5.9.3 (≥ 5.1 ✓)
- [x] Browser support: Chrome 111+, Edge 111+, Firefox 111+, Safari 16.4+ (informational)
- [x] Current Next.js: ^15.5.10
- [ ] **Git working directory: NOT CLEAN** — Modified: CLAUDE.md; Untracked: .cursor/mcp.json, .mcp.json, .vscode/
  - **Codemod requires clean git state. Stash or commit before running codemod.**

## Phase 2: Codemod Execution
- [x] Manual upgrade applied (yarn add next@latest react@latest react-dom@latest)
- [x] Build verification: **SUCCESS** (yarn build)
- [ ] Browser verification recommended

## Phase 3: Issues Requiring Manual Fixes (Pre-Analysis)
Based on codebase scan, these manual fixes will be needed **after** the codemod:

### M. revalidateTag API Changes
**Files:** `app/api/concerts/route.ts`, `app/api/concerts/[id]/route.ts`
- Route Handlers (POST/PUT/DELETE) call `revalidateTag(tag)` — add profile: `revalidateTag(tag, 'max')`

### N. Middleware to Proxy Migration
**Files:** `middleware.ts`
- Rename to `proxy.ts`, rename export `middleware` → `proxy`
- Codemod may handle this; verify after run

### E. Lint Command Migration
**Files:** `package.json`
- `"lint": "next lint"` → `"lint": "eslint ."`
- Or run: `yarn dlx @next/codemod@canary next-lint-to-eslint-cli .`

### No Issues Found For:
- A. AMP, runtime config, PPR, dynamicIO, unstable_rootParams, devIndicators — none used
- B. Parallel routes — no @ folders
- C. Image security — using remotePatterns; no local images with query strings
- D. Image defaults — review if needed
- F. turbopackPersistentCachingForDev — not used
- G. --turbopack flags — not in scripts
- H. eslint in next.config — not present
- I. serverComponentsExternalPackages — not used
- K. Async APIs — project already uses `await params`, `await searchParams`, `await headers()`
- L. ViewTransition — not used
- P. unstable_noStore — not used
- Q. Deprecated features — next/legacy/image, images.domains — not used

## Phase 4: Manual Changes Applied
- [x] revalidateTag: added "max" profile in concert API routes
- [x] middleware → proxy: renamed to proxy.ts
- [x] Lint: eslint ., flat config
- [x] Icons: removed Edge runtime (incompatible with generateImageMetadata in v16)
- [x] Build: SUCCESS
- [ ] Browser verification

## Next Steps
1. Run `yarn dev` and verify key routes in browser
2. Restore stashed changes: `git stash pop` (CLAUDE.md was stashed)
3. Address new React 19 lint rules if desired
4. Commit upgrade
