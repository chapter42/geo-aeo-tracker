# Codebase Structure

**Analysis Date:** 2026-02-28

## Directory Layout

```
geo-aeo-tracker/
├── app/                          # Next.js App Router (Server & Client)
│   ├── page.tsx                  # Root page → renders SovereignDashboard
│   ├── layout.tsx                # Root layout (fonts, theme script, metadata)
│   ├── globals.css               # Global Tailwind styles
│   ├── api/                      # Backend API routes
│   │   ├── scrape/route.ts       # POST /api/scrape — AI response scraping
│   │   ├── audit/route.ts        # POST /api/audit — Website AEO audit
│   │   └── analyze/route.ts      # POST /api/analyze — LLM-powered analysis
│   └── demo/page.tsx             # Demo-only route with fixture data
├── components/                   # React UI components
│   ├── sovereign-dashboard.tsx   # Root dashboard state & tab orchestration (76KB)
│   └── dashboard/
│       ├── types.ts              # Domain types (Provider, ScrapeRun, AuditReport, AppState, etc.)
│       └── tabs/
│           ├── project-settings-tab.tsx      # Brand config, site, keywords
│           ├── prompt-hub-tab.tsx            # Prompt library management & batch runs
│           ├── automation-tab-v2.tsx         # Scheduler config (cron/GitHub Actions)
│           ├── fan-out-tab.tsx               # Persona variant generation
│           ├── niche-explorer-tab.tsx        # High-intent query generation
│           ├── battlecards-tab.tsx           # Competitor intelligence
│           ├── aeo-audit-tab.tsx             # Website audit runner & results
│           ├── visibility-analytics-tab.tsx  # Charts, trends, CSV export
│           ├── citation-opportunities-tab.tsx # Citation analysis
│           ├── reputation-sources-tab.tsx    # Source tracking
│           ├── partner-discovery-tab.tsx     # Partner identification
│           ├── documentation-tab.tsx         # Help & documentation
│           └── prompt-hub-tab.tsx            # (also noted above)
├── lib/                          # Utilities & shared logic
│   ├── client/
│   │   └── sovereign-store.ts    # IndexedDB + localStorage dual-layer persistence
│   ├── server/
│   │   └── brightdata-scraper.ts # Bright Data API integration (462 lines)
│   └── demo-data.ts              # Deterministic fixture data for demo mode
├── public/                       # Static assets
├── scripts/                      # CLI utilities
│   ├── test-scraper.js           # Manual scraper testing script
│   └── test-pillar.js            # Manual pillar testing script
├── .planning/                    # GSD planning documents
│   └── codebase/                 # This directory
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript compiler options (paths: @/*)
├── package.json                  # Dependencies & scripts
├── vercel.json                   # Vercel deployment config
└── README.md                      # Project documentation
```

## Directory Purposes

**`app/`:**
- Purpose: Next.js App Router conventions — pages, layouts, API routes
- Contains: Entry point (`page.tsx`), layout wrapper, global styles, backend endpoints
- Key files: `page.tsx` (renders dashboard), `layout.tsx` (fonts, theme), `api/*` (endpoints)

**`components/`:**
- Purpose: React component library organized by feature domain
- Contains: Dashboard root, tab components, type definitions
- Key files: `sovereign-dashboard.tsx` (state + orchestration, 76KB), `dashboard/types.ts` (canonical types)

**`components/dashboard/`:**
- Purpose: Dashboard feature namespace
- Contains: Shared types and tab implementations
- Key files: `types.ts` (AppState, Provider, ScrapeRun, AuditReport, etc.)

**`components/dashboard/tabs/`:**
- Purpose: 12 specialized tab implementations
- Contains: React components for each tracking workflow
- Pattern: Each tab is a function component receiving state object + callback props

**`lib/`:**
- Purpose: Shared utilities not tied to UI
- Contains: Client persistence, server scrapers, demo data
- Structure: `client/` (IndexedDB), `server/` (Bright Data), root level (demo fixtures)

**`lib/client/`:**
- Purpose: Client-side utilities (browser-only)
- Contains: IndexedDB + localStorage dual-layer storage abstraction
- Key files: `sovereign-store.ts` (load/save/clear operations)

**`lib/server/`:**
- Purpose: Server-side utilities (Node.js only)
- Contains: External API integrations (Bright Data scraper)
- Key files: `brightdata-scraper.ts` (orchestration, normalization, source extraction)

**`public/`:**
- Purpose: Static assets served directly by Next.js
- Contains: Favicon, robots.txt, etc.

**`scripts/`:**
- Purpose: Development and testing utilities
- Contains: Manual test scripts for scraper and data validation
- Key files: `test-scraper.js`, `test-pillar.js`

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Main application entry — renders SovereignDashboard with demoMode flag
- `app/layout.tsx`: Root layout — fonts (Inter, JetBrains Mono), theme initialization, metadata
- `app/demo/page.tsx`: Alternative demo entry point

**Configuration:**
- `tsconfig.json`: TypeScript settings with path alias `@/*`
- `next.config.ts`: Next.js build config
- `package.json`: Dependencies (React 19, Next.js 16, Recharts, Zod, TailwindCSS, idb-keyval)
- `vercel.json`: Vercel deployment config

