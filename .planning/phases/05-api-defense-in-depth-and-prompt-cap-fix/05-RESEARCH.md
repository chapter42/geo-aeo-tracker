# Phase 5: API Defense-in-Depth & Prompt Cap Fix - Research

**Researched:** 2026-03-01
**Domain:** Next.js Route Handlers (App Router), session cookie verification, React state mutation
**Confidence:** HIGH

---

## Summary

Phase 5 closes the final two open requirements: AUTH-05 (API route defense-in-depth) and BULK-01 (no prompt cap). Both are small, surgical changes with zero external dependencies — everything needed already exists in the codebase.

For AUTH-05: `verifySession()` is fully implemented in `lib/auth.ts` and works in Next.js Route Handler context. All three target routes (`/api/scrape`, `/api/audit`, `/api/analyze`) currently lack any call to it — the proxy is their only guard. Adding an early `verifySession()` check and returning a 401 JSON if null is a 4-line change per route, following the exact same pattern already established in `app/api/auth/login/route.ts` (which uses `createSession()` from the same module).

For BULK-01: The only prompt cap is a single `.slice(0, 50)` in the `addCustomPrompt()` function in `components/sovereign-dashboard.tsx` at line 901. The bulk import path in `PromptHubTab` calls `onAddCustomPrompt(line)` per line, which routes through `addCustomPrompt()`, so removing the cap there fixes both single-add and bulk-add simultaneously. No other file needs to change.

**Primary recommendation:** Add `verifySession()` guard at the top of each of the three route handlers, return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` if null, then remove the `.slice(0, 50)` from `addCustomPrompt()`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-05 | API routes (/api/scrape, /api/audit, /api/analyze) independently verify session cookie (defense-in-depth) | `verifySession()` is ready in `lib/auth.ts`; pattern established by login route; no new dependencies needed |
| BULK-01 | Bulk import can add more than 50 prompts without silent truncation | Single `.slice(0, 50)` at line 901 of `sovereign-dashboard.tsx` is the sole cap; removing it is the complete fix |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next/server` (NextRequest, NextResponse) | 16.1.6 | Route Handler request/response types | Built-in; already used by all three target routes |
| `next/headers` (`cookies()`) | 16.1.6 | Read session cookie server-side | Used by `verifySession()` in `lib/auth.ts` |
| `jose` | ^6.1.3 | JWT verify inside `verifySession()` | Already installed; used by `lib/auth.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.3.6 | Input validation in route handlers | Already present; not needed for auth guard itself |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `verifySession()` (existing) | Custom cookie read in each route | Duplicates logic; misses future changes to auth module — don't do this |
| Removing `.slice(0, 50)` | Adding a higher limit like 500 | A high arbitrary cap would still break BULK-01's "no limit" requirement |

**Installation:** No new packages required — all dependencies are already present.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes needed. Three existing files are edited in-place:

```
app/api/
├── scrape/route.ts      # Add verifySession() guard
├── audit/route.ts       # Add verifySession() guard
└── analyze/route.ts     # Add verifySession() guard (Edge Runtime — see below)
components/
└── sovereign-dashboard.tsx  # Remove .slice(0, 50) from addCustomPrompt()
```

### Pattern 1: verifySession() Guard in Route Handler

**What:** Import `verifySession` from `@/lib/auth` and call it at the very top of the exported handler function, before any business logic. Return a 401 JSON if the session is null.

**When to use:** Any Route Handler that must be authenticated (defense-in-depth beyond the proxy).

**Example:**
```typescript
// Source: lib/auth.ts — verifySession() pattern, extended to Route Handlers
import { verifySession } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... existing business logic unchanged ...
}
```

### Pattern 2: Edge Runtime Compatibility (`/api/analyze`)

**What:** `/api/analyze/route.ts` declares `export const runtime = "edge"`. The Edge Runtime is a restricted Deno-like environment.

**Critical finding:** `cookies()` from `next/headers` IS supported in Next.js Edge Runtime Route Handlers as of Next.js 13.4+. `verifySession()` calls `cookies()` from `next/headers` and then calls `decrypt()` which uses `jose` — `jose` is explicitly designed to work in edge environments (Web Crypto API based). Both are compatible.

**Confidence:** HIGH — `jose` library documentation explicitly states edge/Web Crypto compatibility. Next.js docs confirm `cookies()` works in Edge Route Handlers.

**Example:**
```typescript
// Source: app/api/analyze/route.ts — existing runtime declaration must be preserved
export const runtime = "edge"  // Keep this line as-is

