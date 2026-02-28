---
phase: 01-core-auth-gate
plan: 01
subsystem: auth
tags: [jwt, jose, next-js, cookies, session, password-auth]

# Dependency graph
requires: []
provides:
  - "JWT session utilities: encrypt(), decrypt(), createSession(), verifySession() in lib/auth.ts"
  - "Login API endpoint at POST /api/auth/login with Zod validation and constant-time password comparison"
  - ".env.local with SITE_PASSWORD and AUTH_SECRET environment variables"
affects: [01-02, proxy, login-page]

# Tech tracking
tech-stack:
  added: [jose@6.x (JWT signing/verification via HS256)]
  patterns:
    - "Lazy encoded key getter — validate AUTH_SECRET at call time, not import time"
    - "Constant-time password comparison: length check before timingSafeEqual"
    - "7-day persistent session cookie with expires (not maxAge), httpOnly, SameSite=lax"

key-files:
  created:
    - lib/auth.ts
    - app/api/auth/login/route.ts
    - .env.local (git-ignored, created locally only)
  modified:
    - package.json (added jose dependency)
    - package-lock.json

key-decisions:
  - "No server-only import in lib/auth.ts — proxy.ts will import it and is not a React server context"
  - "encrypt() and decrypt() are pure JWT operations — no cookies() usage — safe for proxy.ts to call"
  - "Lazy getEncodedKey() validates AUTH_SECRET at call time; avoids import-time crash at build"
  - "timingSafeEqual guard: length check first to avoid throw on unequal-length buffers (Pitfall 7)"
  - ".env.local is covered by .env* glob in .gitignore — not committed"

patterns-established:
  - "Pattern: Auth utilities in lib/auth.ts — import from @/lib/auth in routes and proxy"
  - "Pattern: API routes use NextRequest/NextResponse with Zod validation and try/catch error handling"

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, FORK-01, FORK-02]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 01 Plan 01: Auth Foundation — JWT Utilities and Login API Summary

**Stateless JWT session foundation using jose HS256, httpOnly cookie with 7-day expiry, and constant-time password validation at POST /api/auth/login**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T22:46:32Z
- **Completed:** 2026-02-28T22:48:33Z
- **Tasks:** 3
- **Files modified:** 5 (lib/auth.ts, app/api/auth/login/route.ts, package.json, package-lock.json, .env.local)

## Accomplishments

- Created lib/auth.ts with 4 exports (encrypt, decrypt, createSession, verifySession) using jose SignJWT/jwtVerify HS256 — safe for proxy.ts to import (no server-only, no cookies in pure functions)
- Created POST /api/auth/login with Zod validation, constant-time password check via crypto.timingSafeEqual with length guard, and createSession() on success
- Created .env.local with SITE_PASSWORD placeholder and cryptographically random AUTH_SECRET (git-ignored via .env* glob)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install jose and create lib/auth.ts** - `32ede9c` (feat)
2. **Task 2: Create POST /api/auth/login route** - `fab5d17` (feat)
3. **Task 3: Create .env.local** - no commit (git-ignored by .env* in .gitignore — intentional)

## Files Created/Modified

- `lib/auth.ts` - JWT session utilities: encrypt (SignJWT HS256 7d), decrypt (jwtVerify null-on-error), createSession (set httpOnly cookie), verifySession (read cookie + decrypt)
- `app/api/auth/login/route.ts` - POST handler: Zod validation, SITE_PASSWORD env check, timingSafeEqual comparison, createSession on success
- `.env.local` - SITE_PASSWORD=changeme (placeholder) and AUTH_SECRET=<generated> (git-ignored)
- `package.json` / `package-lock.json` - Added jose dependency

## Decisions Made

- No `import 'server-only'` in lib/auth.ts — proxy.ts imports this file and proxy is not a React server context; adding server-only would crash
- encrypt() and decrypt() are pure JWT operations with no cookies() usage — this keeps them callable from proxy.ts
- Lazy `getEncodedKey()` function validates AUTH_SECRET at call time (not module load time) to avoid build-time crash when env var isn't set
- timingSafeEqual length check first — `crypto.timingSafeEqual` throws if buffer lengths differ, which would leak timing information via the throw path
- .env.local is git-ignored by the existing `.env*` glob pattern — no modification to .gitignore needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript compiles cleanly with project tsconfig. The `npx tsc --noEmit lib/auth.ts` command (as written in the plan) shows node_modules errors due to running without tsconfig settings, but `npx tsc --noEmit` (with full tsconfig including skipLibCheck) passes cleanly.

## User Setup Required

**Change SITE_PASSWORD in .env.local before first use.**

The .env.local was created with `SITE_PASSWORD=changeme` as a placeholder. Update this to your actual password before running the app. The AUTH_SECRET is already set to a cryptographically random value.

For Vercel deployment, add both variables to the Vercel dashboard:
- `SITE_PASSWORD` — your chosen password
- `AUTH_SECRET` — copy the value from .env.local

## Next Phase Readiness

- lib/auth.ts is ready to be imported by proxy.ts (Plan 02) — decrypt() is available for proxy use
- POST /api/auth/login is functional and will set the session cookie consumed by proxy.ts
- Plan 02 needs to create proxy.ts (request interceptor) and app/login/page.tsx (login form)
- No blockers

---
*Phase: 01-core-auth-gate*
*Completed: 2026-02-28*
