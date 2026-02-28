# Feature Research

**Domain:** Shared password gate for a Next.js web app (fork/upstream-compatible)
**Researched:** 2026-02-28
**Confidence:** HIGH — patterns verified across official Next.js docs (Context7), multiple real implementations, and community discussion

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that define what "password protection" means. Missing any of these and the feature is broken, not shipped.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Login page with password input | The entry point to the gate; users have no other way to authenticate | LOW | Single field, submit button, minimal UI. `/login` or `/sign-in` route. |
| Redirect unauthenticated users to login | Without this, the gate doesn't exist — users bypass protection by going directly to any URL | LOW | Must fire before page renders. Middleware is the right layer. |
| Redirect back to originally requested URL after login | Users expect to land where they tried to go, not a fixed home page | LOW | Pass `callbackUrl` as query param; read it after successful auth. |
| Wrong password error message | Users need feedback when credentials fail; silent failure is broken UX | LOW | Inline error on the form. No page reload required. |
| Persistent session via cookie | Re-entering password on every navigation is unusable | LOW | httpOnly encrypted cookie. All community implementations use this. |
| Protect all pages (entire app) | Partial protection creates security gaps and confuses users | LOW | Middleware matcher covers all routes except static assets. |
| Protect API routes | Data APIs are accessible without this; bypasses the page-level gate entirely | LOW | Include `/api/*` in the middleware matcher. The project has existing API routes for scraping/analysis. |
| Exclude static assets from auth check | Running auth on CSS/JS/images wastes CPU and causes broken loading states | LOW | Matcher regex: `/((?!_next/static|_next/image|favicon.ico).*)` |
| Password configurable via environment variable | Hardcoded passwords cannot be rotated without a deploy; env vars are the standard mechanism | LOW | `SITE_PASSWORD` in `.env.local` and Vercel project settings. |

### Differentiators (Competitive Advantage)

For a simple shared-password gate these are the features that shift "it works" to "it's pleasant to use." None are required, but the high-value ones are cheap to add.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Session expiry with auto-logout | Security hygiene — shared passwords especially warrant expiry so old sessions don't linger indefinitely | LOW | Cookie `maxAge` / `expires`. 7-day default is community standard. Can be configured via env var. |
| Branded / styled login page | A blank unstyled form signals unfinished software; a styled page signals intentionality | LOW | The project already uses Tailwind. Match the app's existing visual style. |
| Loading / submitting state on login form | Prevents double-submit, signals to the user something is happening | LOW | Disable button + show spinner while POST is in-flight. |
| Clear error on wrong password without full page reload | Faster feedback loop; modern UX standard | LOW | Client-side state update on form action response. |
| Logout endpoint | Allows intentional session termination, important for shared machines | LOW | DELETE/POST to `/api/auth/logout` that clears the cookie. Not required for a gate but frequently expected. |
| Exclude `/demo` from password gate | The project currently has a `/demo` route — keeping it public preserves its purpose | LOW | Add `/demo` to the matcher exclusion list. Decision pending per PROJECT.md. |

### Anti-Features (Things to Deliberately NOT Build)

These are features that seem reasonable but would violate the project's stated constraints or create disproportionate complexity.