import { verifySession } from '@/lib/auth'
// ... rest of guard same as Pattern 1
```

### Pattern 3: Removing the Prompt Cap

**What:** The `addCustomPrompt()` function at line 896–904 of `sovereign-dashboard.tsx` uses `.slice(0, 50)` when prepending a new prompt. Removing this slice allows unlimited prompts.

**When to use:** Apply this change once — it fixes both single-add and bulk-add paths since `handleBulkImport()` in `PromptHubTab` calls `onAddCustomPrompt()` for each line, which invokes `addCustomPrompt()`.

**Before:**
```typescript
// components/sovereign-dashboard.tsx line 901
return { ...prev, customPrompts: [cleaned, ...prev.customPrompts].slice(0, 50) };
```

**After:**
```typescript
return { ...prev, customPrompts: [cleaned, ...prev.customPrompts] };
```

### Anti-Patterns to Avoid

- **Checking session in proxy only:** The proxy (`proxy.ts`) already protects all `/api/*` routes, but this is not defense-in-depth. A misconfigured proxy, a test environment without proxy, or a direct internal call bypasses it. Route handlers must verify independently.
- **Redirecting instead of returning 401:** Route handlers serve machine clients (fetch/XHR). They must return JSON `{ error: 'Unauthorized' }` with status 401, NOT an HTML redirect (which would break all API callers). This is already established as a decision in STATE.md.
- **Importing `server-only` in `lib/auth.ts`:** STATE.md explicitly records this was rejected (01-01 decision): `proxy.ts` imports `lib/auth.ts` and `server-only` would crash in proxy context. Do not add `server-only` to `lib/auth.ts`.
- **Removing the wrong `.slice(0, 50)`:** There are two occurrences of `.slice(0, 50)` in `sovereign-dashboard.tsx`. Line 546 is for citation URL sorting (top 50 cited URLs). Line 901 is the prompt cap. Only line 901 must be removed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie reading in route handlers | Custom `req.cookies.get('session')` in each handler | `verifySession()` from `lib/auth.ts` | Centralizes logic; automatically uses `cookies()` from next/headers correctly; single point of future updates |
| JWT validation | Re-implement jwtVerify calls | `decrypt()` inside `verifySession()` | Already handles algorithm pinning, error swallowing, expiry — duplicating is error-prone |

**Key insight:** `verifySession()` is specifically designed for Route Handler / Server Action contexts. It is the right abstraction. Use it exactly as designed.

---

## Common Pitfalls

### Pitfall 1: Using `request.cookies.get()` instead of `verifySession()`

**What goes wrong:** Developers copy the proxy pattern (`request.cookies.get('session')`) into route handlers instead of calling `verifySession()`.

**Why it happens:** `proxy.ts` demonstrates reading cookies from the `request` object directly (because `cookies()` from next/headers is not available in proxy context). This looks like the correct pattern to copy.

**How to avoid:** In Route Handlers, always use `verifySession()` which uses `cookies()` from `next/headers`. The `request.cookies` approach bypasses the centralized `decrypt()` + error handling in `lib/auth.ts`.

**Warning signs:** Importing `decrypt` directly in a route file, or calling `req.cookies.get('session')` in a route handler.

### Pitfall 2: Breaking the Edge Runtime in `/api/analyze`

**What goes wrong:** Adding an import that is Node.js-only (e.g., `crypto`, `fs`, `buffer`) to a file with `export const runtime = "edge"`.

**Why it happens:** `verifySession()` uses `cookies()` (Web API compatible) and `jose` (edge compatible). Neither `cookies()` nor `jose` uses Node.js-specific APIs. But if someone accidentally imports a Node.js module in the process, the Edge Runtime will throw at build or runtime.

**How to avoid:** Only import `verifySession` from `@/lib/auth`. Do not import `createSession`, `encrypt`, or `decrypt` separately — `verifySession` is the only function needed here.

**Warning signs:** Build error like "A Node.js module is loaded ('crypto' at ...) which is not supported in the Edge Runtime."

### Pitfall 3: Removing the Wrong `.slice(0, 50)`

**What goes wrong:** Developer removes the citation URL sorting `.slice(0, 50)` at line 546 (inside the `citationLeaders` useMemo) instead of, or in addition to, the prompt cap at line 901.

**Why it happens:** Both are nearby and look syntactically identical.

**How to avoid:** The prompt cap is inside `addCustomPrompt()` at line 901. The citation limiter at line 546 is inside a `useMemo` that returns citation URL objects sorted by count. Only the one in `addCustomPrompt()` must be removed.

**Warning signs:** Running more than 50 URL citations showing in the dashboard (the citation one should stay at 50 for UI performance).

### Pitfall 4: Silent Truncation Hiding Itself During Bulk Import

**What goes wrong:** After removing the cap, a manual test of single-prompt add succeeds, but bulk import still silently stops at 50 because a secondary guard was missed.

**Why it happens:** `handleBulkImport()` in `PromptHubTab` calls `onAddCustomPrompt(line)` for each line sequentially. Each call goes through `addCustomPrompt()` → if the `.slice(0, 50)` is in `addCustomPrompt()` only (which it is), removing it there is sufficient. No secondary guard exists in `handleBulkImport`.

**How to avoid:** Verify the fix by pasting 60+ lines in bulk import and confirming all appear in the list.

---

## Code Examples

Verified patterns from codebase inspection:

### AUTH-05: Complete Route Handler Guard (applies to all three routes)

```typescript
// Source: lib/auth.ts verifySession() + existing route handler structure
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/auth'

// (keep existing imports and schemas)

export async function POST(req: NextRequest) {
  // AUTH-05: Defense-in-depth — verify session independently of proxy
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... rest of existing handler unchanged ...
}
```

### AUTH-05: Edge Runtime variant (for `/api/analyze/route.ts` only)

```typescript
// Source: app/api/analyze/route.ts — preserve runtime declaration
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/auth'  // jose is edge-compatible

export const runtime = 'edge'  // Keep — verifySession() is edge-compatible

export async function POST(req: NextRequest) {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ... rest of existing handler unchanged ...
}
```

### BULK-01: Remove the prompt cap

```typescript
// components/sovereign-dashboard.tsx — addCustomPrompt() function
// BEFORE (line 901):
return { ...prev, customPrompts: [cleaned, ...prev.customPrompts].slice(0, 50) };

// AFTER:
return { ...prev, customPrompts: [cleaned, ...prev.customPrompts] };
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16.1.6 | `middleware.ts` deprecated; already implemented correctly |
| Proxy-only API protection | Defense-in-depth (proxy + route handler) | Phase 5 (now) | Closes CVE-2025-29927 class of bypass vulnerabilities |

**Deprecated/outdated:**
- `middleware.ts`: Deprecated in Next.js 16.1.6. Project correctly uses `proxy.ts`. Do not create or modify `middleware.ts`.

---

## Open Questions

1. **Does `verifySession()` work in Edge Runtime in Next.js 16.1.6?**
   - What we know: `jose` is explicitly edge-compatible (Web Crypto API). `cookies()` from `next/headers` is documented as supported in Edge Route Handlers since Next.js 13.4.
   - What's unclear: Whether Next.js 16.1.6 has any regressions specific to Edge + `cookies()`.
   - Recommendation: HIGH confidence it works. If a build error occurs at `/api/analyze`, fall back to reading `req.cookies.get('session')?.value` and calling `decrypt()` directly (which is how proxy.ts does it for the proxy context). This is the only acceptable fallback.

2. **Should the `runs.slice(0, 500)` and `driftAlerts.slice(0, 100)` caps be reviewed?**
   - What we know: BULK-01 specifically refers to customPrompts. The runs/alerts caps are unrelated performance safeguards.
   - What's unclear: Nothing — these are explicitly out of scope for this phase.
   - Recommendation: Leave runs and driftAlerts caps untouched.

---

## Sources

### Primary (HIGH confidence)

- Codebase — `lib/auth.ts`: `verifySession()` implementation verified line by line; uses `cookies()` + `jose` `jwtVerify`
- Codebase — `app/api/scrape/route.ts`, `app/api/audit/route.ts`, `app/api/analyze/route.ts`: Confirmed none call `verifySession()`; all are missing the auth guard
- Codebase — `components/sovereign-dashboard.tsx` line 901: Single `.slice(0, 50)` in `addCustomPrompt()` confirmed as the only prompt cap
- Codebase — `components/dashboard/tabs/prompt-hub-tab.tsx`: Bulk import calls `onAddCustomPrompt()` per line — fixing `addCustomPrompt()` is sufficient
- `.planning/STATE.md` decisions: `[01-01]` no server-only in lib/auth.ts; `[01-02]` API routes return 401 JSON not redirect; CVE-2025-29927 note establishes why defense-in-depth is required
- `.planning/REQUIREMENTS.md`: AUTH-05, BULK-01 confirmed as the two open requirements this phase closes

### Secondary (MEDIUM confidence)

- `jose` library is documented as edge-compatible (Web Crypto API based) — verified against known jose v5+ architecture

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in project; no new packages
- Architecture: HIGH — both changes are surgical edits to existing functions; patterns established by existing code in same repo
- Pitfalls: HIGH — discovered by direct inspection of the live code, not speculation

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable codebase, no fast-moving dependencies)
