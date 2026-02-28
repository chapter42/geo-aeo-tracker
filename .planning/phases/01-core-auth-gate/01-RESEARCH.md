# Phase 1: Core Auth Gate - Research

**Researched:** 2026-02-28
**Domain:** Next.js 16.1.6 proxy-based authentication with JWT session cookies (jose v6)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Login page behavior**: Plain form, show inline error on wrong password ("Incorrect password"), redirect to originally requested URL after successful login (callback URL pattern). No rate limiting needed.
- **Session duration**: 7-day cookie, persists across browser restarts (not a session cookie). HttpOnly, Secure (production), SameSite=Lax.
- **API route protection**: Return 401 JSON `{ error: "Unauthorized" }` for unauthenticated API requests (not redirect — APIs serve JSON consumers). Add `verifySession()` check to each route for defense-in-depth.
- **Password comparison**: Use `crypto.timingSafeEqual()` for constant-time comparison.
- **Token approach**: Signed JWT via `jose` library — stateless, no DB needed, edge-compatible.
- **File naming**: `proxy.ts` (Next.js 16 convention, forward-compatible). Auth utilities in `lib/auth.ts`.
- **Environment variable**: `SITE_PASSWORD` for the shared password, `AUTH_SECRET` for JWT signing key.

### Claude's Discretion

User delegated all implementation decisions to Claude. Use standard patterns.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | All page requests intercepted by proxy and redirected to /login if no valid session cookie | proxy.ts with negative-matcher covering all routes except /login, static assets, and API routes |
| AUTH-02 | User can enter shared password on /login page and receive a signed session cookie on success | app/api/auth/login/route.ts using jose SignJWT + cookies API |
| AUTH-03 | Session cookie is encrypted, httpOnly, secure, SameSite=lax | jose HS256 JWT with cookie options: httpOnly, secure, sameSite: 'lax', expires 7d |
| AUTH-04 | Password read from SITE_PASSWORD env var (no hardcoded values) | lib/auth.ts reads process.env.SITE_PASSWORD, AUTH_SECRET at runtime |
| AUTH-05 | API routes (/api/scrape, /api/audit, /api/analyze) independently verify session cookie (defense-in-depth) | FORK-01 conflict resolved: proxy.ts matcher INCLUDES /api routes, making them covered at proxy layer; see FORK-01 note below |
| AUTH-06 | Static assets (_next/static, _next/image, favicon) excluded from auth check | proxy.ts matcher regex negative-lookahead excludes _next/static, _next/image, favicon.ico |
| FORK-01 | All auth code lives in new files only — zero modifications to existing upstream files | New files only: proxy.ts, app/login/page.tsx, app/api/auth/login/route.ts, lib/auth.ts |
| FORK-02 | Auth utilities isolated in dedicated module (lib/auth.ts) to minimize merge conflict surface | All session logic in lib/auth.ts — existing routes import nothing from it |
</phase_requirements>

---

## Summary

This phase implements a shared-password auth gate for Next.js 16.1.6. The correct entry point is `proxy.ts` at the project root — the `middleware.ts` convention was deprecated in Next.js v16.0.0 and renamed to `proxy.ts`. The official Next.js docs confirm `proxy.ts` is the current standard for v16. The function export is named `proxy` (not `middleware`).

Session management uses the `jose` library (v6.x) for stateless JWT signing with HS256. This library is explicitly recommended by the official Next.js authentication documentation for stateless sessions, and it is edge-runtime compatible (uses Web Crypto API, not Node.js crypto). The JWT is stored as an HttpOnly cookie with a 7-day expiration.

A critical FORK-01 constraint requires zero modifications to existing files. The locked decision to add `verifySession()` to existing API routes conflicts directly with FORK-01. The resolution: configure the proxy.ts matcher to include `/api/*` routes so the proxy layer enforces auth for all routes including API endpoints. This satisfies AUTH-05 defense-in-depth at the proxy level without touching existing route files. The existing `/api/analyze/route.ts` uses `export const runtime = "edge"` which has no impact on proxy-level protection.

