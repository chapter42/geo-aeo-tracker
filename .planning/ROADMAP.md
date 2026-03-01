# Roadmap: GEO/AEO Tracker — Password Protection

## Overview

This project adds a shared-password gate to an existing Next.js 16 App Router application. The entire app (all pages and API routes) is blocked behind a single password stored in an environment variable. The implementation is deliberately minimal — all auth code lives in new files only, preserving upstream merge compatibility. Phase 1 delivers a fully working, secure gate. Phase 2 polishes the login experience to match the app's visual style.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Core Auth Gate** - Fully working password gate with defense-in-depth API protection and zero upstream file modifications
- [ ] **Phase 2: Login UX** - Styled login page matching the app's existing Tailwind dark theme
- [ ] **Phase 4: Login Page Styling** - Style login page to match app theme (gap closure for AUTH-07)
- [ ] **Phase 5: API Defense-in-Depth & Prompt Cap Fix** - Add verifySession to API routes, remove 50-prompt cap (gap closure for AUTH-05, BULK-01)

## Phase Details

### Phase 1: Core Auth Gate
**Goal**: Users without a valid session are blocked from every page and API route; users who enter the correct password gain access and stay logged in across sessions
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, FORK-01, FORK-02
**Success Criteria** (what must be TRUE):
  1. Visiting any app page without a session cookie redirects to /login
  2. Entering the correct password on /login grants access and persists across browser sessions
  3. Calling /api/scrape, /api/audit, or /api/analyze without a valid cookie returns 401
  4. Static assets (_next/static, _next/image, favicon) load without authentication
  5. The password is read from the SITE_PASSWORD environment variable — no hardcoded values exist in source
**Plans:** 2 plans
Plans:
- [x] 01-01-PLAN.md — Auth foundation: jose install, lib/auth.ts session utilities, login API endpoint, env config
- [x] 01-02-PLAN.md — Auth gate: proxy.ts request interceptor, login page UI, end-to-end verification

### Phase 2: Login UX
**Goal**: The login page looks like it belongs to the app — dark theme, consistent styling — so the user experience is cohesive from first visit
**Depends on**: Phase 1
**Requirements**: AUTH-07
**Success Criteria** (what must be TRUE):
  1. The login page uses the same dark background, typography, and color palette as the main dashboard
  2. The login form is visually distinct from a bare browser default (styled inputs, button, error state)
**Plans**: TBD

### Phase 3: Bulk Prompt Import
**Goal**: Users can paste multiple prompts at once (one per line) in the Prompt Hub tab instead of adding them one-by-one, with automatic deduplication and summary feedback
**Depends on**: Nothing (independent feature, no auth dependency)
**Requirements**: BULK-01
**Success Criteria** (what must be TRUE):
  1. A "Bulk Import" button appears next to the existing "Add" button in the Prompt Hub tab
  2. Clicking it toggles a textarea where users can paste multiple prompts (one per line)
  3. Duplicate prompts are silently skipped with a summary showing added/skipped counts
  4. Empty lines and whitespace are automatically cleaned
  5. No changes to PromptHubTabProps interface (zero upstream impact)
**Plans:** 1/1 plans complete
Plans:
- [ ] 03-01-PLAN.md — Bulk import UI: toggle button, textarea, parsing/dedup logic, summary feedback

### Phase 4: Login Page Styling
**Goal**: The login page uses the app's color palette, typography, and component styling so it looks cohesive with the dashboard — not a bare default form
**Depends on**: Phase 1 (login page exists)
**Requirements**: AUTH-07
**Gap Closure**: Closes AUTH-07 from v1.0 audit (Phase 2 was never executed)
**Success Criteria** (what must be TRUE):
  1. The login page uses the same background color, text colors, and accent colors as the main dashboard (th-* CSS custom properties)
  2. The login form inputs and button use the app's existing CSS classes (bd-input, bd-btn-primary)
  3. The login page is visually distinct from a bare browser default
**Plans**: TBD

### Phase 5: API Defense-in-Depth & Prompt Cap Fix
**Goal**: API route handlers independently verify session cookies (true defense-in-depth beyond proxy), and the 50-prompt cap is removed to match BULK-01's "no limit" requirement
**Depends on**: Phase 1 (verifySession exists in lib/auth.ts)
**Requirements**: AUTH-05, BULK-01
**Gap Closure**: Closes AUTH-05 partial (verifySession unused) and BULK-01 integration gap (50-prompt cap) from v1.0 audit
**Success Criteria** (what must be TRUE):
  1. Each API route handler (/api/scrape, /api/audit, /api/analyze) calls verifySession() and returns 401 if invalid — independent of proxy
  2. The .slice(0, 50) cap on customPrompts in sovereign-dashboard.tsx is removed
  3. Bulk import can add more than 50 prompts without silent truncation
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Auth Gate | 2/2 | Complete | 2026-02-28 |
| 2. Login UX | 0/TBD | Not started | - |
| 3. Bulk Prompt Import | 1/1 | Complete   | 2026-03-01 |
| 4. Login Page Styling | 0/TBD | Not started | - |
| 5. API Defense & Prompt Cap | 0/TBD | Not started | - |
