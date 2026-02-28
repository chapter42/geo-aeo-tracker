# Architecture

**Analysis Date:** 2026-02-28

## Pattern Overview

**Overall:** Client-first Progressive Web Application with server-side backend for external integrations

**Key Characteristics:**
- Next.js 16 App Router for server and client rendering
- IndexedDB + localStorage dual-layer client-side persistence (IndexedDB as primary, localStorage as cache)
- Workspace-based multi-brand state management
- Modular tab system for feature organization
- Dual API layers: internal scraping/auditing endpoints + external Bright Data integration
- Edge-compatible API routes where feasible

## Layers

**UI Layer (Presentation):**
- Purpose: Render interactive dashboard with 12 specialized tabs for different tracking workflows
- Location: `components/dashboard/` and `components/dashboard/tabs/`
- Contains: React TSX components using inline SVG icons, Recharts for visualizations, Tailwind CSS styling
- Depends on: AppState types, client storage layer, API routes
- Used by: App entry point (`app/page.tsx`)

**State Management Layer:**
- Purpose: Centralized state management via React hooks and dual-layer persistence
- Location: `components/sovereign-dashboard.tsx` (root state container), `lib/client/sovereign-store.ts` (persistence)
- Contains: AppState definition with workspace support, save/load/clear operations
- Depends on: idb-keyval library for IndexedDB, native localStorage
- Used by: Dashboard component and all tab components

**Data Type Layer:**
- Purpose: Define canonical TypeScript types for domain entities
- Location: `components/dashboard/types.ts`
- Contains: Provider enum (ChatGPT, Perplexity, Copilot, Gemini, Google AI, Grok), ScrapeRun, AuditReport, Battlecard, AppState, etc.
- Depends on: None
- Used by: All components, API routes, server utilities

**API Layer (Backend Routes):**
- Purpose: Handle POST requests for scraping, auditing, and analysis
- Location: `app/api/scrape/route.ts`, `app/api/audit/route.ts`, `app/api/analyze/route.ts`
- Contains: Zod input validation, external API calls, response normalization
- Depends on: Bright Data SDK, OpenRouter API, fetch API
- Used by: Client components via fetch calls

**Server Utilities Layer:**
- Purpose: Core logic for external integrations and data processing
- Location: `lib/server/brightdata-scraper.ts`
- Contains: AI scraper orchestration, source extraction, response normalization, in-memory caching
- Depends on: Bright Data API, URL parsing, string manipulation
- Used by: `/api/scrape` route

**Demo/Fixture Layer:**
- Purpose: Provide deterministic demo data for testing and development
- Location: `lib/demo-data.ts`
- Contains: Fixed dates, seeded scores, sample runs, fixtures (uses seeded hash instead of Math.random for SSR determinism)
- Depends on: AppState types
- Used by: SovereignDashboard component when demoMode=true

**Entry Points:**
- `app/page.tsx`: Root page that renders SovereignDashboard
- `app/layout.tsx`: Root layout with theme initialization script, font setup, metadata
- `app/demo/page.tsx`: Dedicated demo mode route

## Data Flow

**Scrape Workflow (User-Initiated):**

1. User enters prompt in dashboard, selects provider(s), clicks run
2. Client calls `POST /api/scrape` with { provider, prompt, country? }
3. API validates with Zod, calls `runAiScraper()` from `lib/server/brightdata-scraper.ts`
4. Scraper checks in-memory cache (20 min TTL)
5. If miss: submits request to Bright Data API, polls for completion, downloads snapshot
6. Normalizes response: extracts answer text, parses sources (plain URLs + markdown links)
7. Filters noise: removes tracking pixels, CDN hosts, AI platform self-references
8. Returns `NormalizedScrapeResult` to client
9. Client stores in IndexedDB via `saveSovereignValue()`, adds to runs array, updates UI

**Audit Workflow (Website Analysis):**

1. User enters URL in AEO Audit tab, clicks run
2. Client calls `POST /api/audit` with { url }
3. API fetches page HTML + parallel fetches (llms.txt, robots.txt, sitemap.xml, llms-full.txt)
4. Runs 20 checks across 5 categories: discovery, structure, content, technical, rendering
5. Computes pass/fail for each check, calculates overall score (% passed)
6. Returns `AuditReport` with array of checks
7. Client stores report, renders visual breakdown by category

**Analysis Workflow (LLM-Powered Insights):**

1. User enters prompt in various tabs, clicks analyze
2. Client calls `POST /api/analyze` with { prompt, maxTokens?, temperature?, skipCache? }
3. Edge route checks edge cache, skips if skipCache=true
4. Calls OpenRouter API with moonshotai/kimi-k2.5 model
5. Returns generated text, marks as cached or fresh
6. Client displays in relevant tab (e.g., Niche Explorer uses this for query generation)

**Workspace Persistence:**

1. App initializes with default workspace or restores last-used workspace from localStorage
2. All state changes are debounced and persisted to IndexedDB (key: `sovereign-aeo-tracker-${wsId}`)
3. Workspace list stored separately at `sovereign-workspaces`
4. On workspace switch: load state from IndexedDB, update active workspace marker
5. Theme preference persisted separately at `sovereign-theme`

**State Management:**

- Single `AppState` object drives all 12 tabs
- Tabs are "controlled components" — they receive state and callbacks, emit changes upward
- Changes are committed to IndexedDB and localStorage immediately (fire-and-forget persist)
- No Redux, Zustand, or Context — state lives in component tree with dual-layer storage