**Primary recommendation:** Implement proxy.ts with a negative-lookahead matcher that excludes only /login and static assets, covering both page routes AND API routes. Put all JWT logic in lib/auth.ts. Login flow uses a new API route at app/api/auth/login/route.ts.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jose | ^6.1.3 | JWT signing (SignJWT) and verification (jwtVerify) | Officially recommended by Next.js docs for stateless sessions; edge-runtime compatible via Web Crypto API; zero dependencies |
| next (built-in) | 16.1.6 | NextRequest, NextResponse, cookies() API | Already installed; proxy.ts and cookie manipulation are framework built-ins |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod (already installed) | ^4.3.6 | Validate login form input | Validate `{ password: string }` body in login route — already used project-wide |
| crypto (Node.js built-in) | built-in | `crypto.timingSafeEqual()` for constant-time password comparison | Prevents timing attacks on password check in login route |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jose | jsonwebtoken | jsonwebtoken depends on Node.js `crypto` module — incompatible with edge runtime; do NOT use |
| jose | iron-session | iron-session encrypts rather than signs; either works but jose is explicitly listed first in Next.js docs |
| proxy.ts | middleware.ts | middleware.ts is deprecated in Next.js 16.0.0; proxy.ts is the current standard |
| 7-day JWT cookie | server-side session store | No DB in this project; stateless JWT is the correct choice here |

**Installation:**

```bash
npm install jose
```

## Architecture Patterns

### Recommended Project Structure

```
proxy.ts                          # NEW: Auth gate — runs before every request
lib/
  auth.ts                         # NEW: encrypt(), decrypt(), verifySession(), createSession()
app/
  login/
    page.tsx                      # NEW: Login form (server component + client form)
  api/
    auth/
      login/
        route.ts                  # NEW: POST /api/auth/login — validates password, sets cookie
    scrape/route.ts               # UNCHANGED (upstream file)
    audit/route.ts                # UNCHANGED (upstream file)
    analyze/route.ts              # UNCHANGED (upstream file — has runtime = "edge")
```

### Pattern 1: proxy.ts Negative Matcher

