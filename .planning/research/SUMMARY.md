# Project Research Summary

**Project:** geo-aeo-tracker — Shared Password Protection
**Domain:** Next.js App Router password gating on a forked repository deployed to Vercel
**Researched:** 2026-02-28
**Confidence:** HIGH

## Executive Summary

This project adds a single shared-password gate to an existing Next.js 16.1.6 App Router application (geo-aeo-tracker) that tracks GEO/AEO metrics. The core constraint is preserving fork sync compatibility with upstream: every file added must be new (not a modification of existing files), and the auth layer must be minimal enough that upstream merge conflicts are unlikely. Research across all four areas converges on the same canonical implementation: a `proxy.ts` file at the project root (Next.js 16's replacement for `middleware.ts`) that reads an httpOnly cookie on every request, redirecting unauthenticated users to a custom `/login` page. The cookie is a signed JWT created by `jose`, validated server-side only. This pattern is documented in the official Next.js 16 authentication guide and is the established community standard.

The recommended implementation requires exactly two new dependencies (`jose` for JWT signing, `server-only` to enforce server boundaries), five new files (proxy.ts, app/login/page.tsx, app/api/auth/login/route.ts, app/api/auth/logout/route.ts, lib/session.ts), and zero changes to any existing application file. This makes the auth layer a cleanly isolated layer that upstream merges will not touch. The `/demo` route should be gated (per PROJECT.md direction), and all existing API routes (`/api/scrape`, `/api/audit`, `/api/analyze`) must be protected both via proxy and via independent cookie verification in each route handler.

The primary risk is treating the `proxy.ts` check as the sole authentication layer. CVE-2025-29927 demonstrated that middleware can be bypassed via a crafted request header on self-hosted deployments. While Next.js 16.1.6 ships with the fix and Vercel additionally strips the exploit header at the infrastructure level, Vercel's own postmortem explicitly recommends defense-in-depth: each API route handler must independently verify the session cookie. A secondary risk is a future upstream `middleware.ts` or `proxy.ts` addition causing a merge conflict — mitigated by keeping proxy.ts as a thin wrapper and placing all auth logic in `lib/session.ts`.

---

## Key Findings

### Recommended Stack

The password protection layer adds exactly two npm dependencies to the existing stack. `jose` (v6.x) is the JWT library recommended by official Next.js 16 documentation — it is Edge-compatible (Web Crypto API), tree-shakeable ESM with no transitive dependencies, and actively maintained. `server-only` is a build-time guard that prevents session utilities from accidentally being imported into client components. Everything else — Zod for form validation, Next.js built-in `cookies()` API, Node.js `crypto.timingSafeEqual()` — is already available.

`middleware.ts` is deprecated in Next.js 16.1.6; the replacement is `proxy.ts` at the project root with an exported `proxy` function. The logic is identical to middleware; only the filename and export name change. Using `proxy.ts` avoids a deprecation warning on the current version. Neither `iron-session`, `next-auth`, nor `bcrypt` should be added — they either solve a different problem (multi-user auth) or add complexity with no benefit for a single shared password.

**Core technologies:**
- `proxy.ts` (Next.js built-in): Request interception — reads auth cookie, redirects unauthenticated requests, zero additional dependency
- `jose` v6.x: JWT session cookie signing and verification — officially recommended by Next.js docs, Edge-compatible, no dependencies
- `server-only` v0.0.x: Build-time server boundary enforcement — prevents session logic from leaking to client bundle
- `cookies()` from `next/headers`: Cookie read/write in Server Components and Route Handlers — built-in, no library needed
- `crypto.timingSafeEqual()` (Node.js built-in): Timing-safe password comparison — prevents timing-attack enumeration of the shared password

### Expected Features

Research identifies a clear division between features that must ship for the gate to function, versus enhancements that can follow once the gate is confirmed working. The MVP is small: seven features, all rated LOW implementation complexity.

**Must have (table stakes):**
- `proxy.ts` intercepting all routes except `/login` and static assets — the gate mechanism
- Login page with password input and error message on wrong password — the only user-facing entry point
- Session cookie (httpOnly, secure, sameSite=lax, 7-day expiry) — without this the gate breaks on every navigation
- Redirect back to originally requested URL after successful login — users expect to land where they tried to go
- API route protection (`/api/scrape`, `/api/audit`, `/api/analyze` all return 401 without valid cookie) — without this the UI gate is a false sense of security
- Static asset exclusion from middleware matcher — prevents broken CSS/JS loading states
- `AUTH_PASSWORD` and `SESSION_SECRET` via environment variables — configurable without code changes or redeploy

**Should have (add after validation):**
- Session expiry fine-tuning (7 days default is well-documented community standard)
- Styled login page matching the existing app visual style (Tailwind is already installed)
- Logout endpoint (`POST /api/auth/logout`) clears cookie and redirects to `/login`
- Loading/submitting state on login form button — prevents double-submit

**Defer (v2+):**
- Per-user accounts — abandons the shared-password model entirely; different product
- Rate limiting in application code — Vercel Firewall rule (zero code) is the preferred approach and can be configured post-launch

### Architecture Approach

The architecture is deliberately thin and isolated. `proxy.ts` at the project root is the request gate — it reads the session cookie on every request and redirects to `/login` if absent or invalid. The login page submits to a Server Action (or Route Handler) that compares the submitted password using `crypto.timingSafeEqual()`, then calls `createSession()` from `lib/session.ts` to mint a signed JWT cookie via `jose`. All session logic (encrypt, decrypt, create, verify, delete) lives in `lib/session.ts` marked `server-only`. This file is imported by both `proxy.ts` (to verify) and the login/logout routes (to create/delete). No React Context, no global state, no client-side auth awareness — auth is transparent to the existing application because pages simply render if the proxy allowed them through.

**Major components:**
1. `proxy.ts` — Request gate; reads cookie, redirects unauthenticated requests; the only file that runs on every HTTP request
2. `lib/session.ts` — Session utilities (encrypt/decrypt JWT via jose, createSession, verifySession, deleteSession); marked server-only; single source of truth for session logic
3. `app/login/page.tsx` — Public login form (Server Component); excluded from proxy check; submits via Server Action
4. `app/api/auth/login/route.ts` — Validates password against `AUTH_PASSWORD` env var using timingSafeEqual, calls createSession on match
5. `app/api/auth/logout/route.ts` — Calls deleteSession, redirects to /login
6. Existing API routes (no new files) — Add independent `verifySession()` call at handler entry for defense-in-depth

**Build order (dependency-driven):**
1. `lib/session.ts` — no dependencies; everything else imports from here
2. `app/api/auth/login/route.ts` — depends on session.ts
3. `app/api/auth/logout/route.ts` — depends on session.ts
4. `app/login/page.tsx` — depends on login route existing
5. `proxy.ts` — deploy last; once live, all unauthenticated requests redirect

### Critical Pitfalls

1. **Middleware as sole auth layer** — `proxy.ts` alone is insufficient. CVE-2025-29927 demonstrated middleware bypass via the `x-middleware-subrequest` header. Mitigation: each existing API route handler independently calls `verifySession()` from `lib/session.ts` before processing any request. Five lines per route, zero new dependencies. This is non-negotiable per Vercel's own postmortem.

2. **Plain-text password comparison with `===`** — Timing attacks can enumerate shared password characters via response latency. Mitigation: always use `crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected))` in the login route handler. Never compare with `===` or `==`.

3. **`NEXT_PUBLIC_` prefix on auth environment variables** — Next.js inlines `NEXT_PUBLIC_*` variables into the client JS bundle at build time. If `NEXT_PUBLIC_AUTH_PASSWORD` is used, the password is visible in browser DevTools. Mitigation: use `AUTH_PASSWORD` (no prefix); all password validation happens server-side only.

4. **Fork merge conflict in proxy.ts** — Next.js supports only one proxy/middleware file per project. If upstream adds their own `middleware.ts` or `proxy.ts`, the next merge produces a conflict. Mitigation: keep `proxy.ts` to ~30 lines (thin wrapper only), with all logic in `lib/session.ts`. This minimizes conflict surface and makes manual merges straightforward.

5. **Cookie race condition after login redirect** — In some browsers, a `Set-Cookie` header combined with an immediate `302 redirect` in the same response causes the browser not to attach the new cookie to the redirect request, bouncing the user back to login. Mitigation: test the login-to-redirect flow specifically (not just navigation after login); consider a client-side redirect after successful login if the race condition is observed.

---

## Implications for Roadmap

Based on the architectural build order and pitfall mapping, a two-phase delivery is the natural structure. Phase 1 delivers a fully working, secure gate. Phase 2 polishes the user experience.

### Phase 1: Core Auth Gate

**Rationale:** All Phase 1 features are interdependent — the gate cannot function until the session library, login route, login page, and proxy are all in place. The defense-in-depth API route guards must also ship in Phase 1 because they close the primary security gap (Pitfall 1). Everything in this phase is a new file; zero changes to existing code.

**Delivers:** A fully functional password gate where unauthenticated users are redirected to `/login`, authenticated users can reach all app routes, and direct API calls without a valid cookie return 401.

**Addresses features from FEATURES.md:**
- `proxy.ts` gate with correct matcher (all routes except /login and /_next/*)
- Login page with password form and error state
- Session cookie (httpOnly, secure, sameSite=lax, 7-day expiry, signed JWT via jose)
- Redirect to callbackUrl after successful login
- API route protection via independent verifySession() in each handler
- AUTH_PASSWORD and SESSION_SECRET via environment variables

**Avoids pitfalls:**
- Pitfall 1 (middleware-only): API route guards implemented in same phase
- Pitfall 2 (plain-text comparison): timingSafeEqual() used in login route
- Pitfall 3 (NEXT_PUBLIC_ leak): env vars correctly named without public prefix
- Pitfall 4 (fork conflict): proxy.ts kept thin, all logic in lib/session.ts
- Pitfall 5 (matcher excludes API): verify matcher includes /api/* routes

### Phase 2: UX Polish and Logout

**Rationale:** Once the gate is confirmed working in production, the user-facing experience can be improved without touching any security-critical code. Phase 2 has no security implications — it is purely additive.

**Delivers:** Styled login page matching app visual style, logout capability, and form interaction polish.

**Addresses features from FEATURES.md:**
- Styled login page using existing Tailwind setup
- Logout endpoint (POST /api/auth/logout → deleteSession → redirect to /login)
- Loading/submitting state on login form button
- Clear error feedback without full page reload

**Avoids pitfalls:**
- Pitfall 6 (cookie race condition): verify login redirect flow during Phase 2 QA
- Pitfall 7 (cookie attributes missing in prod): check Vercel preview URL DevTools before marking Phase 2 done

### Phase Ordering Rationale

- **Security before UX:** All security-critical features (gate, defense-in-depth, correct env vars) ship in Phase 1. The user will see an unstyled login page briefly — that is acceptable; an incomplete security posture is not.
- **New files only in Phase 1:** All Phase 1 files are new, eliminating merge conflict risk. The only existing files touched are existing API routes with a 5-line addition each (defense-in-depth guards).
- **Phase 2 is purely additive:** No Phase 2 change modifies existing security behavior, so it can ship at any time after Phase 1 is confirmed working.
- **No Phase 3 recommended:** Rate limiting (Pitfall 8) should be handled via Vercel Firewall rules (zero code, zero merge risk), not application code. This is a post-deploy configuration task, not a development phase.

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 1 (Core Auth Gate):** Well-documented pattern confirmed in official Next.js 16 docs, Vercel postmortem, and multiple community sources. Implementation examples are complete in the research files. No additional research needed.
- **Phase 2 (UX Polish):** Styling with Tailwind and logout via cookie deletion are trivial and have no ambiguity.

No phases require additional research. The only open question (whether `/demo` should be gated) is a product decision documented in PROJECT.md as "yes — gate it," not a technical question.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core pattern (`jose` + `proxy.ts` + `cookies()`) is documented in official Next.js 16 authentication guide. `proxy.ts` naming confirmed in Next.js 16 release notes. All sources cross-referenced. |
| Features | HIGH | Feature set is well-defined for a shared-password gate. Must-have vs. defer distinction is clear. Anti-features explicitly researched and ruled out. |
| Architecture | HIGH | Build order, component responsibilities, and data flow are confirmed by official Next.js docs and Vercel's CVE postmortem. Pattern is simple enough to verify end-to-end without ambiguity. |
| Pitfalls | HIGH | CVE-2025-29927 is documented with official Vercel postmortem. Cookie race condition is documented in Next.js GitHub issue #37761. Timing attack mitigation is standard Node.js crypto practice. |

**Overall confidence:** HIGH

### Gaps to Address

- **`/demo` route gating:** PROJECT.md says gate the entire app including `/demo`. Research confirms this is technically trivial (include or exclude from matcher). The decision is made; implementation simply needs to follow it. No gap.
- **Cookie race condition (Pitfall 6):** The mitigation (client-side redirect after login instead of server-side 302) is documented in PITFALLS.md but the specific Next.js 16.1.6 behavior has not been empirically tested. Test this explicitly during Phase 1 QA before marking complete.
- **Vercel plan tier:** STACK.md notes that Vercel Pro/Enterprise offers zero-code platform-level password protection. If the project is on a paid plan, this is worth evaluating as an alternative to application-level auth. This is a product decision, not a blocker.

---

## Sources

### Primary (HIGH confidence)
- Next.js 16 official authentication guide — https://nextjs.org/docs/app/guides/authentication — stateless sessions with jose, proxy.ts pattern
- Next.js 16 release notes — https://nextjs.org/blog/next-16 — proxy.ts naming, middleware deprecation
- Next.js 16.1.6 proxy/middleware API (Context7) — https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx
- Vercel CVE-2025-29927 postmortem — https://vercel.com/blog/postmortem-on-next-js-middleware-bypass — "do not recommend Middleware as sole protection"
- jose npm package — https://www.npmjs.com/package/jose — v6.1.3, Edge-compatible, Web Crypto API
- Vercel Basic Auth Password template — https://vercel.com/templates/next.js/basic-auth-password — official Vercel pattern

### Secondary (MEDIUM confidence)
- Alex Chan: Revisiting password protecting routes in Next.js — https://www.alexchantastic.com/revisiting-password-protecting-next — iron-session + Next.js 15, updated pattern
- CVE-2025-67779 follow-up (Datadog Security Labs, ProjectDiscovery) — middleware bypass class of vulnerabilities
- Next.js GitHub discussion #64843 — community password gate expectations
- Next.js GitHub issue #37761 — cookie race condition on redirect after login
- NEXT_PUBLIC_ env var security (LogRocket) — https://blog.logrocket.com/configure-environment-variables-next-js/

### Tertiary (LOW confidence)
- HashBuilds: Next.js Middleware Authentication 2025 — https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025 — single community source, aligned with official docs

---

*Research completed: 2026-02-28*
*Ready for roadmap: yes*