| Anti-Feature | Why Requested | Why Problematic | What to Do Instead |
|--------------|---------------|-----------------|-------------------|
| Per-user accounts with individual passwords | "What if different people need different access?" | Requires a database, user management, registration flow — eliminates the entire point of a simple gate | Single shared password. Document that this is the design. |
| OAuth / social login (Google, GitHub) | Familiar login UX for end users | Adds 2-3 third-party SDKs, callback URL config, provider secrets — massive scope increase for a fork that wants minimal changes | Shared password only. OAuth is a different product category. |
| Role-based access control | "Admins vs viewers" | Requires user identity, session enrichment, route-level policy — incompatible with shared password model | Shared password grants full access. No roles. |
| "Forgot password" / password reset flow | Standard auth expectation | Requires email sending, token generation, expiry logic — assumes individual accounts | Shared password is shared by all; rotation is done by the admin via env var change + redeploy. |
| Rate limiting / brute-force protection | Real security concern | Correct solution is infrastructure-level (Vercel WAF, Cloudflare) not application-level for a simple gate | Document the limitation. If brute force is a real threat, use a reverse proxy or Vercel protection layer — not app code. |
| Session storage in a database | "Proper" session management | Requires a database connection, schema, migrations — the whole point of the shared-password approach is stateless cookies | Encrypted stateless cookie (iron-session or jose/JWT). No database. |
| Full authentication framework (NextAuth, Clerk, Auth0) | Well-known libraries, good docs | These libraries are built for per-user identity systems. For a shared-password gate they introduce unnecessary abstractions, extra config, and additional files that complicate fork merges | Plain middleware + encrypted cookie. Minimal dependencies. |
| Username field on login form | Looks more "official" | This is a shared password gate. A username implies per-user identity, which doesn't exist here. Adding it confuses the model. | Single password field only. |

---

## Feature Dependencies

```
[Middleware auth check]
    └──requires──> [Session cookie read]
                       └──requires──> [Cookie set on login]
                                          └──requires──> [Login page + form action]

[Redirect to callbackUrl]
    └──requires──> [Middleware auth check]
    └──requires──> [Login page reads callbackUrl param]

[Logout endpoint]
    └──enhances──> [Session cookie] (clears it)

[Protect API routes]
    └──requires──> [Middleware matcher includes /api/*]

[Exclude /demo from gate]
    └──requires──> [Middleware matcher excludes /demo]
    └──conflicts──> [Protect all pages] (intentional exception)
```

### Dependency Notes