**What:** The proxy.ts `config.matcher` uses a negative-lookahead regex to exclude only /login, static assets, and favicon from auth enforcement. All other routes — including /api/* — are protected.

**When to use:** When auth must protect all routes by default with minimal exclusion list.

**Example:**

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
// Source: https://nextjs.org/docs/app/guides/authentication

import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /login is always public
  if (pathname === '/login') {
    return NextResponse.next()
  }

  // Verify JWT from cookie
  const sessionCookie = request.cookies.get('session')?.value
  const session = await decrypt(sessionCookie)

  if (!session) {
    // Pages get a redirect; API routes get 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
```

### Pattern 2: lib/auth.ts Session Utilities

**What:** All JWT logic centralized in lib/auth.ts — encrypt, decrypt, createSession, deleteSession. API routes and proxy.ts import from here. This is the FORK-02 isolation module.

**When to use:** Every file that needs to check or create sessions.

**Example:**

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication#stateless-sessions

import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secretKey = process.env.AUTH_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload
  } catch {
    return null  // Invalid or expired JWT — treat as unauthenticated
  }
}

export async function createSession() {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const token = await encrypt({ authenticated: true, expiresAt: expiresAt.toISOString() })
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

// For use in Route Handlers (not proxy.ts, which reads from request.cookies directly)
export async function verifySession() {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  return await decrypt(session)
}
```

**IMPORTANT:** `import 'server-only'` CANNOT be used in `lib/auth.ts` because `proxy.ts` imports from it and proxy runs in the Node.js runtime (not a React server context). Remove `server-only` from auth.ts. If a version is needed for route handlers only, create `lib/auth-server.ts` wrapping auth.ts.

**IMPORTANT:** `cookies()` from `next/headers` cannot be called in proxy.ts — it is not available there. In proxy.ts, read the cookie from `request.cookies.get('session')?.value` directly.

### Pattern 3: Login Route Handler

**What:** A standard Next.js Route Handler at `app/api/auth/login/route.ts` that receives `{ password }`, compares with `SITE_PASSWORD` using `crypto.timingSafeEqual()`, sets session cookie on success.

**Example:**

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession } from '@/lib/auth'
import crypto from 'crypto'

const BodySchema = z.object({
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const { password } = BodySchema.parse(await req.json())

    const expected = process.env.SITE_PASSWORD
    if (!expected) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Constant-time comparison to prevent timing attacks
    const inputBuf = Buffer.from(password)
    const expectedBuf = Buffer.from(expected)
    // Buffers must be same length for timingSafeEqual; pad to avoid length leaking
    const match =
      inputBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(inputBuf, expectedBuf)

    if (!match) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    await createSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
```

### Pattern 4: Login Page with Callback URL

**What:** Login page reads `callbackUrl` from query params, submits password to API route, redirects on success.

**Example:**

```typescript
// app/login/page.tsx — Server Component shell with client form
// Source: https://nextjs.org/docs/app/guides/authentication

// Client form component reads searchParams.callbackUrl
// On success: router.push(callbackUrl || '/')
// On failure: show inline "Incorrect password" error message
```

### Anti-Patterns to Avoid

- **Using `middleware.ts` instead of `proxy.ts`:** `middleware.ts` is deprecated since Next.js v16.0.0. The export must be named `proxy`, not `middleware`. File name must be `proxy.ts`.
- **Using `server-only` in lib/auth.ts:** proxy.ts imports lib/auth.ts, but proxy.ts is not a React server context — `server-only` will cause a runtime crash.
- **Using `cookies()` from `next/headers` in proxy.ts:** Not available in proxy context. Use `request.cookies.get()` instead.
- **Using `jsonwebtoken` instead of `jose`:** `jsonwebtoken` depends on Node.js crypto module, incompatible with edge-adjacent contexts and not needed when jose works.
- **Not including `/api` routes in the proxy matcher:** If the matcher excludes `/api`, proxy never runs for API routes and they are unprotected. This is the most common auth bypass mistake.
- **Relying solely on proxy for security:** Official Next.js docs and CVE-2025-29927 post-mortem both state proxy/middleware should not be the sole protection layer. However, FORK-01 prevents modifying existing route files — the resolution is that proxy.ts covers API routes via the matcher. This is an accepted trade-off documented in the CONTEXT.md.
- **Hardcoding the password or AUTH_SECRET:** Both must come from environment variables only.
- **Using session cookie (no expiry) instead of persistent cookie:** The decision is 7-day `expires` — not a session cookie. Set `expires` explicitly, not `maxAge`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing/verification | Custom HMAC implementation | jose v6 `SignJWT` / `jwtVerify` | Subtle crypto bugs, algorithm confusion attacks, replay attacks — jose handles all correctly |
| Cookie manipulation in proxy | Manual `Set-Cookie` header string | `request.cookies.get()` / `response.cookies.set()` | Next.js `RequestCookies` / `ResponseCookies` API handles encoding, attributes correctly |
| Route path matching | Custom string matching logic | `config.matcher` regex in proxy.ts | Already built into Next.js; static analysis at build time means no runtime overhead |
| Password comparison | `===` string equality | `crypto.timingSafeEqual()` | String equality short-circuits on first mismatch — leaks timing information |

**Key insight:** The auth pattern for this use case is well-documented in official Next.js docs (see Authentication guide). The entire implementation is covered by jose + Next.js built-ins. Do not add NextAuth, Auth.js, or Clerk — they are explicitly out of scope in requirements.

## Common Pitfalls

### Pitfall 1: proxy.ts Matcher Misses API Routes

**What goes wrong:** The default Next.js negative-lookahead matcher example excludes `api` from the proxy. Copy-pasting it leaves API routes unprotected.

**Why it happens:** The official negative matcher example in the proxy.ts docs excludes `api` because that pattern targets page-only protection scenarios.

**How to avoid:** Remove `api` from the exclusion list. The matcher must only exclude `_next/static`, `_next/image`, and `favicon.ico` (plus `/login` handled via early return in the proxy function body).

**Warning signs:** `curl -X POST http://localhost:3000/api/scrape` returns data without a session cookie.

### Pitfall 2: `_next/data` Routes Bypass

**What goes wrong:** Excluding `_next/data` from the matcher creates a security hole. Next.js App Router data prefetch requests go through `_next/data` — if excluded, client-side navigation can fetch protected data without auth.

**Why it happens:** Next.js docs explicitly warn about this: "Even when `_next/data` is excluded in a negative matcher pattern, proxy will still be invoked for `_next/data` routes." Do NOT exclude `_next/data` — leave it to the framework.

**How to avoid:** Never add `_next/data` to the exclusion list.

**Warning signs:** Navigating via Next.js `<Link>` to a protected page after session expires shows cached data.

### Pitfall 3: `AUTH_SECRET` Missing in Production

**What goes wrong:** `jwtVerify` throws if `AUTH_SECRET` is undefined. All sessions fail validation. App becomes inaccessible.

**Why it happens:** Environment variable not set in Vercel dashboard / `.env.local`.

**How to avoid:** Add explicit check at startup. In lib/auth.ts: `if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET environment variable is required')`.

**Warning signs:** App redirects everyone to /login even with valid cookies.

### Pitfall 4: `secure` Flag in Development

**What goes wrong:** Setting `secure: true` unconditionally means cookies are not sent over HTTP in development (`localhost`). Login appears to work but cookie is rejected by browser.

**Why it happens:** `secure: true` requires HTTPS. localhost is HTTP.

**How to avoid:** `secure: process.env.NODE_ENV === 'production'`

**Warning signs:** Login redirects back to /login after "success" in dev.

### Pitfall 5: `server-only` in lib/auth.ts

**What goes wrong:** Runtime crash: "server-only cannot be imported from a file that will be executed on the client or in middleware/proxy."

**Why it happens:** proxy.ts imports lib/auth.ts; proxy.ts is not a React server context; `server-only` marker rejects non-server-component callers.

**How to avoid:** Do not add `import 'server-only'` to lib/auth.ts. The file is already server-only by design (only called from server contexts) — the marker is not needed and breaks proxy.ts.

**Warning signs:** `next build` fails or proxy crashes at runtime with an import error.

### Pitfall 6: Cookie Race Condition on Login Redirect

**What goes wrong:** Login succeeds, server sets cookie, server sends 302 redirect. Browser follows redirect before cookie is fully committed. Protected page loads, proxy reads cookie — cookie may not be present yet in certain browsers.

**Why it happens:** Timing between `Set-Cookie` header and browser redirect processing.

**How to avoid:** Return `{ success: true }` from the login API route. Handle redirect client-side in the login form after the fetch response. This guarantees the browser has processed the cookie before navigating.

**Warning signs:** Login works intermittently; logging out and logging in immediately fails first attempt.

### Pitfall 7: Buffer Length Leak in `timingSafeEqual`

**What goes wrong:** `crypto.timingSafeEqual` throws if buffers have different lengths. If code compares unequal-length strings, it throws an exception rather than returning false — and the exception path is faster than the equal-length comparison path, still leaking timing.

**Why it happens:** timingSafeEqual requires identical buffer sizes.

**How to avoid:** Always check `inputBuf.length === expectedBuf.length` first, short-circuiting with `false` before calling timingSafeEqual. The short-circuit itself reveals length, which is acceptable for a known-length environment variable password.

**Warning signs:** Login API returns 500 instead of 401 for wrong-length passwords.

## Code Examples

Verified patterns from official sources:

### jose: encrypt/decrypt session

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication#stateless-sessions
import { SignJWT, jwtVerify } from 'jose'

const encodedKey = new TextEncoder().encode(process.env.AUTH_SECRET)

export async function encrypt(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload
  } catch {
    return null
  }
}
```

### proxy.ts: reading cookies and redirecting

```typescript
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy#using-cookies
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  // Read cookie from request (NOT from next/headers cookies())
  const sessionValue = request.cookies.get('session')?.value

  // Redirect with callback URL preserved
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
```

### Cookie options (7-day persistent)

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication#setting-cookies-recommended-options
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
cookieStore.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  expires: expiresAt,     // persistent across browser restarts
  sameSite: 'lax',
  path: '/',
})
```

### Generating AUTH_SECRET

```bash
# Run once, paste output into .env.local as AUTH_SECRET=<value>
openssl rand -base64 32
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` + `export function middleware()` | `proxy.ts` + `export function proxy()` | Next.js v16.0.0 | Must use `proxy.ts`; `middleware.ts` deprecated |
| Edge Runtime only for proxy | Node.js Runtime (stable) | Next.js v15.5.0 | Node.js built-ins available in proxy; full crypto module access |
| jsonwebtoken for JWT | jose for JWT | Became standard ~2022 | Edge-compatible; jose is what official docs use |

**Deprecated/outdated:**
- `middleware.ts`: Renamed to `proxy.ts` in Next.js 16.0.0. Using `middleware.ts` will not work.
- `export function middleware()`: Must be `export function proxy()` or `export default function proxy()`.
- `jsonwebtoken`: Not edge-compatible; conflicts with Next.js proxy if edge runtime is used.

## Open Questions

1. **AUTH_SECRET rotation after CVE-2025-66478**
   - What we know: CVE-2025-66478 (React Server Components RCE) affected Next.js 16.x. The advisory recommended rotating all secrets if the app was online and unpatched between December 3-6, 2025.
   - What's unclear: Whether the project's current `AUTH_SECRET` (if set) was exposed during that window.
   - Recommendation: Generate a fresh `AUTH_SECRET` during this phase implementation regardless. Document in CLAUDE.md or phase notes.

2. **FORK-01 vs AUTH-05 tension resolved by proxy coverage**
   - What we know: AUTH-05 requires API routes to independently verify session. FORK-01 prevents modifying existing route files. The resolution is that proxy.ts covers API routes via the matcher.
   - What's unclear: Whether "defense-in-depth" is satisfied by proxy coverage alone or requires route-level checks.
   - Recommendation: Accept proxy-level coverage for API routes as the defense-in-depth mechanism. Document this explicitly in code comments. If FORK-01 is ever relaxed, add verifySession() to route handlers.

3. **`/api/auth/login` itself in the proxy matcher**
   - What we know: The proxy matcher will also match `/api/auth/login`. If the login route is protected by the proxy, unauthenticated users cannot submit the login form.
   - What's unclear: This could cause an infinite loop — redirect to /login → submit to /api/auth/login → blocked by proxy.
   - Recommendation: Add `/api/auth/login` to the early-return whitelist in proxy.ts (alongside `/login`). This is the same pattern as excluding the login page from auth checks.

## Sources

### Primary (HIGH confidence)

- https://nextjs.org/docs/app/api-reference/file-conventions/proxy (Next.js 16.1.6 official docs) - proxy.ts file convention, matcher patterns, cookie API, runtime
- https://nextjs.org/docs/app/guides/authentication (Next.js 16.1.6 official docs) - stateless sessions, jose integration, cookie options, verifySession pattern
- https://nextjs.org/blog/next-16-1 (Next.js 16.1 release blog, December 18, 2025) - confirmed 16.1 is stable release
- https://github.com/panva/jose (jose library GitHub) - v6.x current version, SignJWT/jwtVerify API

### Secondary (MEDIUM confidence)

- https://vercel.com/blog/postmortem-on-next-js-middleware-bypass - CVE-2025-29927 postmortem; confirmed defense-in-depth recommendation
- https://nextjs.org/blog/CVE-2025-66478 - CVE-2025-66478 advisory; confirmed 16.1.x affected; rotation recommendation
- https://nextjs.org/blog/security-update-2025-12-11 - Additional RSC CVEs December 2025; 16.0.x patches noted
- WebSearch: jose v6.1.3 is the latest version (multiple sources agree)

### Tertiary (LOW confidence)

- WebSearch: Next.js 16.1.6 is latest stable as of February 2026 (releasebot.io — not official, but aligns with package.json version)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - jose + proxy.ts confirmed by official Next.js 16.1.6 documentation
- Architecture: HIGH - patterns taken directly from official authentication guide
- Pitfalls: HIGH for documented pitfalls (Next.js docs explicitly warn about _next/data, cookie security); MEDIUM for timing pitfalls (well-known crypto patterns)
- FORK-01/AUTH-05 resolution: MEDIUM - logical resolution, confirmed by reading CONTEXT.md notes about this tension

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (30 days; Next.js and jose are relatively stable in this area)