**Core Logic:**
- `components/sovereign-dashboard.tsx`: State management, tab orchestration, workspace handling (76KB file)
- `lib/server/brightdata-scraper.ts`: Bright Data integration, response normalization, source extraction
- `lib/client/sovereign-store.ts`: IndexedDB + localStorage persistence layer

**API Routes:**
- `app/api/scrape/route.ts`: POST endpoint for AI response scraping via Bright Data
- `app/api/audit/route.ts`: POST endpoint for website audit (20 checks across 5 categories)
- `app/api/analyze/route.ts`: POST endpoint for LLM analysis via OpenRouter

**Testing:**
- No test files (no .test.ts, .spec.ts, jest.config.ts, vitest.config.ts)
- Manual testing via `scripts/test-scraper.js` (Node.js script)

**Data Types:**
- `components/dashboard/types.ts`: Canonical domain types (Provider, ScrapeRun, AuditReport, AppState, Battlecard, AuditCheck, DriftAlert, Workspace)

## Naming Conventions

**Files:**
- Page routes: `page.tsx` (Next.js convention)
- API routes: `route.ts` (Next.js convention)
- Layout files: `layout.tsx` (Next.js convention)
- Components: PascalCase + `-tab.tsx` suffix for tabs (e.g., `aeo-audit-tab.tsx`)
- Utilities: camelCase with feature descriptor (e.g., `sovereign-store.ts`, `brightdata-scraper.ts`)
- Types: `types.ts` for domain types, exported as named exports

**Directories:**
- Feature domains: PascalCase or lowercase (e.g., `dashboard/`, `components/`)
- Namespace grouping: `dashboard/tabs/` for tab variants
- Layers: `client/`, `server/` to separate execution context

**Functions & Variables:**
- React components: PascalCase (e.g., `SovereignDashboard`, `AeoAuditTab`)
- Exported utilities: camelCase (e.g., `loadSovereignValue`, `runAiScraper`, `saveSovereignValue`)
- State/config: camelCase or UPPER_SNAKE_CASE (e.g., `defaultState`, `STORAGE_KEY`, `OUTPUT_CACHE_TTL_MS`)
- Enums/constants: PascalCase or UPPER_SNAKE_CASE (e.g., `ALL_PROVIDERS`, `PROVIDER_LABELS`)

**Types & Interfaces:**
- Domain types: PascalCase (e.g., `AppState`, `ScrapeRun`, `AuditReport`, `Provider`)
- Type aliases: PascalCase (e.g., `TabKey = (typeof tabs)[number]`)
- Generic shape types: PascalCase with descriptive suffix (e.g., `BattlecardSection`, `AuditCheck`)

## Where to Add New Code

**New Tracking Feature (e.g., New Tab):**
1. Add type definition to `components/dashboard/types.ts` for data shape
2. Create component at `components/dashboard/tabs/[feature-name]-tab.tsx`
3. Add tab entry to `tabs` array in `types.ts` and export `type TabKey`
4. Add icon and metadata to `ICONS` and `tabMeta` in `sovereign-dashboard.tsx`
5. Import and render tab in SovereignDashboard's tab switch/render logic
6. Persist related state in `AppState` type

**New API Endpoint (e.g., External Service Integration):**
1. Create `app/api/[feature]/route.ts`
2. Define Zod input schema at top of file
3. Implement POST handler with error handling (try-catch, NextResponse.json errors)
4. Call server utility from `lib/server/` if complex logic needed
5. Use environment variables from `.env` for API keys

**New Server Utility (e.g., Third-party API Client):**
1. Create `lib/server/[feature]-integration.ts`
2. Export named async functions (e.g., `runScraper()`, `normalizeResponse()`)
3. Use Zod for runtime type validation if accepting external data
4. Catch and throw errors with descriptive messages
5. Return typed objects matching domain types from `components/dashboard/types.ts`

**New Component Shared UI (e.g., Button, Card, Modal):**
1. Create at `components/[component-name].tsx` (not in dashboard/ subdirectory)
2. Use Tailwind classes with `var(--th-*)` CSS custom properties for theming
3. Export as default or named export
4. Import into tabs or dashboard as needed

**New Client Utility (e.g., Storage or State Helper):**
1. Create at `lib/client/[feature-name].ts`
2. Mark with `"use client"` directive if needed
3. Use idb-keyval for IndexedDB access, window.localStorage for fast path
4. Handle quota exceeded errors gracefully
5. Export named functions

## Special Directories

**`app/api/`:**
- Purpose: Next.js API route handlers
- Generated: No
- Committed: Yes
- Pattern: One route per file/folder, exports async POST/GET/etc

**`.next/`:**
- Purpose: Next.js build output (generated)
- Generated: Yes
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No (in .gitignore)

**`public/`:**
- Purpose: Static assets (favicon, robots.txt, etc.)
- Generated: No
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents
- Generated: By `/gsd:map-codebase`
- Committed: Yes
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, STACK.md, INTEGRATIONS.md

## Import Path Aliases

- `@/*` maps to project root
- Usage: `import { SovereignDashboard } from "@/components/sovereign-dashboard"`
- Defined in: `tsconfig.json` under `compilerOptions.paths`

---

*Structure analysis: 2026-02-28*
