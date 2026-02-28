# Requirements: GEO/AEO Tracker — Password Protection

**Defined:** 2026-02-28
**Core Value:** The whole app is gated behind a shared password — no unauthenticated access to any page or API route.

## v1 Requirements

### Authentication Gate

- [ ] **AUTH-01**: All page requests are intercepted by proxy and redirected to /login if no valid session cookie exists
- [x] **AUTH-02**: User can enter shared password on /login page and receive a signed session cookie on success
- [x] **AUTH-03**: Session cookie is encrypted, httpOnly, secure, and SameSite=lax
- [x] **AUTH-04**: Password is read from `SITE_PASSWORD` environment variable (no hardcoded values)
- [ ] **AUTH-05**: API routes (/api/scrape, /api/audit, /api/analyze) independently verify session cookie (defense-in-depth)
- [ ] **AUTH-06**: Static assets (_next/static, _next/image, favicon) are excluded from auth check
- [ ] **AUTH-07**: Login page uses existing Tailwind dark theme to match app aesthetic

### Fork Compatibility

- [x] **FORK-01**: All auth code lives in new files only — zero modifications to existing upstream files
- [x] **FORK-02**: Auth utilities are isolated in a dedicated module (e.g., lib/auth.ts) to minimize merge conflict surface

## v2 Requirements

### Session Management

- **SESS-01**: User can log out via a logout button/endpoint that clears the session cookie
- **SESS-02**: Login form shows loading and error states

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / individual logins | Overkill — single shared password suffices |
| OAuth / social login | Unnecessary complexity for internal tool |
| NextAuth / Auth.js / Clerk | Over-engineered for shared password; adds merge conflict surface |
| Rate limiting on login | Low risk for private dashboard with shared password |
| Password hashing in env var | Shared password in env var is acceptable for this threat model |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Complete (01-01) |
| AUTH-03 | Phase 1 | Complete (01-01) |
| AUTH-04 | Phase 1 | Complete (01-01) |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 2 | Pending |
| FORK-01 | Phase 1 | Complete (01-01) |
| FORK-02 | Phase 1 | Complete (01-01) |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after 01-01 completion (AUTH-02, AUTH-03, AUTH-04, FORK-01, FORK-02 complete)*
