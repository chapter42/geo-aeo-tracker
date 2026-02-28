# Pitfalls Research

**Domain:** Next.js password protection on a forked repo (App Router + Vercel deployment)
**Researched:** 2026-02-28
**Confidence:** HIGH — verified against official Next.js 16 docs, CVE postmortem, and multiple community sources

---

## Critical Pitfalls

### Pitfall 1: Relying Solely on Middleware/Proxy for Authentication

**What goes wrong:**
The authentication check in `middleware.ts` (now `proxy.ts` in Next.js 16) is treated as the single source of truth. If middleware is bypassed or misconfigured, every API route and page is unprotected.

**Why it happens:**
Middleware sits at the network edge and intercepts all requests, so it feels like a complete perimeter. Developers assume one gatekeeper is enough. CVE-2025-29927 (March 2025) proved this wrong: attackers could send a spoofed `x-middleware-subrequest` header to completely skip middleware on self-hosted deployments, gaining access to every protected route without credentials.

Vercel's own postmortem (https://vercel.com/blog/postmortem-on-next-js-middleware-bypass) explicitly states: "We do not recommend Middleware to be the sole method of protecting routes in your application."

**How to avoid:**
Implement defense in depth. The proxy/middleware handles the redirect UX (unauthenticated users see the login page). The API routes independently verify the session cookie before returning any data. This means both layers check auth, so bypassing one does not expose data.

For this project: every `app/api/*/route.ts` must check the session cookie at the top of the handler, independent of whether proxy.ts catches the request first.

```typescript
// app/api/scrape/route.ts — add at the top of POST handler
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const session = cookieStore.get('auth-session')
  if (!session?.value || session.value !== process.env.AUTH_SESSION_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }
  // ... existing handler logic
}
```

**Warning signs:**
- Auth check lives only in `middleware.ts`/`proxy.ts` with no secondary check in route handlers
- `app/api/` routes return 200 for unauthenticated requests when tested directly with curl or Postman
- No verification logic in `app/layout.tsx` or route handlers

**Phase to address:** Password protection implementation phase (Phase 1 / initial implementation)

---

### Pitfall 2: Storing or Comparing the Password in Plain Text with `===`

**What goes wrong:**
The environment variable `SITE_PASSWORD` is compared directly: `password === process.env.SITE_PASSWORD`. This is vulnerable to timing attacks, where an attacker can measure response latency to determine how many characters of their guess matched before comparison failed.

**Why it happens:**
String equality with `===` exits at the first mismatched character. The more characters match, the slightly longer the comparison takes. While the risk is low for a single shared password on a private dashboard, using `===` is still a security anti-pattern that signals the implementation wasn't built with security in mind.

**How to avoid:**
Use `crypto.timingSafeEqual()` (available in both Node.js runtime and the Next.js Edge runtime on Vercel) to compare password values in constant time:

```typescript
import { timingSafeEqual } from 'crypto'

function verifyPassword(input: string, expected: string): boolean {
  if (input.length !== expected.length) return false
  return timingSafeEqual(
    Buffer.from(input, 'utf8'),
    Buffer.from(expected, 'utf8')
  )
}
```

Do not store the raw password in a cookie. Store a derived session token (e.g., a random UUID or HMAC signature) and validate that instead on subsequent requests.

**Warning signs:**
- Password check uses `=== ` or `==` operator
- The raw password from the env var is stored directly as the cookie value
- No use of `crypto.timingSafeEqual` or equivalent

**Phase to address:** Password verification route implementation

---

### Pitfall 3: Leaking the Password via a `NEXT_PUBLIC_` Environment Variable

**What goes wrong:**
Using `NEXT_PUBLIC_SITE_PASSWORD` or any `NEXT_PUBLIC_` prefix causes Next.js to inline the variable into the client-side JavaScript bundle at build time. Anyone who inspects the browser bundle (e.g., via DevTools > Sources or `strings ./build`) retrieves the password in plain text.

**Why it happens:**
The `NEXT_PUBLIC_` prefix convention is used for config that must be accessible in client components (e.g., analytics IDs, public API URLs). It is tempting to expose the password to the client so the login page can validate it locally, which is a complete security failure.

