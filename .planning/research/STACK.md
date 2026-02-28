# Stack Research

**Domain:** Shared password protection for Next.js App Router on Vercel
**Researched:** 2026-02-28
**Confidence:** HIGH

---

## Context: What This Research Covers

The existing app (geo-aeo-tracker) is a Next.js 16.1.6 App Router app with TypeScript, React 19, and Zod already installed. The goal is to add a single shared-password gate over the entire app with minimal code changes to preserve upstream fork sync. No database, no user accounts, no OAuth.

This research covers only the password-protection layer. The rest of the stack (Next.js, React, Tailwind, Recharts, idb-keyval, Zod) is documented in `.planning/codebase/STACK.md` and should not change.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js built-in `proxy.ts` | Ships with Next.js 16 | Request interception + redirect to login | Zero additional dependency. In Next.js 16, `middleware.ts` is deprecated in favor of `proxy.ts`. The rename is cosmetic — logic is identical — but using `proxy.ts` avoids a deprecation warning on the current version. Runs on Node.js runtime. |
| `jose` | 6.x (latest: 6.1.3 as of Feb 2026) | JWT signing and verification for stateless session cookies | The **official Next.js authentication docs** use `jose` for stateless session encryption. It is Edge-compatible (uses Web Crypto API, not Node.js crypto), tree-shakeable ESM with no dependencies, and works in both proxy/middleware and Server Components. Already the recommended library in Next.js 16.1.6 official docs. |
| Next.js `cookies()` API | Ships with Next.js 16 | Set/read httpOnly session cookie | Built-in. No library needed to manage the cookie itself. Replaces the `iron-session` cookie wrapper for this simple use case. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | latest (0.0.x) | Prevents session decrypt logic from accidentally running on client | Add to `lib/session.ts` to enforce server boundary. Zero runtime overhead — build-time guard only. |

### What Does NOT Need to Be Added

The existing `zod` 4.3.6 dependency already handles form validation. No new validation library is needed.

---

## Installation

```bash
# jose for JWT session encryption/decryption
npm install jose

# server-only to enforce server boundary on session utilities
npm install server-only
```

No dev dependencies required for this feature.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `jose` + built-in `cookies()` | `iron-session` v8.0.4 | iron-session is well-suited for this pattern and is listed in Next.js official docs alongside jose. However, it is an additional dependency that wraps the same `cookies()` API. For a single boolean flag (`isAuthenticated`), the wrapper adds no meaningful value over direct `jose` usage. Also, iron-session has not had a release in ~1 year (last: v8.0.4), while jose is actively maintained. |
| Custom login page + `proxy.ts` | Basic HTTP Auth (`WWW-Authenticate` header) | Basic Auth sends credentials as base64 on every request, offers no session persistence (browser re-prompts on refresh in some browsers), and cannot be styled. Not appropriate even for internal tools in 2025. |
| Custom login page + `proxy.ts` | `next-auth` / Auth.js v5 | Massive overkill. NextAuth is designed for OAuth providers, multi-user accounts, and database-backed sessions. It requires significant configuration and adds ~dozen transitive dependencies. The added complexity creates more merge conflict surface area against upstream. Official Next.js recommendation for simple cases is jose + stateless cookies, not NextAuth. |
| Custom login page + `proxy.ts` | Vercel Password Protection (Pro feature) | Vercel offers built-in password protection at the platform level (no code changes needed), but only on Pro/Enterprise plans. If the deployment is on the free tier, this is unavailable. Even on Pro, using platform-level auth means the protection disappears if the app is ever moved off Vercel. Code-level protection is more portable. **If the project is on Vercel Pro, this is the zero-code alternative.** |
| `proxy.ts` | `middleware.ts` | `middleware.ts` is deprecated in Next.js 16 (renamed to `proxy.ts`). The logic is identical; only the filename and exported function name change. Use `proxy.ts` to avoid deprecation warnings on the current version. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `next-auth` / Auth.js | Designed for multi-user auth with OAuth, user DBs, sessions in DB. Adds ~15+ dependencies, requires `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, provider config, and session adapter. Every config file it touches becomes a merge conflict point. | `jose` + `proxy.ts` + custom `/login` page |
| `jsonwebtoken` npm package | Uses Node.js-specific `crypto` APIs, incompatible with Edge Runtime and with `proxy.ts` (which runs on Node.js runtime in Next.js 16, but `jose` remains the documented recommendation for cross-runtime compatibility). | `jose` |
| `bcrypt` | Unnecessary. We are not hashing a stored user password — we are doing a direct string comparison against an env-var secret. `bcrypt` would slow down every request. | `crypto.timingSafeEqual()` (built-in Node.js) for timing-safe comparison, or simple `===` since the secret is not user-chosen |
| `iron-session` | Not wrong, but adds a dependency when the same pattern is achievable with `jose` alone. iron-session's last npm release is over a year old. | `jose` + `cookies()` |
| Storing password in `next.config.ts` | `next.config.ts` is committed to source control. Never put secrets there. | Vercel environment variable `AUTH_SECRET` (or `SESSION_SECRET`) set in Vercel dashboard |
| Relying on `proxy.ts` as the sole auth layer | Vercel's official postmortem on CVE-2025-29927 states: "We do not recommend Middleware to be the sole method of protecting routes." CVE-2025-29927 allowed bypassing middleware via a crafted `x-middleware-subrequest` header. The fix is in Next.js 14.2.25 and 15.2.3. Next.js 16 is not explicitly mentioned as a separate patch but was released after these fixes were incorporated. | Use `proxy.ts` for redirect UX **plus** verify session in each API route handler via a shared `verifySession()` helper. |

---

## Implementation Pattern

This is the standard 2025/2026 approach documented in Next.js 16 official docs and confirmed by the community:

### Files to Create (all new, isolated, minimal conflict surface)

```
proxy.ts                    ← Renamed from middleware.ts; redirects unauthenticated requests
app/login/page.tsx          ← Simple password form (Server Component + Server Action)
lib/session.ts              ← encrypt/decrypt using jose (marked server-only)
```

### Session Flow

```
1. User visits any route
2. proxy.ts checks for valid 'session' cookie
   - No valid cookie → redirect to /login
   - Valid cookie → NextResponse.next()
