---
phase: 01-core-auth-gate
plan: 02
subsystem: auth
tags: [next-js, proxy, jwt, cookies, login-page, request-interceptor, tailwind]

# Dependency graph
requires:
  - phase: 01-01
    provides: "JWT utilities: encrypt(), decrypt() in lib/auth.ts — proxy.ts imports decrypt() for session verification"
  - phase: 01-01
    provides: "Login API at POST /api/auth/login — login page POSTs to this endpoint"
provides:
  - "proxy.ts request interceptor: gates all routes behind JWT verification, redirects pages to /login, returns 401 for API routes"
  - "app/login/page.tsx: password form with inline error display and client-side redirect on success"
  - "Complete end-to-end auth gate: unauthenticated access blocked at proxy layer, login flow fully functional"
affects: [02-ui-polish, any-future-pages, any-future-api-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "proxy.ts (not middleware.ts) — Next.js 16.1.6 convention for request interception"
    - "request.cookies.get() in proxy context — cookies() from next/headers unavailable in proxy"
    - "Suspense boundary around useSearchParams() — required by Next.js for client components"
    - "Client-side router.push() after login — avoids Set-Cookie race condition on server 302 redirect"
    - "Matcher negative lookahead regex excludes _next/static, _next/image, favicon.ico only — does NOT exclude /api or _next/data"

key-files:
  created:
    - proxy.ts
    - app/login/page.tsx
  modified: []

key-decisions:
  - "proxy.ts named export `proxy` (not `middleware`) — Next.js 16 convention; middleware.ts is deprecated"
  - "Public paths: only /login and /api/auth/login bypass auth — all other routes including /api/* are intercepted"
  - "API routes return 401 JSON (not redirect) — machine clients expect JSON error responses, not HTML redirect"
  - "callbackUrl passed as search param to /login, read via useSearchParams() in login page — preserves original destination"
  - "Client-side redirect (router.push) after login — server-side 302 has cookie race condition before cookie commit"
  - "LoginForm component wrapped in Suspense in same file — useSearchParams() requires Suspense boundary in Next.js"
  - "No static asset exclusions beyond matcher — _next/data intentionally NOT excluded (would expose API data routes)"

patterns-established:
  - "Pattern: proxy.ts at project root for Next.js 16 request interception"
  - "Pattern: Client component login forms POST to API route; no direct server action or server auth import"
  - "Pattern: Inline error state (useState) for form validation feedback"

requirements-completed: [AUTH-01, AUTH-05, AUTH-06, FORK-01]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 01 Plan 02: Auth Gate — proxy.ts request interceptor and login page Summary

**Next.js 16 proxy.ts gate blocking all unauthenticated access with /login page, callbackUrl redirect, inline error display, and client-side post-login navigation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-28T22:48:33Z
- **Completed:** 2026-02-28
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Created proxy.ts at project root exporting `proxy` function and `config` matcher — intercepts all routes except static assets, redirects unauthenticated page requests to /login with callbackUrl, returns 401 JSON for unauthenticated API requests
- Created app/login/page.tsx as a client component — password form POSTs to /api/auth/login, displays inline "Incorrect password" error on failure, performs client-side redirect on success to avoid Set-Cookie race condition
- Human verified complete end-to-end flow: unauthenticated redirect, wrong password error, correct password login, session persistence, API 401 protection, static asset passthrough

## Task Commits

Each task was committed atomically:

1. **Task 1: Create proxy.ts request interceptor** - `b64e0a8` (feat)
2. **Task 2: Create login page at app/login/page.tsx** - `99a6282` (feat)
3. **Task 3: Verify complete auth gate end-to-end** - checkpoint:human-verify (approved by user — no code commit)

## Files Created/Modified

- `proxy.ts` - Request interceptor: early-return for /login and /api/auth/login, reads session cookie via request.cookies.get(), calls decrypt() from @/lib/auth, redirects unauthenticated pages to /login?callbackUrl=, returns 401 JSON for unauthenticated API requests, matcher excludes _next/static/_next/image/favicon.ico
- `app/login/page.tsx` - Client component: LoginForm uses useSearchParams() for callbackUrl, useState for password/error/loading, fetch POST to /api/auth/login, router.push() on success, inline error display on failure; wrapped in Suspense boundary

## Decisions Made

- proxy.ts exports `proxy` (not `middleware`) — Next.js 16.1.6 uses proxy.ts convention; middleware.ts is deprecated as of this version
- Only /login and /api/auth/login are excluded from auth — no other paths are public; this enforces the "gate entire app" requirement (AUTH-01)
- API routes receive 401 JSON (not redirect) — machine clients including curl and browser fetch() expect JSON, not a redirect to an HTML login page
- Client-side redirect via router.push() after login — server-side 302 redirect has a race condition where the browser may navigate before the Set-Cookie header is committed (Pitfall 6 from research)
- useSearchParams() wrapped in Suspense inside the same 'use client' file — Next.js requires this boundary; LoginForm component in same file is the pattern

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Both files compile cleanly. TypeScript and Next.js constraints were anticipated by the plan (Suspense boundary, proxy convention, cookie access pattern).

## User Setup Required

None — no new external services or environment variables added in this plan. .env.local with SITE_PASSWORD and AUTH_SECRET was created in Plan 01.

## Self-Check

- [x] proxy.ts exists at project root
- [x] app/login/page.tsx exists
- [x] Task 1 commit b64e0a8 exists in git log
- [x] Task 2 commit 99a6282 exists in git log
- [x] User approved end-to-end verification checkpoint

## Next Phase Readiness

- Complete auth gate is operational — every page and API route requires a valid session cookie
- Phase 2 (UI polish) can proceed: the auth gate is transparent to page rendering, login page basic styling is in place
- No blockers

---
*Phase: 01-core-auth-gate*
*Completed: 2026-02-28*
