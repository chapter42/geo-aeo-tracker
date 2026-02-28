# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** The whole app is gated behind a shared password — no unauthenticated access to any page or API route
**Current focus:** Phase 1 — Core Auth Gate

## Current Position

Phase: 1 of 2 (Core Auth Gate)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-02-28 — Plan 01-01 completed

Progress: [█░░░░░░░░░] 25%

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 2min
- Total execution time: 2min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-core-auth-gate | 1 | 2min | 2min |

**Recent Trend:**
- Last 5 plans: 2min
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: Cookie race condition (Pitfall 6 in research) — test login-to-redirect flow explicitly; may need client-side redirect instead of server-side 302

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 01-01-PLAN.md — auth foundation (lib/auth.ts, login route, .env.local)
Resume file: None