- **Cookie set on login** is the foundation: everything else reads this cookie. Get the cookie attributes right first (httpOnly, secure, sameSite, path, expires).
- **Middleware auth check requires cookie read**: The middleware must be able to verify the cookie without a database call — this is why stateless encrypted cookies (not server-side sessions) are the right choice.
- **API route protection requires middleware matcher includes /api/**: The existing app has API routes for scraping and LLM analysis. These are data endpoints; protecting only pages while leaving APIs open would be a false sense of security.
- **Exclude /demo conflicts with protect all pages**: PROJECT.md says "Gate entire app including /demo" but the `/demo` route exists for a reason. This is a product decision, not a technical one. Technically trivial to go either way — add to exclusion list or not.

---

## MVP Definition

### Launch With (v1)

Minimum set to make the gate functional. Nothing else ships until these work end-to-end.

- [ ] `middleware.ts` — intercepts all requests, reads auth cookie, redirects unauthenticated users to `/login` — *the gate mechanism*
- [ ] `/login` page — password input, submit, error state on wrong password — *the entry point*
- [ ] `/api/auth/login` action or Server Action — validates password against `process.env.SITE_PASSWORD`, sets encrypted cookie — *the credential check*
- [ ] Cookie attributes — httpOnly, secure, sameSite=lax, path=/, expires — *session persistence*
- [ ] Middleware matcher exclusion — `_next/static`, `_next/image`, `favicon.ico` — *prevents broken asset loading*
- [ ] API route protection — `/api/*` included in middleware scope — *closes the obvious bypass*
- [ ] `SITE_PASSWORD` env var — configurable without code changes — *operational requirement*

### Add After Validation (v1.x)

Add once the gate works correctly in production.

- [ ] Logout endpoint (`/api/auth/logout`) — when users request the ability to manually end a session
- [ ] Session expiry tuning — if security feedback indicates 7 days is too long/short
- [ ] Styled login page — once core functionality is confirmed working

### Future Consideration (v2+)

Defer unless product direction changes significantly.

- [ ] Per-user accounts — only if the shared-password model is abandoned (different project)
- [ ] Rate limiting — only if brute-force is demonstrated as a real attack vector on this specific deployment

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Middleware auth check (all routes) | HIGH | LOW | P1 |
| Login page with password form | HIGH | LOW | P1 |
| Session cookie (httpOnly, encrypted) | HIGH | LOW | P1 |
| Redirect to callbackUrl post-login | HIGH | LOW | P1 |
| API route protection | HIGH | LOW | P1 |
| Static asset exclusion from middleware | HIGH | LOW | P1 |
| SITE_PASSWORD env var | HIGH | LOW | P1 |
| Wrong password error message | MEDIUM | LOW | P1 |
| Session expiry (cookie maxAge) | MEDIUM | LOW | P1 |
| Styled login page | MEDIUM | LOW | P2 |
| Logout endpoint | MEDIUM | LOW | P2 |
| Loading state on form submit | LOW | LOW | P2 |
| Per-user accounts | HIGH | HIGH | ANTI-FEATURE |
| OAuth / social login | MEDIUM | HIGH | ANTI-FEATURE |
| Full auth framework (NextAuth etc.) | MEDIUM | MEDIUM | ANTI-FEATURE |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration
- ANTI-FEATURE: Deliberately excluded

---

## Competitor Feature Analysis

For a shared-password gate the "competitors" are the implementation patterns in use across the ecosystem:

| Feature | HTTP Basic Auth (WWW-Authenticate header) | iron-session + custom login page | Plain middleware + JWT cookie |
|---------|-------------------------------------------|----------------------------------|-------------------------------|
| Login UX | Browser native dialog (ugly, non-brandable) | Custom HTML page (fully brandable) | Custom HTML page (fully brandable) |
| Session persistence | Browser handles automatically | Cookie (stateless) | Cookie (stateless) |
| API route protection | Yes (same header check) | Yes (middleware reads cookie) | Yes (middleware reads cookie) |
| No database | Yes | Yes | Yes |
| Cookie security attributes | No (browser-managed) | Yes (configurable) | Yes (configurable) |
| Customizable expiry | No | Yes (maxAge) | Yes (JWT exp) |
| Logout support | No (browser clears on tab close) | Yes (delete cookie) | Yes (delete cookie) |
| Complexity | Very Low | Low | Low |
| Recommended for this project | No — unbranded, no logout | Yes — most common pattern in community | Yes — slightly more DIY, same outcome |

**Our approach:** Custom login page + Server Action for credential check + httpOnly encrypted cookie (via `jose` or `iron-session`) + middleware reads cookie. Avoids full auth frameworks to minimize files changed and preserve fork merge compatibility.

---

## Sources

- [Next.js official authentication guide (Context7 / vercel/next.js)](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/authentication.mdx) — HIGH confidence
- [Revisiting password protecting routes in Next.js — Alex Chan](https://www.alexchantastic.com/revisiting-password-protecting-next) — iron-session pattern — HIGH confidence
- [Password protecting routes in Next.js App Router — Alex Chan](https://www.alexchantastic.com/password-protecting-next) — MEDIUM confidence
- [next-password-protect library (instantcommerce)](https://github.com/instantcommerce/next-password-protect) — feature inventory reference — MEDIUM confidence
- [Basic Auth Password Protection — Vercel Templates](https://vercel.com/templates/next.js/basic-auth-password) — official Vercel pattern — HIGH confidence
- [Simple Page Password Protection discussion — vercel/next.js #64843](https://github.com/vercel/next.js/discussions/64843) — community expectations — MEDIUM confidence
- [Next.js Middleware Authentication 2025 — HashBuilds](https://www.hashbuilds.com/articles/next-js-middleware-authentication-protecting-routes-in-2025) — MEDIUM confidence (WebSearch, single source)

---

*Feature research for: Shared password gate — Next.js fork (GEO/AEO Tracker)*
*Researched: 2026-02-28*