3. /login page renders a password form
4. Form submits via Server Action
   - Server Action reads AUTH_PASSWORD env var
   - Compares submitted password (timing-safe)
   - On match: creates signed JWT cookie (jose), redirects to /
   - On fail: returns error state
5. API routes: each handler calls verifySession() from lib/session.ts
   - Returns 401 if no valid session (defense-in-depth against proxy bypass)
```

### Key Implementation Details

**`lib/session.ts`** — uses `jose` for stateless JWT:
```typescript
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const key = new TextEncoder().encode(process.env.SESSION_SECRET)

export async function encrypt(payload: object) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key)
}

export async function decrypt(token: string | undefined) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] })
    return payload
  } catch {
    return null
  }
}

export async function createSession() {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const token = await encrypt({ authenticated: true, expires })
  const store = await cookies()
  store.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires,
    sameSite: 'lax',
    path: '/',
  })
}

export async function verifySession() {
  const store = await cookies()
  const token = store.get('session')?.value
  return decrypt(token)
}

export async function deleteSession() {
  const store = await cookies()
  store.delete('session')
}
```

**`proxy.ts`** — optimistic check only (per Next.js 16 docs pattern):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const PUBLIC_PATHS = ['/login']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }
  const token = req.cookies.get('session')?.value
  const session = await decrypt(token)
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Environment variables** — add to Vercel dashboard and `.env.local`:
```bash
SESSION_SECRET=<openssl rand -base64 32>   # 32+ char random string, never committed
AUTH_PASSWORD=<your-shared-password>        # The password users will type
```

---

## Security Considerations

| Concern | Status | Notes |
|---------|--------|-------|
| CVE-2025-29927 (middleware bypass) | Patched in Next.js 14.2.25 / 15.2.3. Next.js 16 was released after this fix. | Defense-in-depth: also verify session in API route handlers. |
| CVE-2025-67779 (incomplete initial fix) | A follow-up CVE for the same class of vulnerability. Patch applied to Next.js 15.x. Next.js 16 was released post-fix. | Same mitigation: defense-in-depth with API route verification. |
| Timing attack on password comparison | Use `crypto.timingSafeEqual()` in the Server Action when comparing `AUTH_PASSWORD` to submitted value. | Prevents timing-based password enumeration. |
| Session secret in source control | Never. Store only in Vercel environment variables dashboard. | Use `.env.local` (gitignored) for local dev. |
| Cookie security | `httpOnly: true`, `secure: true` in production, `sameSite: lax` | Prevents XSS cookie theft and CSRF. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|----------------|-------|
| `jose@6.x` | Next.js 16.x, React 19, Node.js 20+ | Web Crypto API — works in Node.js runtime and Edge runtime. Confirmed as Next.js official docs recommendation. |
| `server-only@0.0.x` | Any Next.js App Router version | Build-time guard, no runtime impact. |
| `proxy.ts` file convention | Next.js 16+ | In Next.js 15 and below, use `middleware.ts` instead. This project is on 16.1.6, so `proxy.ts` is correct. |

---

## Stack Patterns by Variant

**If running on Vercel Pro/Enterprise:**
- Vercel's built-in Password Protection (Deployment Protection) is a zero-code alternative
- Set it in Vercel Dashboard > Settings > Deployment Protection
- Trade-off: platform lock-in, invisible to codebase, disappears if hosting changes

**If this were multi-user (not applicable here):**
- Use NextAuth / Auth.js v5 or Better Auth for full OAuth + session management
- This use case is explicitly out of scope (see PROJECT.md)

**If the app were on Pages Router (not applicable here):**
- Use `middleware.ts` (not `proxy.ts`) — `proxy.ts` is App Router / Next.js 16+ only

---

## Sources

- Next.js 16 official authentication guide — https://nextjs.org/docs/app/guides/authentication (fetched 2026-02-28, version 16.1.6) — HIGH confidence
- Next.js 16 release notes — https://nextjs.org/blog/next-16 — `proxy.ts` rename, confirmed middleware deprecation — HIGH confidence
- Vercel postmortem on CVE-2025-29927 — https://vercel.com/blog/postmortem-on-next-js-middleware-bypass — "do not recommend Middleware as sole protection" — HIGH confidence
- jose npm package — https://www.npmjs.com/package/jose — version 6.1.3, Edge-compatible — HIGH confidence (cross-referenced with Next.js official docs)
- iron-session GitHub — https://github.com/vvo/iron-session — v8, App Router compatible, last published ~1yr ago — MEDIUM confidence (no version explicitly on page, inferred from search results)
- Alex Chan: Revisiting password protecting routes in Next.js — https://www.alexchantastic.com/revisiting-password-protecting-next — iron-session + Next.js 15 pattern — MEDIUM confidence (community article, aligned with official docs)
- CVE-2025-29927 / CVE-2025-67779 WebSearch results — MEDIUM confidence (multiple sources agree on patch versions and nature of vulnerability)

---

*Stack research for: shared password protection on Next.js 16 App Router*
*Researched: 2026-02-28*
