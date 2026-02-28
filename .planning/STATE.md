# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** The whole app is gated behind a shared password — no unauthenticated access to any page or API route
**Current focus:** Phase 1 — Core Auth Gate

## Current Position

Phase: 1 of 2 (Core Auth Gate)
Plan: 2 of 2 in current phase (Phase 1 complete)
Status: Phase 1 complete — ready for Phase 2
Last activity: 2026-02-28 — Plan 01-02 completed

Progress: [██████░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 4min
- Total execution time: 7min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-auth-gate | 2 | 7min | 4min |

**Recent Trend:**
- Last 5 plans: 2min, 5min
- Trend: Baseline

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Shared password over user accounts — simplest, no DB needed, minimal code changes
- [Init]: Gate entire app including /demo — per PROJECT.md direction
- [Init]: Environment variable (SITE_PASSWORD) for password — fits Vercel deployment model
- [Init]: All auth code in new files only — zero upstream file modifications for fork compatibility
- [Research]: Use proxy.ts (not middleware.ts, deprecated in Next.js 16.1.6) with jose for JWT signing
- [Research]: Defense-in-depth required — API routes must independently call verifySession() (CVE-2025-29927)
- [01-01]: No server-only import in lib/auth.ts — proxy.ts imports it; server-only would crash proxy context
- [01-01]: Lazy getEncodedKey() validates AUTH_SECRET at call time not import time — avoids build-time crash
- [01-01]: timingSafeEqual requires length check first — throws on unequal-length buffers (Pitfall 7)
- [01-02]: proxy.ts exports `proxy` (not `middleware`) — Next.js 16 convention; middleware.ts deprecated
- [01-02]: API routes return 401 JSON (not redirect) — machine clients expect JSON, not HTML redirect
- [01-02]: Client-side router.push() after login — avoids Set-Cookie race condition on server 302 (Pitfall 6 resolved)
- [01-02]: Only /login and /api/auth/login bypass auth — _next/data NOT excluded (would expose API data routes)

### Pending Todos

None.

### Blockers/Concerns

None — Phase 1 complete. Cookie race condition (Pitfall 6) resolved via client-side redirect in login page.

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 01-02-PLAN.md — auth gate complete (proxy.ts, app/login/page.tsx, human-verified end-to-end)
Resume file: None
