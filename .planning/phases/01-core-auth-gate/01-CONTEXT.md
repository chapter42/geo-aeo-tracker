# Phase 1: Core Auth Gate - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Fully working shared-password gate protecting all pages and API routes. Users without a valid session cookie are redirected to /login. Correct password grants persistent access. All auth code lives in new files only — zero modifications to existing upstream files.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User delegated all implementation decisions to Claude. Use standard patterns:

- **Login page behavior**: Plain form, show inline error on wrong password ("Incorrect password"), redirect to originally requested URL after successful login (callback URL pattern). No rate limiting needed.
- **Session duration**: 7-day cookie, persists across browser restarts (not a session cookie). HttpOnly, Secure (production), SameSite=Lax.
- **API route protection**: Return 401 JSON `{ error: "Unauthorized" }` for unauthenticated API requests (not redirect — APIs serve JSON consumers). Add `verifySession()` check to each route for defense-in-depth.
- **Password comparison**: Use `crypto.timingSafeEqual()` for constant-time comparison.
- **Token approach**: Signed JWT via `jose` library — stateless, no DB needed, edge-compatible.
- **File naming**: `proxy.ts` (Next.js 16 convention, forward-compatible). Auth utilities in `lib/auth.ts`.
- **Environment variable**: `SITE_PASSWORD` for the shared password, `AUTH_SECRET` for JWT signing key.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants minimal changes for fork compatibility.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Zod validation already used in all API routes — can validate login form input consistently
- Tailwind CSS available for login page styling (Phase 2 handles polish)
- `app/layout.tsx` has dark theme initialization script — login page inherits this

### Established Patterns
- API routes use `POST` with Zod validation and JSON error responses — auth check should follow same pattern
- Environment variables read from `.env` / Vercel dashboard — consistent with `SITE_PASSWORD` approach
- No existing middleware/proxy.ts — clean slate, no merge conflict risk

### Integration Points
- `proxy.ts` at project root — new file, intercepts all requests before they reach pages/API routes
- `app/login/page.tsx` — new page route
- `app/api/auth/login/route.ts` — new API route for login form submission
- `lib/auth.ts` — new utility module for session verification
- Existing API routes (`app/api/scrape/route.ts`, `app/api/audit/route.ts`, `app/api/analyze/route.ts`) — add `verifySession()` call (NOTE: this modifies upstream files, conflicting with FORK-01. Alternative: proxy.ts matcher covers API routes too, making defense-in-depth optional vs required)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-core-auth-gate*
*Context gathered: 2026-02-28*
