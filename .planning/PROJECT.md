# GEO/AEO Tracker — Password Protection

## What This Is

A forked AEO (AI Engine Optimization) visibility tracker dashboard built with Next.js. It monitors how AI models (ChatGPT, Perplexity, Gemini, etc.) mention and cite brands, using Bright Data for scraping and OpenRouter for analysis. The goal of this project is to add password protection to the existing app while keeping the codebase as close to upstream as possible for easy merge syncing.

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

### Active

- [ ] Shared password authentication gating the entire app (all pages and API routes)
- [ ] Minimal code changes to preserve upstream merge compatibility

### Out of Scope

- User accounts / individual logins — overkill for this use case
- OAuth / social login — unnecessary complexity
- Role-based access control — single shared password suffices
- Major refactoring or feature additions — preserve fork sync ability

## Context

- This is a fork of another developer's project
- Upstream merges (git merge) will happen regularly to stay current
- The fewer files changed, the fewer merge conflicts
- App deploys to Vercel — environment variables are the preferred config mechanism
- Currently zero authentication — all pages and API routes are publicly accessible

## Constraints

- **Fork compatibility**: Changes must be minimal and isolated to reduce merge conflicts with upstream
- **Deployment**: Vercel — password should be configurable via environment variable
- **Simplicity**: Single shared password, no database or user management needed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Shared password over user accounts | Simplest solution, no DB needed, minimal code changes | — Pending |
| Gate entire app including /demo | User wants everything behind password | — Pending |
| Environment variable for password | Fits Vercel deployment model, no config files | — Pending |

---
*Last updated: 2026-02-28 after initialization*