**How to avoid:**
- Use a plain environment variable name with no `NEXT_PUBLIC_` prefix: `SITE_PASSWORD`
- The password check must happen exclusively in a server-side route handler (`POST /api/login` or a Server Action)
- The login page's form submits to the server; the server compares and sets the cookie

**Warning signs:**
- Any env var containing "password" or "secret" prefixed with `NEXT_PUBLIC_`
- Client components directly import or read the password env var
- Password validation logic in a file that is a Client Component (`'use client'` directive)

**Phase to address:** Environment variable setup and login route creation

---

### Pitfall 4: Fork Merge Conflicts from Adding `middleware.ts` / `proxy.ts` When Upstream Adds Their Own

**What goes wrong:**
This project adds `middleware.ts` (or `proxy.ts`) to gate the entire app. If upstream also adds a middleware file (for analytics, A/B testing, bot protection, etc.), the next `git merge upstream/main` produces a merge conflict in this single file. Next.js only supports one middleware/proxy file per project — there is no native composition mechanism.

**Why it happens:**
Next.js enforces a single `middleware.ts` at the project root. Unlike normal modules, you cannot have multiple middleware files that get merged automatically. The fork's auth middleware and upstream's new middleware cannot coexist without manual composition.

Additionally, Next.js 16 renamed `middleware.ts` to `proxy.ts`. If upstream upgrades to Next.js 16 while this fork still uses `middleware.ts`, the merge produces two different files targeting the same runtime slot, and the behavior is undefined.

**How to avoid:**
1. Keep the middleware/proxy file as minimal as possible — only the cookie check and redirect logic, no business logic.
2. Structure the auth check as a composable function in a separate file (e.g., `lib/auth/check-session.ts`) that gets imported into the middleware. This makes the middleware file a thin wrapper that is easier to manually merge.
3. When merging upstream, treat the middleware file as "ours" (the auth layer), and manually integrate any upstream additions as additional calls inside the existing function.
4. Track whether upstream uses Next.js 16's `proxy.ts` naming and migrate accordingly before merging.

```
# Minimal merge-friendly structure
middleware.ts     ← only auth redirect, imports from lib/auth/
lib/auth/
  check-session.ts   ← all auth logic lives here (not in middleware.ts)
  session-cookie.ts  ← cookie read/write helpers
```

**Warning signs:**
- `middleware.ts` contains more than ~30 lines of logic
- Business logic (URL parsing, feature flags, etc.) is inside `middleware.ts` rather than imported helpers
- No habit of checking upstream for `middleware.ts` changes before merging

**Phase to address:** Architecture design before first line of code; enforced during every upstream merge

---

## Moderate Pitfalls

### Pitfall 5: The Matcher Pattern Accidentally Excludes API Routes

**What goes wrong:**
The proxy/middleware `config.matcher` is copied from documentation examples that explicitly exclude `/api/` routes. This is intentional in full-auth setups (to avoid double-auth on API calls from authenticated pages), but in a password-gated app, it means all three API routes (`/api/scrape`, `/api/audit`, `/api/analyze`) are publicly accessible even though the UI is gated.

**Why it happens:**
The canonical Next.js authentication documentation example uses this matcher:
```typescript
matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
```
Copying this pattern without understanding it leaves API routes unprotected.

**How to avoid:**
Either remove `api` from the exclusion list so proxy also redirects unauthenticated API callers, OR (better) keep the matcher as-is but add independent auth checks inside each API route handler. The second approach is more robust and aligns with defense-in-depth (see Pitfall 1).

**Warning signs:**
- Middleware matcher explicitly excludes `/api/`
- No auth verification in route handlers
- Direct POST to `/api/scrape` with no cookies returns a non-401 response

**Phase to address:** Password protection implementation (test API routes separately from UI routes)

---

### Pitfall 6: Cookie Not Sent on First Request After Login (Race Condition)

