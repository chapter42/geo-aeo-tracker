# Architecture Research

**Domain:** Next.js App Router shared password protection
**Researched:** 2026-02-28
**Confidence:** HIGH

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         NETWORK EDGE                            │
├─────────────────────────────────────────────────────────────────┤
│  proxy.ts (formerly middleware.ts in Next.js <= 15)             │
│  - Reads auth cookie on every request                           │
│  - Redirects unauthenticated requests to /login                 │
│  - Allows /login and /_next/* to pass through                   │
│  - DOES NOT set cookies (read-only at this layer)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
┌─────────▼─────────┐       ┌──────────▼──────────────┐
│  /login           │       │  All protected routes    │
│  Page (Server     │       │  /, /demo, /api/*        │
│  Component)       │       │  (reached only if cookie │
│  Renders form     │       │   is valid)              │
└─────────┬─────────┘       └─────────────────────────-┘
          │ form POST
┌─────────▼──────────────────────────────────────────────────────┐
│  POST /api/auth/login   (Route Handler — Node.js runtime)       │
│  - Validates password against process.env.APP_PASSWORD          │
│  - Sets httpOnly, Secure, SameSite=Lax cookie on success        │
│  - Returns 200 + redirect or 401 on failure                     │
└────────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────┐
│  Auth Cookie  (browser ↔ server)                                │
│  Name: app-auth (or similar)                                    │
│  Value: HMAC-signed token or opaque hash                        │
│  Flags: httpOnly, Secure, SameSite=Lax, path=/                  │
│  Expiry: 7 days (rolling or fixed)                              │
└────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `proxy.ts` | Request-level auth gate — checks every incoming HTTP request for valid cookie, redirects to /login if absent | Next.js proxy file at project root; runs Node.js runtime in Next.js 16 |
| `POST /api/auth/login` | Password validation and cookie issuance — the only place the password is compared and the cookie is written | Route Handler in `app/api/auth/login/route.ts` |
| `POST /api/auth/logout` | Cookie deletion — clears auth cookie and redirects to /login | Route Handler in `app/api/auth/logout/route.ts` |
| `/login` page | UI form — collects password, POSTs to API route, shows errors | Server Component at `app/login/page.tsx` |
| Auth cookie | Auth state carrier — stateless token that proxy checks on every request | `httpOnly` cookie set by login API route |
| API routes (existing) | Protected endpoints — the proxy gate means they receive requests only if cookie is valid | No changes needed to existing `/api/scrape`, `/api/audit`, `/api/analyze` |

---

## Recommended Project Structure

This is the minimal set of new files. Every other file in the project remains untouched.

```
geo-aeo-tracker/
├── proxy.ts                        # NEW — request gate (replaces middleware.ts in Next.js 16)
├── app/
│   ├── login/
│   │   └── page.tsx                # NEW — password form UI
│   └── api/
│       └── auth/
│           ├── login/
│           │   └── route.ts        # NEW — validates password, sets cookie
│           └── logout/
│               └── route.ts        # NEW — clears cookie
├── lib/
│   └── auth.ts                     # NEW — shared cookie config constants
└── .env.local                      # MODIFIED — add APP_PASSWORD, AUTH_SECRET
```

**Total new files: 5. Modified files: 1 (.env.local). Zero changes to existing app code.**

### Structure Rationale

- **`proxy.ts` at project root**: Required location for Next.js 16. `middleware.ts` is deprecated in Next.js 16 (runs Edge runtime); `proxy.ts` is the replacement running Node.js runtime. Both names still work in 16.1.6 — proxy.ts is the forward-compatible choice.
- **`app/login/`**: Standard convention for a public auth page. Separate from `/demo` and `/` (both gated).
- **`app/api/auth/`**: Keeps auth API routes namespaced, easy to recognize and easy to exclude from future route-level changes.
- **`lib/auth.ts`**: Single source of truth for cookie name, secret key access, and token generation/verification. Used by both `proxy.ts` and the login/logout route handlers.

---

## Architectural Patterns

### Pattern 1: Cookie Check in Proxy + Single Login API Route

**What:** `proxy.ts` reads the auth cookie on every request. If missing or invalid, redirect to `/login`. The login page is a simple form that POSTs to `/api/auth/login`, which validates the password and sets the cookie.

**When to use:** Always — this is the canonical pattern for Next.js App Router shared password protection. No external dependencies required.

**Trade-offs:** Minimal — proxy runs on every request which adds a small latency overhead (microseconds). Cookie check is synchronous hash comparison, not a DB lookup. There is no session server — all state is in the cookie itself.

**Example (proxy.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'app-auth'
const LOGIN_PATH = '/login'

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page and Next.js internals through
  if (pathname.startsWith(LOGIN_PATH) || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  // Check for valid auth cookie
  const cookie = request.cookies.get(AUTH_COOKIE)
  if (!cookie?.value || !isValidToken(cookie.value)) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Example (app/api/auth/login/route.ts):**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = generateToken()   // HMAC-SHA256 of secret + timestamp
  const response = NextResponse.json({ ok: true })

  response.cookies.set('app-auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,    // 7 days
  })

  return response
}
```

### Pattern 2: Stateless HMAC Token (no iron-session or JWT library)

**What:** The auth cookie value is an HMAC-SHA256 hash of `${secret}:${timestamp}`. Verification in `proxy.ts` re-derives the HMAC and compares. No external library required — uses Node.js built-in `crypto`.

**When to use:** For a single shared password with no per-user identity. Using a raw password hash would expose the password if the cookie is ever leaked; an HMAC adds a server-controlled secret so cookie values cannot be forged even if the password is known.

**Trade-offs:** Simple to implement; requires `AUTH_SECRET` env var in addition to `APP_PASSWORD`. No session expiry beyond the cookie `maxAge` — revocation requires changing `AUTH_SECRET`.

**Example (lib/auth.ts):**
```typescript
import { createHmac } from 'crypto'

const SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me'

export function generateToken(): string {
  const ts = Date.now().toString()
  const sig = createHmac('sha256', SECRET).update(ts).digest('hex')
  return `${ts}.${sig}`
}

export function isValidToken(token: string): boolean {
  const [ts, sig] = token.split('.')
  if (!ts || !sig) return false
  const expected = createHmac('sha256', SECRET).update(ts).digest('hex')
  // Constant-time comparison
  return expected.length === sig.length &&
    createHmac('sha256', SECRET).update(expected).digest('hex') ===
    createHmac('sha256', SECRET).update(sig).digest('hex')
}
```

**Alternative (simpler, slightly less rigorous):** Set the cookie value to `HMAC(secret, password)` — a static token that never expires except when `AUTH_SECRET` changes. Suitable for an internal tool; skip the timestamp-based revocation if simplicity is preferred.

### Pattern 3: Defense-in-Depth — Proxy + API Route Check

**What:** In addition to the proxy gate, each existing API route independently checks the auth cookie before processing the request. This makes authentication resilient against CVE-2025-29927-style middleware bypass vectors.

**When to use:** Recommended for any externally exposed deployment. One-line guard per API route.

**Trade-offs:** Adds ~5 lines to each API route handler. Slightly more merge surface. Worth it for any app exposed to the internet.

**Example (added to app/api/scrape/route.ts):**
```typescript
import { isValidToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // Defense-in-depth: verify auth independent of proxy
  const token = req.cookies.get('app-auth')?.value
  if (!token || !isValidToken(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... existing handler code unchanged
}
```

---

## Data Flow

### Authentication Request Flow

```
Browser → POST /api/auth/login { password }
              ↓
         Route Handler: compare password to process.env.APP_PASSWORD
              ↓ (match)
         Generate HMAC token
              ↓
         Set httpOnly cookie: app-auth=<token>
              ↓
         Return { ok: true } or redirect to original path
              ↓
Browser (cookie stored automatically by browser)
```

### Protected Page Request Flow

```
Browser → GET /  (or any path except /login)
              ↓
         proxy.ts executes
              ↓
         Read cookies.get('app-auth')
              ↓ (cookie present)
         isValidToken(cookie.value)
              ↓ (valid)
         NextResponse.next() — request continues to page/API handler
              ↓ (invalid or absent)
         NextResponse.redirect('/login?redirect=/')
```

### Auth State Through the App

Auth state is entirely in the HTTP cookie:

- **`proxy.ts`**: reads cookie via `request.cookies.get()` — synchronous, no DB, no external call
- **Server Components**: can read cookie via `await cookies()` from `next/headers` if needed
- **Client Components**: cannot directly read the `httpOnly` cookie — they rely on the server either serving the page (meaning auth passed) or redirecting
- **API Routes**: can verify cookie via `request.cookies.get()` for defense-in-depth

There is no React Context, no Zustand store, no global auth state. Auth is transparent to the existing application — pages simply render because the proxy allowed them through.

### Key Data Flows

1. **Login:** Browser form → POST `/api/auth/login` → cookie set → redirect to `/`
2. **Authenticated request:** Browser → proxy reads cookie → page renders normally (no app code change needed)
3. **Unauthenticated request:** Browser → proxy redirects to `/login?redirect=<original-path>`
4. **Logout:** Browser → POST `/api/auth/logout` → cookie cleared → redirect to `/login`
5. **API protection (defense-in-depth):** Client → POST `/api/scrape` → route handler reads cookie → proceeds or returns 401

---

## Build Order (What Depends on What)

Build in this order to minimize broken states:

1. **`lib/auth.ts`** — no dependencies; provides `generateToken` and `isValidToken`. Needed by everything else.
2. **`app/api/auth/login/route.ts`** — depends on `lib/auth.ts`. Must exist before the login page can submit.
3. **`app/api/auth/logout/route.ts`** — depends on cookie name constant from `lib/auth.ts`.
4. **`app/login/page.tsx`** — depends on login API route existing. Render the form; no auth check (it's a public page).
5. **`proxy.ts`** — depends on `lib/auth.ts`. Deploy last: once this file exists, every unauthenticated request is redirected. Deploying proxy before the login page exists would lock everyone out.
6. **(Optional) Defense-in-depth guards in existing API routes** — depends on `lib/auth.ts`. Add after the full flow is tested.

---

## Minimizing Files Changed (Fork Sync Preservation)

This is the central constraint for this project.

| File | Status | Notes |
|------|--------|-------|
| `proxy.ts` | NEW — not in upstream | Zero conflict risk; upstream will never add this |
| `app/login/page.tsx` | NEW — not in upstream | Zero conflict risk |
| `app/api/auth/login/route.ts` | NEW — not in upstream | Zero conflict risk |
| `app/api/auth/logout/route.ts` | NEW — not in upstream | Zero conflict risk |
| `lib/auth.ts` | NEW — not in upstream | Zero conflict risk |
| `.env.local` | LOCAL ONLY — never committed | No conflict risk; not tracked by git |
| `app/api/scrape/route.ts` | MODIFIED if defense-in-depth added | Conflict risk: upstream may modify this file |
| `app/api/audit/route.ts` | MODIFIED if defense-in-depth added | Conflict risk: upstream may modify this file |
| `app/api/analyze/route.ts` | MODIFIED if defense-in-depth added | Conflict risk: upstream may modify this file |

**Recommendation:** All new files are safe to add with zero merge conflict risk. The optional defense-in-depth guards (modifying existing API routes) are the only files with conflict risk — consider whether the security benefit justifies the merge maintenance overhead for an internal tool deployed on Vercel (where Vercel's infrastructure already strips the `x-middleware-subrequest` header).

**The proxy-only approach (no API route changes) touches zero existing files.**

---

## Anti-Patterns

### Anti-Pattern 1: Protecting Routes Only Via Proxy, No API Route Check

**What people do:** Rely entirely on `proxy.ts`/`middleware.ts` for all auth enforcement, including API routes.

**Why it's wrong:** CVE-2025-29927 (March 2025) demonstrated that the `x-middleware-subrequest` header could be spoofed to bypass middleware entirely. Next.js 16.1.6 ships with the fix, but the pattern itself remains fragile — defense-in-depth is always preferable.

**Do this instead:** Add a single `isValidToken(req.cookies.get('app-auth')?.value)` check at the top of each API route handler. Five lines per route, zero dependencies.

### Anti-Pattern 2: Storing the Raw Password as the Cookie Value

**What people do:** Set the cookie value to the plaintext or base64-encoded password.

**Why it's wrong:** Anyone who can observe the cookie (via browser devtools, logs, or a future vulnerability) learns the password directly. The password can then be used to authenticate from any machine.

**Do this instead:** Store an HMAC-SHA256 token derived from a separate `AUTH_SECRET`. The token proves knowledge of the password without exposing it. Rotating `AUTH_SECRET` invalidates all sessions without changing `APP_PASSWORD`.

### Anti-Pattern 3: Using a Full Auth Library (Auth.js/NextAuth, iron-session)

**What people do:** Install Auth.js or iron-session for shared password protection, adding 150-400KB of dependencies and 5-10 new files.

**Why it's wrong:** These libraries solve multi-user auth with sessions, OAuth, CSRF protection, role management — none of which is needed for a single shared password. The additional files create more merge conflict surface with upstream. Auth.js in particular adds `app/api/auth/[...nextauth]/route.ts` and a root `auth.ts` configuration that may conflict with upstream if it ever adds auth-related files.

**Do this instead:** Node.js built-in `crypto.createHmac` plus a single Route Handler. Zero new dependencies.

### Anti-Pattern 4: Using HTTP Basic Auth (WWW-Authenticate header)

**What people do:** Send `WWW-Authenticate: Basic realm="..."` from middleware and check the Authorization header.

**Why it's wrong:** Browser native Basic Auth dialogs cannot be customized, dismissed without reloading, or styled. The credentials are sent base64-encoded (not encrypted) in the Authorization header on every request. Browser caching of credentials varies across browsers and cannot be reliably cleared without browser-side tooling.

**Do this instead:** A cookie-based approach with a custom login page provides the same security, is fully styleable, and gives explicit logout control.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 users | No changes; single shared password with HMAC cookie works perfectly |
| 50-1k users | No changes; proxy check is stateless — there is nothing to scale |
| 1k+ users | At this scale, reconsider whether a shared password is appropriate — individual accounts with a real auth library become necessary |

Password rotation (changing `APP_PASSWORD`) does not invalidate existing sessions unless `AUTH_SECRET` is also rotated. For small teams this is acceptable; document it.

---

## Integration Points

### External Services

None — this implementation is fully self-contained. No database, no third-party auth service, no JWT library.

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `proxy.ts` ↔ `lib/auth.ts` | Direct import | `lib/auth.ts` must be edge-compatible if `middleware.ts` is used; Node.js crypto is available in `proxy.ts` (Node.js runtime in Next.js 16) |
| Login page ↔ `/api/auth/login` | HTTP POST (form submit or fetch) | Standard Route Handler; can return JSON or redirect |
| `/api/auth/login` ↔ browser | `Set-Cookie` response header | Browser stores cookie automatically; no client-side storage needed |
| Existing API routes ↔ `lib/auth.ts` | Direct import (defense-in-depth only) | Optional; adds one import to each existing route file |

---

## Next.js 16 Naming Note

In Next.js 16, `middleware.ts` is **deprecated** in favor of `proxy.ts`. The exported function is renamed from `middleware` to `proxy`. The CVE-2025-29927 fix (for the `x-middleware-subrequest` header bypass) was incorporated into Next.js before version 16 was released (the fix landed in 14.2.25 and 15.2.3 in March 2025; Next.js 16 was released October 2025). Therefore, **Next.js 16.1.6 is not vulnerable to CVE-2025-29927**. Vercel-hosted deployments additionally benefit from infrastructure-level header stripping regardless of Next.js version.

---

## Sources

- Next.js 16 official release notes: https://nextjs.org/blog/next-16 (HIGH confidence — official)
- Next.js 16.1.6 authentication guide via Context7 (`/vercel/next.js/v16.1.6`): https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/authentication.mdx (HIGH confidence — official)
- Next.js 16.1.6 proxy/middleware API via Context7: https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/03-api-reference/03-file-conventions/proxy.mdx (HIGH confidence — official)
- CVE-2025-29927 postmortem: https://vercel.com/blog/postmortem-on-next-js-middleware-bypass (HIGH confidence — official Vercel)
- CVE-2025-29927 technical analysis: https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/ (MEDIUM confidence — Datadog Security Labs)
- Password protection with iron-session (revisited): https://www.alexchantastic.com/revisiting-password-protecting-next (MEDIUM confidence — community, detailed walkthrough)
- Original password protection article: https://www.alexchantastic.com/password-protecting-next (MEDIUM confidence — community)

---

*Architecture research for: Next.js App Router shared password protection*
*Researched: 2026-02-28*
