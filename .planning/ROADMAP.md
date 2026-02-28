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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Auth Gate | 2/2 | Complete | 2026-02-28 |
| 2. Login UX | 0/TBD | Not started | - |
