# Coding Conventions

**Analysis Date:** 2026-02-28

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension
  - Example: `sovereign-dashboard.tsx`, `aeo-audit-tab.tsx`
  - Tab components: `{name}-tab.tsx` (e.g., `visibility-analytics-tab.tsx`)
- Utility/library files: kebab-case with `.ts` extension
  - Example: `brightdata-scraper.ts`, `sovereign-store.ts`, `demo-data.ts`
- Type definition files: `types.ts` (co-located with component directory)

**Functions:**
- camelCase for all function names (public and private)
  - Example: `loadSovereignValue`, `saveSovereignValue`, `extractSourcesFromAnswer`, `normalizeAnswer`
- Descriptive verb-noun pattern for clarity
  - Getters: `getApiKey()`, `getDatasetId()`
  - Validators/Filters: `isThirdPartyCitation()`, `stripAnswerHtml()`
  - Extractors: `extractSourcesFromAnswer()`, `extractDeepText()`

**Variables:**
- camelCase for all variables and constants
- const for immutable bindings (most common)
- UPPER_SNAKE_CASE for truly global constants
  - Example: `OUTPUT_CACHE_TTL_MS`, `BATCH_DATES`, `PROMPTS`

**Types:**
- PascalCase for all type/interface names
  - Example: `ScrapeRun`, `Provider`, `AuditReport`, `BrandConfig`
- Exported types use `export type` syntax
- Type inference with `z.infer<typeof Schema>` from Zod validation

## Code Style

**Formatting:**
- No dedicated Prettier config found — follows Next.js/ESLint defaults
- Consistent indentation: 2 spaces (observed in all files)
- Line length: appears to be ~88-100 character limit
- Trailing commas in multi-line constructs

**Linting:**
- Framework: ESLint 9 with `eslint-config-next` and TypeScript support
- Config: `eslint.config.mjs` (new flat config format)
- Enforces Next.js core web vitals rules
- TypeScript strict mode enabled in `tsconfig.json`
- Ignored paths: `.next/`, `out/`, `build/`, `scripts/`

## Import Organization

**Order:**
1. React/Next.js imports
   - `import { useCallback, useState } from "react"`
   - `import { NextRequest, NextResponse } from "next/server"`
2. Third-party library imports
   - `import { z } from "zod"`
   - `import { get, set } from "idb-keyval"`
3. Local/relative imports
   - `import { loadSovereignValue } from "@/lib/client/sovereign-store"`
   - `import { AeoAuditTab } from "@/components/dashboard/tabs/aeo-audit-tab"`
4. Type imports
   - `import type { Metadata } from "next"`
   - `import type { ScrapeRun, AuditCheck } from "@/components/dashboard/types"`

**Path Aliases:**
- `@/*` maps to root directory (configured in `tsconfig.json`)
- Used consistently: `@/components`, `@/lib`, `@/app`
- Preferred over relative paths (`../../../`)

## Error Handling

**Patterns:**
- Try/catch blocks for async operations and JSON parsing
- Type guards: `error instanceof Error` before accessing `.message`
- Fallback error messages: `"Unknown error"` when error type is uncertain
- Swallowing errors with `catch { /* ignore */ }` for optional operations
  - Example: IndexedDB fallback in `sovereign-store.ts`
  - Example: localStorage cleanup on quota exceeded

**Error Messages:**
- Descriptive with context: `"Missing BRIGHT_DATA_KEY"`, `"Unable to fetch page (${status})"`
- Status codes included: `"Scrape failed (${scrapeResponse.status}): ${text}"`
- API error responses: `NextResponse.json({ error: message }, { status: 400 })`

## Logging

**Framework:** console (no structured logging library detected)

**Patterns:**
- Minimal logging in production code
- No debug statements in component files
- API routes use response error objects for error communication
- Comments use inline `//` for step-by-step explanation rather than console logs

## Comments

**When to Comment:**
- Complex algorithm explanations (URL validation, source extraction)
- Non-obvious data transformations
- Section markers using ASCII art for visual organization
  - Example: `/* ── Inline SVG icon helpers (16×16) ────────── */`
- Explain the "why" for workarounds or design decisions

**JSDoc Usage:**
- Minimal JSDoc adoption in codebase
- Used selectively for exported functions with complex behavior
  - Example in `sovereign-store.ts`:
    ```typescript
    /**
     * Load state — IndexedDB is the source of truth, localStorage is a fast-path
     * cache that may be incomplete (quota limited).
     */
    export async function loadSovereignValue<T>(key: string, fallback: T): Promise<T>
    ```
  - Example in `demo-data.ts`:
    ```typescript
    /** Simple seeded hash replacing Math.random() — deterministic across SSR & client */
    function seedScore(base: number, ...): number
    ```
- Block comments preferred over inline for multi-line descriptions

## Function Design

**Size:**
- Generally 5-50 lines for utility functions
- Larger functions (100+ lines) reserved for complex data transformation
  - Example: `runAiScraper()` at 110 lines handles multiple API interaction steps
  - Example: `normalizeAnswer()` at 60 lines handles deep object traversal

**Parameters:**
- Use objects for functions with multiple parameters
  - Example: `ScrapeRequest` type for `runAiScraper(request: ScrapeRequest)`
- Generic type parameters for reusable store operations
  - Example: `loadSovereignValue<T>(key: string, fallback: T): Promise<T>`

**Return Values:**
- Async functions return Promise-wrapped types
- Use union types for conditional returns
  - Example: `{ ok: boolean; text: string; status: number }` from `tryFetch()`
- Nullable returns use `| null` explicitly
  - Example: `AuditReport | null`

## Module Design

**Exports:**
- Named exports preferred over default for utility modules
  - Example: `export async function loadSovereignValue<T>(...)`
  - Example: `export type Provider = ...`
- Default exports used for React components in app/routes
  - Example: `export default function RootLayout()`

**Barrel Files:**
- Not used in this codebase
- Imports are direct from source files: `@/components/dashboard/tabs/aeo-audit-tab`

**Type Exports:**
- Separated clearly: `export type X` vs `export const Y`
- Type files use `as const` for discriminated unions
  - Example: `export const tabs = [...] as const` with `type TabKey = (typeof tabs)[number]`

## Validation

**Framework:** Zod for schema validation

**Patterns:**
- Used in API routes for input validation
  - Example in `/app/api/scrape/route.ts`:
    ```typescript
    const InputSchema = z.object({
      provider: z.enum([...]),
      prompt: z.string().min(3),
      requireSources: z.boolean().optional(),
    });
    const parsed = InputSchema.parse(body);
    ```
- Zod inferred types: `type Provider = z.infer<typeof ProviderSchema>`

---

*Convention analysis: 2026-02-28*
