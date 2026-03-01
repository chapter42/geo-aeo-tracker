# GEO/AEO Tracker — Password Protection

## What This Is

A forked AEO (AI Engine Optimization) visibility tracker dashboard built with Next.js, now fully gated behind shared-password authentication. It monitors how AI models (ChatGPT, Perplexity, Gemini, etc.) mention and cite brands, using Bright Data for scraping and OpenRouter for analysis. All pages and API routes require authentication, with defense-in-depth session verification and full theme integration.

## Core Value

The whole app is gated behind a shared password — no unauthenticated access to any page or API route.

## Requirements

### Validated

- ✓ AI provider scraping (ChatGPT, Perplexity, Copilot, Gemini, Google AI, Grok) — existing
- ✓ AEO website audit with 20 checks across 5 categories — existing
- ✓ LLM-powered analysis via OpenRouter — existing
- ✓ 12-tab dashboard with workspace management — existing
- ✓ Client-side persistence via IndexedDB — existing
- ✓ Demo mode at /demo — existing
- ✓ Vercel deployment — existing
- ✓ Shared password authentication gating all pages and API routes — v1.0
- ✓ Minimal code changes preserving upstream merge compatibility — v1.0
- ✓ Defense-in-depth API route verification (verifySession per route) — v1.0
- ✓ Login page styled with app theme system — v1.0
- ✓ Bulk prompt import with deduplication — v1.0

### Active

(None — next milestone requirements TBD)

### Out of Scope

- User accounts / individual logins — overkill for this use case
- OAuth / social login — unnecessary complexity
- Role-based access control — single shared password suffices
- Major refactoring or feature additions — preserve fork sync ability
- Rate limiting on login — low risk for private dashboard

## Context

- **v1.0 shipped:** 2026-03-01 — 4 phases, 5 plans, 262 LOC in auth files
- This is a fork — upstream merges happen regularly
- All auth code lives in new files only (lib/auth.ts, proxy.ts, app/api/auth/login/route.ts, app/login/page.tsx)
- Zero modifications to existing upstream files for auth logic
- App deploys to Vercel with SITE_PASSWORD and AUTH_SECRET env vars
- Tech stack: Next.js 16.1.6, jose (JWT), Tailwind v4 with CSS custom properties

## Constraints

- **Fork compatibility**: All auth in new files only — zero upstream modifications
- **Deployment**: Vercel — password via SITE_PASSWORD env var
- **Simplicity**: Single shared password, no database or user management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Shared password over user accounts | Simplest solution, no DB needed, minimal code changes | ✓ Good |
| Gate entire app including /demo | User wants everything behind password | ✓ Good |
| Environment variable for password | Fits Vercel deployment model, no config files | ✓ Good |
| proxy.ts over middleware.ts | Next.js 16.1.6 convention, middleware deprecated | ✓ Good |
| jose over jsonwebtoken | Edge-runtime compatible, no Node.js crypto dependency | ✓ Good |
| No server-only in lib/auth.ts | proxy.ts imports decrypt(), server-only would crash it | ✓ Good |
| 401 JSON for API routes (not redirect) | Machine clients expect JSON errors | ✓ Good |
| bd-* component classes for login styling | Matches existing theme system, adapts to light/dark | ✓ Good |
| verifySession per route (defense-in-depth) | Independent of proxy layer, true multi-layer security | ✓ Good |

---
*Last updated: 2026-03-01 after v1.0 milestone*
