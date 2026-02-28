# Technology Stack

**Analysis Date:** 2026-02-28

## Languages

**Primary:**
- TypeScript 5.x - Used for all source code (`**/*.ts`, `**/*.tsx`)
- JavaScript - Node.js runtime scripts in `/scripts`

**Secondary:**
- CSS - Styling via Tailwind (see below)

## Runtime

**Environment:**
- Node.js (version not explicitly pinned, inferred from package.json compatibility)
- Browser runtime (React 19 for client-side code)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present and committed)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router
  - Development server: `npm run dev`
  - Build: `npm run build`
  - Production: `npm start`
  - Features used: App Router (not Pages Router), Edge runtime support, Server Components, API routes

**Frontend UI:**
- React 19.2.3 - Component library (React Server Components and Client Components)
- React DOM 19.2.3 - DOM rendering

**Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - Tailwind PostCSS plugin
- PostCSS - CSS processing (config: `postcss.config.mjs`)

**Data Visualization:**
- Recharts 3.7.0 - React chart library for dashboard visualizations

**Validation & Schema:**
- Zod 4.3.6 - TypeScript-first schema validation
  - Used in: `app/api/audit/route.ts`, `app/api/analyze/route.ts`, `app/api/scrape/route.ts`
  - Validates request payloads and environment configuration

**Client-Side Storage:**
- idb-keyval 6.2.2 - Simple wrapper around IndexedDB for key-value storage
  - Location: `lib/client/sovereign-store.ts`
  - Purpose: Persistent local-first storage (replaces older localStorage fallback)

## Build & Development

**Linting & Code Quality:**
- ESLint 9 - JavaScript/TypeScript linter
  - Config: `eslint.config.mjs` (flat config format)
  - Extends: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
  - Run: `npm run lint`

**Type Checking:**
- TypeScript compiler (via `npm run build`)
  - Config: `tsconfig.json` (strict mode enabled)
  - Module resolution: bundler (Next.js style)
  - Path alias: `@/*` maps to project root

**Build Optimization:**
- Next.js Turbopack - Experimental fast build system
  - Enabled via `experimental.turbopackFileSystemCacheForDev` in `next.config.ts`

## Key Dependencies

**Critical:**
- zod 4.3.6 - Runtime schema validation for API endpoints and environment variables
- recharts 3.7.0 - Visualization library for dashboard charts and metrics
- idb-keyval 6.2.2 - IndexedDB wrapper for persistent client-side state

**Infrastructure:**
- @types/node 20 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React DOM type definitions
- eslint-config-next 16.1.6 - Next.js ESLint configuration (includes Web Vitals)

## Configuration

**Environment:**
- Environment variables are read from:
  - `.env` (server-side only)
  - `process.env` at runtime
- Key environment variables (inferred from code analysis):
  - `BRIGHT_DATA_KEY` - API authentication for Bright Data (required)
  - `BRIGHT_DATA_DATASET_*` - Dataset IDs for each AI provider (required for scraping)
    - `BRIGHT_DATA_DATASET_CHATGPT`
    - `BRIGHT_DATA_DATASET_PERPLEXITY`
    - `BRIGHT_DATA_DATASET_COPILOT`
    - `BRIGHT_DATA_DATASET_GEMINI`
    - `BRIGHT_DATA_DATASET_GOOGLE_AI`
    - `BRIGHT_DATA_DATASET_GROK`
  - `OPENROUTER_KEY` - API key for OpenRouter LLM service (required by `/api/analyze`)
  - `NEXT_PUBLIC_DEMO_ONLY` - Boolean flag to enable demo-only mode (client-visible)

**Build Configuration:**
- `next.config.ts` - Next.js configuration (TypeScript format)
  - Turbopack filesystem cache enabled for dev
- `tsconfig.json` - TypeScript compiler options
  - Strict mode: enabled
  - JSX: react-jsx
  - Target: ES2017
- `eslint.config.mjs` - ESLint configuration (flat config)
- `postcss.config.mjs` - PostCSS configuration (for Tailwind)

## Platform Requirements

**Development:**
- Node.js (LTS or current recommended)
- npm (comes with Node.js)
- Modern browser with IndexedDB support (for client-side storage)

**Production:**
- Deployment target: Vercel (recommended, as per README)
- Alternative: Any Node.js hosting that supports Next.js (edge runtime optional)
- Browser requirements: Modern browsers with ES2017+ support and IndexedDB

---

*Stack analysis: 2026-02-28*