**What goes wrong:**
The login form posts credentials, the server sets a `Set-Cookie` header, and the response redirects the user to `/`. On that first load, the browser may not yet attach the new cookie to the redirect request, causing the user to bounce back to the login page. This is documented in Next.js GitHub issues (#37761).

**Why it happens:**
When the login route handler sets a cookie and immediately returns a redirect (`NextResponse.redirect`), the browser must process the `Set-Cookie` header, store the cookie, and then follow the redirect — all in sequence. Some browsers do this correctly, but edge cases exist with certain redirect patterns or when the redirect points to a page that triggers server-side rendering before the cookie is fully committed.

**How to avoid:**
Use a two-step redirect: after login, redirect to an intermediate page (or return a 200 with a client-side `window.location` redirect), not a 302 redirect from the same response that sets the cookie. Alternatively, use the pattern recommended in Next.js docs where the `Set-Cookie` is set on the redirect response itself rather than on a prior response.

Test the login flow specifically by checking whether `/` is accessible on the first redirect after login — not just after a subsequent navigation.

**Warning signs:**
- Login works when manually navigating after login, but fails when following the redirect immediately
- Users report needing to refresh after logging in
- Cookie is present in DevTools Application > Cookies only after a manual page reload

**Phase to address:** Login flow implementation and QA testing

---

### Pitfall 7: Cookie Attributes Missing in Development, Forgotten in Production

**What goes wrong:**
During development on `localhost`, `Secure` cookie attribute is omitted (browsers reject `Secure` cookies over HTTP). The code conditionally omits `Secure` based on environment. In production, the condition is forgotten or the env detection is wrong, and the cookie is served without `Secure`, `HttpOnly`, or `SameSite` attributes, making it vulnerable to XSS theft and cross-site request issues.

**Why it happens:**
Developers test on `localhost` (HTTP) where `Secure` must be false. They add `secure: process.env.NODE_ENV === 'production'` and then forget to verify this works correctly in the actual Vercel deployment.

**How to avoid:**
Use this exact pattern and verify it in a Vercel preview deployment before shipping:

```typescript
response.cookies.set({
  name: 'auth-session',
  value: sessionToken,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
})
```

Check Vercel preview URL in browser DevTools > Application > Cookies and confirm all four attributes (`HttpOnly`, `Secure`, `SameSite`, `Max-Age`) are present.

**Warning signs:**
- Cookie attributes hardcoded as `secure: false` anywhere
- No verification step in the QA checklist for production cookie attributes
- `SameSite` attribute not set (defaults to browser-dependent behavior)

**Phase to address:** Login route implementation and pre-deploy QA

---

### Pitfall 8: No Rate Limiting on the Login Endpoint

**What goes wrong:**
The `POST /api/login` (or equivalent Server Action) has no rate limiting. An attacker can script brute-force attempts against the shared password without any throttling. For a private dashboard, this is a low probability threat, but the absence of any protection makes it trivially exploitable by a targeted attacker.

**Why it happens:**
Simple password protection implementations skip rate limiting because it requires additional infrastructure (a stateful counter, Redis/Vercel KV, or an external service). For MVP, the developer judges the risk acceptable and never adds it.

**How to avoid:**
At minimum, implement a simple Vercel Firewall rule to block IPs with more than 10 requests per 60 seconds on the `/api/login` route. This requires zero code changes and is configured in the Vercel dashboard. For code-based rate limiting, `@upstash/ratelimit` with Vercel KV is the standard approach.

For this project, the Vercel Firewall rule approach is preferred — it adds zero code and zero merge conflict risk.

**Warning signs:**
- No rate limiting configured in Vercel Firewall for the login endpoint
- Login endpoint returns consistent 200/401 responses with no delay regardless of attempt count

**Phase to address:** Post-implementation hardening / production checklist

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Auth check only in proxy.ts, not in route handlers | Less code, faster initial implementation | Any middleware bypass (CVE-style, misconfiguration, or test mode) exposes all API data | Never — route handlers must independently verify |
| Plain-text `===` password comparison | Trivially simple | Timing attack vector, signals insecure implementation | Never |
| Session cookie without expiry (`maxAge` omitted) | Simpler code | Sessions never expire; a stolen cookie is valid indefinitely | Never for production |
| No login page styling / error messages | Faster to ship | Users see a broken-looking page; no feedback on wrong password | MVP only, replace before sharing with others |
| Storing the raw password as the cookie value | No session token management | Cookie interception reveals the actual password | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel environment variables | Setting `SITE_PASSWORD` in `.env.local` only; not adding it to Vercel project env vars | Add to Vercel dashboard under Settings > Environment Variables for Preview and Production environments |
| Vercel deployment | Forgetting that Vercel auto-protects against CVE-2025-29927 at the edge — self-hosted `next start` does not | If self-hosting, upgrade to Next.js 15.2.3+ or 16.x immediately |
| Next.js 16 migration | Upstream upgrades to Next.js 16 which renames `middleware.ts` → `proxy.ts`; fork still has `middleware.ts` | During upstream merge, check if `proxy.ts` appears and consolidate auth logic accordingly |
| Cookie in API route vs. middleware | Reading cookies differently: `request.cookies.get()` in middleware vs `cookies()` from `next/headers` in route handlers | Use `request.cookies.get()` in proxy.ts; use `import { cookies } from 'next/headers'` in route handlers |
| Server Actions | Forgetting Server Actions bypass proxy/middleware entirely if action is called directly | Add session check at the top of every Server Action, same as route handlers |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Importing crypto or heavy libraries into proxy.ts | Cold start latency on first request, proxy slower than expected | Keep proxy.ts dependency-free; use only `next/server` imports and simple cookie reads | Any traffic spike where cold starts occur |
| Synchronous password hashing (bcrypt) in the request path | Login endpoint hangs for 100-500ms per request | Use `crypto.timingSafeEqual` for plain-text comparison (no hashing needed for a shared password); if hashing, do it offline and store the hash | Every login request |
| Proxy running on every static asset request | `/_next/static/` and `/_next/image/` requests all hit auth middleware | Add these to the matcher exclusion list | From first deployment |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Password in `NEXT_PUBLIC_` env var | Password exposed in client JS bundle; visible to anyone with browser DevTools | Never prefix auth secrets with `NEXT_PUBLIC_` |
| Middleware as sole auth layer | Auth bypass via header spoofing (CVE-2025-29927) or misconfiguration | Always add independent auth checks in route handlers |
| Cookie without `HttpOnly` | Client-side JavaScript (including injected scripts) can read and exfiltrate the session cookie | Always set `httpOnly: true` |
| Login endpoint without CSRF protection | A malicious site can submit the login form on behalf of a user visiting their page | Set `sameSite: 'lax'` minimum on the cookie; for POST endpoints, verify `Content-Type: application/json` |
| Plain text `===` password comparison | Timing attack reveals password character by character | Use `crypto.timingSafeEqual()` |
| No rate limiting on `/api/login` | Brute-force attack can enumerate the password with enough requests | Vercel Firewall rate limit rule or `@upstash/ratelimit` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Login form with no error message on wrong password | Users confused whether they typed incorrectly or the page is broken | Return and display a clear "Incorrect password" message |
| Session expires without warning, user loses unsaved work | IndexedDB state is preserved but user is redirected to login mid-session | Set a long `maxAge` (7 days) for a shared password dashboard; warn the user before expiry if possible |
| Login page looks identical to a broken app | Users distrust the app; may assume a bug | Give the login page minimal but intentional styling matching the app |
| `/demo` route gated behind password | The demo exists to show the app without credentials; gating it removes its purpose | Confirm intentionally with the project owner whether `/demo` should be gated (PROJECT.md says yes — this is a deliberate decision, not a mistake) |

---

## "Looks Done But Isn't" Checklist

- [ ] **API routes protected:** Test `curl -X POST https://your-app.vercel.app/api/scrape` with no cookies — confirm 401, not 200
- [ ] **Cookie attributes in production:** Deploy to Vercel preview, check DevTools Application > Cookies for `HttpOnly`, `Secure`, `SameSite`, `Max-Age`
- [ ] **Env var not in client bundle:** Run `grep -r "SITE_PASSWORD" .next/static/` — should return empty
- [ ] **Login endpoint rate limited:** Verify Vercel Firewall rule exists for `/api/login` or equivalent
- [ ] **Session survives page reload:** After login, hard reload — should stay logged in
- [ ] **Logout clears cookie:** After logout, confirm cookie is removed and `/` redirects to login
- [ ] **`/demo` gating is intentional:** Confirm with project owner whether demo should be behind auth (PROJECT.md currently says yes)
- [ ] **Upstream `middleware.ts` check:** Before each upstream merge, `git diff upstream/main HEAD -- middleware.ts proxy.ts` to detect new upstream middleware additions

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| API routes bypassed (Pitfall 1 discovered post-deploy) | LOW | Add 5-line auth check to each of the 3 route handlers; redeploy |
| Password leaked in client bundle (Pitfall 3) | MEDIUM | Rotate password immediately, remove `NEXT_PUBLIC_` prefix, rebuild and redeploy; audit who may have seen the bundle |
| Fork conflict in middleware file | MEDIUM | Manually merge both middlewares into one file; test all protected and unprotected routes after merge |
| Cookie timing race condition (Pitfall 6) | LOW | Switch from redirect-on-same-response to client-side redirect after setting cookie |
| No rate limiting and brute force attempted | MEDIUM | Add Vercel Firewall rule immediately (no code deploy required); rotate password |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Middleware-only auth (Pitfall 1) | Implementation: route handler auth | `curl` all 3 API routes without cookie; expect 401 |
| Plain-text comparison (Pitfall 2) | Implementation: login route | Code review: confirm `timingSafeEqual` used |
| `NEXT_PUBLIC_` leak (Pitfall 3) | Implementation: env var setup | `grep -r "SITE_PASSWORD" .next/static/` returns empty |
| Fork middleware conflict (Pitfall 4) | Architecture: file structure decision | Auth logic in `lib/auth/`, not inline in middleware file |
| Matcher excludes API routes (Pitfall 5) | Implementation: test plan | API routes tested separately from page routes |
| Cookie race condition (Pitfall 6) | Implementation: login flow QA | Manual test: login → immediate redirect → confirm no second login prompt |
| Cookie attributes missing in prod (Pitfall 7) | QA: Vercel preview deploy check | DevTools cookie inspection on preview URL |
| No rate limiting (Pitfall 8) | Post-implementation hardening | Vercel Firewall rules present for login endpoint |

---

## Sources

- Next.js 16 official docs on `proxy.ts` migration: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Next.js authentication guide (official): https://nextjs.org/docs/app/guides/authentication
- CVE-2025-29927 postmortem (Vercel): https://vercel.com/blog/postmortem-on-next-js-middleware-bypass
- CVE-2025-29927 technical analysis (ProjectDiscovery): https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass
- Auth0 on Next.js 16 auth changes: https://auth0.com/blog/whats-new-nextjs-16/
- Alex Chan, revisiting password protection in Next.js: https://www.alexchantastic.com/revisiting-password-protecting-next
- Vercel rate limiting guide: https://vercel.com/guides/limit-abuse-with-rate-limiting
- Next.js edge vs Node.js cookies (community): https://blog.gao-studio.com/2025/09/26/nextjs-cookie-set-get/
- NEXT_PUBLIC_ env var security (LogRocket): https://blog.logrocket.com/configure-environment-variables-next-js/
- Cookies set in middleware not available on first SSR load (GitHub issue #37761): https://github.com/vercel/next.js/issues/37761
- Multiple middleware discussion (GitHub): https://github.com/vercel/next.js/discussions/74765
- `crypto.timingSafeEqual` for timing-safe comparison (Node.js docs, Cloudflare): https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/
- Next.js 16 middleware-to-proxy migration (Context7 / official): https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/upgrading/version-16.mdx

---
*Pitfalls research for: Next.js shared-password protection on a forked App Router project deployed to Vercel*
*Researched: 2026-02-28*