## Key Abstractions

**Provider Enumeration:**
- Purpose: Represent the 6 AI systems being tracked
- Examples: `chatgpt`, `perplexity`, `copilot`, `gemini`, `google_ai`, `grok`
- Pattern: String literal union (`type Provider = "chatgpt" | ...`)
- Used to: Route requests to Bright Data datasets, organize runs by model, label UI controls

**ScrapeRun:**
- Purpose: Immutable record of a single AI model response to a prompt
- Fields: provider, prompt, answer, sources[], visibility score, sentiment, brand mentions, competitor mentions, timestamp
- Pattern: Struct returned from `/api/scrape`, appended to `state.runs` array
- Used to: Build visibility analytics, detect sentiment shifts, track citation patterns

**AuditCheck:**
- Purpose: Result of one audit test on a website
- Fields: id, label, category, pass (boolean), value (human-readable), detail (explanation)
- Pattern: Array of 20 checks per audit, grouped by category for UI display
- Used to: Grade AEO readiness, identify specific gaps in discovery/structure/content/technical/rendering

**AppState:**
- Purpose: Top-level state object managing all dashboard data
- Fields: brand config, provider selection, custom prompts, custom personas, competitors, runs[], audit reports, scheduler config, drift alerts
- Pattern: Persisted whole to IndexedDB, never partial updates
- Used to: Serialize/deserialize entire app state, enable workspace switching

**Battlecard:**
- Purpose: Structured competitive analysis record
- Fields: competitor name, sentiment, summary, sections (array of { heading, points[] })
- Pattern: User-created or AI-generated, stored in state.battlecards[]
- Used to: Organize competitor intelligence, compare messaging across competitors

**DriftAlert:**
- Purpose: Detect significant visibility shifts between scheduled runs
- Fields: prompt, provider, oldScore, newScore, delta, timestamp, dismissed
- Pattern: Generated by automation scheduler when visibility changes >threshold
- Used to: Surface anomalies, trigger investigation into why visibility moved

## Entry Points

**Web Server:**
- Location: `app/page.tsx` → `SovereignDashboard`
- Triggers: HTTP GET /
- Responsibilities: Render main dashboard UI, initialize state from IndexedDB, handle all user interactions

**API: Scrape Endpoint:**
- Location: `app/api/scrape/route.ts`
- Triggers: POST /api/scrape { provider, prompt, country? }
- Responsibilities: Validate input, call Bright Data, normalize response, return sources and answer

**API: Audit Endpoint:**
- Location: `app/api/audit/route.ts`
- Triggers: POST /api/audit { url }
- Responsibilities: Fetch page, run 20 checks, compute score, return categorized audit results

**API: Analyze Endpoint:**
- Location: `app/api/analyze/route.ts`
- Triggers: POST /api/analyze { prompt, maxTokens?, temperature?, skipCache? }
- Responsibilities: Query OpenRouter/Kimi, return generated text (edge runtime)

**Demo Route:**
- Location: `app/demo/page.tsx`
- Triggers: HTTP GET /demo
- Responsibilities: Render dashboard with DEMO_STATE fixtures

## Error Handling

**Strategy:** Synchronous validation (Zod) on input, try-catch on async operations, return JSON errors to client

**Patterns:**

- **API Input Validation:** Zod schemas parse request body; if invalid, return 400 with error message
  - Example: `/api/scrape` validates `ProviderSchema.enum([...])`, `/api/audit` validates `z.string().url()`

- **External API Failures:** tryFetch() helper in audit route wraps fetch in try-catch, returns `{ ok: false, status: 0 }` on network error
  - Allows audit checks to handle timeouts gracefully (mark check as failed, provide detail)

- **Parsing Failures:** normalizeAnswer() in brightdata-scraper recursively searches nested JSON structures; worst case returns stringified payload
  - Prevents completely broken responses from crashing normalization

- **Storage Errors:** Client persistance in `sovereign-store.ts` catches quota exceeded errors, clears stale localStorage entry but preserves IndexedDB copy
  - Ensures data is never lost, just downgraded to slower path

- **Cache Expiry:** In-memory cache checked for `expiresAt > Date.now()`; expired entries ignored, request proceeds to Bright Data
  - Prevents stale scrape results from being served after TTL

## Cross-Cutting Concerns

**Logging:** No structured logging framework; browser console.log() implicit via Next.js dev server. Server-side errors logged via Error objects stringified in response bodies.

**Validation:** Zod schemas at all API boundaries (`/api/scrape`, `/api/audit`, `/api/analyze`). No runtime validation in components — assumes state is well-formed.

**Authentication:** No auth; app is single-user or organization-internal. Assumes Bright Data and OpenRouter API keys in `.env`.

**Error Recovery:** Client persists state to IndexedDB on every change — reload recovers to last saved state. No transaction rollback.

**Caching:**
- **Scrape Results:** In-memory cache in `brightdata-scraper.ts` (20 min TTL), keyed by JSON.stringify({ provider, prompt, country })
- **Audit Results:** Not cached (each audit is fresh, no TTL)
- **Analysis Results:** Edge cache in `/api/analyze` (30 min TTL), keyed by prompt + temperature + maxTokens

**Concurrency:** No explicit concurrency control. Simultaneous state changes in IndexedDB use last-write-wins semantics. Client-side updates are synchronous (no async state machine).

---

*Architecture analysis: 2026-02-28*
