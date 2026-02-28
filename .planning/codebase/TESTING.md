# Testing Patterns

**Analysis Date:** 2026-02-28

## Test Framework

**Runner:**
- Not detected — no Jest, Vitest, or similar framework configured
- No test files found (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx)

**Manual Testing Scripts:**
- `test:scraper` script runs Node.js directly: `node --env-file=.env scripts/test-scraper.js`
- `test:pillar` script: `node scripts/test-pillar.js`
- Located in `/scripts` directory (ignored by ESLint)

**Build/Dev Tools:**
- Next.js 16.1.6 (dev: `next dev`, build: `next build`)
- TypeScript strict mode for compile-time validation
- ESLint 9 for code quality checks

## Test File Organization

**Manual Script Location:**
- `scripts/test-scraper.js` — Tests Bright Data scraper integration
- `scripts/test-pillar.js` — Tests pillar/audit functionality

**Pattern:**
- Separate from source code (not co-located)
- Uses Node.js environment with `.env` file loading for integration testing

**Current Approach:**
- No unit test framework
- Manual/ad-hoc testing via Node scripts
- Type safety through TypeScript compiler checks

## Testing Strategy

**Compile-time Validation:**
- TypeScript strict mode (`"strict": true` in `tsconfig.json`)
- Catches type mismatches, null/undefined issues, missing properties
- All `.ts` and `.tsx` files must pass `tsc` before build

**Zod Runtime Validation:**
- Used in API routes for input validation
  - Example in `app/api/scrape/route.ts`:
    ```typescript
    const InputSchema = z.object({
      provider: z.enum(["chatgpt", "perplexity", "copilot", "gemini", "google_ai", "grok"]),
      prompt: z.string().min(3),
      requireSources: z.boolean().optional(),
      country: z.string().optional(),
    });
    const parsed = InputSchema.parse(body);
    ```
  - Ensures API contracts are validated before processing

**Error Handling in Code:**
- Try/catch blocks in critical paths (API calls, JSON parsing)
  - Example in `app/api/scrape/route.ts`:
    ```typescript
    try {
      const body = await req.json();
      const parsed = InputSchema.parse(body);
      const result = await runAiScraper(parsed);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    ```
  - Example in `lib/client/sovereign-store.ts`:
    ```typescript
    try {
      const indexed = await get<T>(key);
      if (indexed !== undefined) return indexed;
    } catch {
      try {
        const localRaw = window.localStorage.getItem(key);
        if (localRaw) return JSON.parse(localRaw) as T;
      } catch { /* give up */ }
    }
    ```

## Mocking Patterns

**Not Implemented:**
- No mocking framework detected (Jest, Vitest, Sinon, etc.)
- Manual testing scripts likely use direct API calls to integration services

**Data Mocking:**
- `lib/demo-data.ts` provides hardcoded demo state for offline testing
  - Pre-seeded data for ScrapeRun, Battlecard, AuditReport, DriftAlert, AppState
  - Used when `NEXT_PUBLIC_DEMO_ONLY=true` environment variable is set
  - Deterministic seeding with fixed dates to match SSR/client rendering
  - Example:
    ```typescript
    const BATCH_DATES = [
      "2026-02-08T10:15:00.000Z",
      "2026-02-11T14:30:00.000Z",
      "2026-02-14T09:00:00.000Z",
    ];
    ```

**API Mocking Strategy:**
- Demo mode uses `DEMO_STATE` from `lib/demo-data.ts` instead of live API calls
- Client-side component receives demoMode prop and conditionally uses demo data
  - See `sovereign-dashboard.tsx`: `demoMode={isDemoOnly}`

## Test Coverage

**Requirements:** Not enforced — no coverage tooling configured

**Verified Paths:**
- API routes have error handling (scrape, audit, analyze)
- State persistence tested via manual scripts
- Components render with type safety from TypeScript

**Current Coverage Approach:**
- Type safety: all code must pass `tsc --noEmit`
- API contracts: validated with Zod schemas
- Runtime behavior: manual testing via Node scripts

## Integration Testing

**Database/Storage:**
- `lib/client/sovereign-store.ts` provides local-first persistence
  - IndexedDB for unlimited storage
  - localStorage as fallback cache
  - Tested via `test:scraper` and `test:pillar` scripts
  - Example test path:
    ```typescript
    export async function loadSovereignValue<T>(key: string, fallback: T): Promise<T>
    export async function saveSovereignValue<T>(key: string, value: T): Promise<void>
    export async function clearSovereignStore(key: string): Promise<void>
    ```

**External APIs:**
- Bright Data web scraping API integration in `lib/server/brightdata-scraper.ts`
- Manual test script: `scripts/test-scraper.js` (requires `.env` setup)
- Mocking via demo mode when NEXT_PUBLIC_DEMO_ONLY is enabled

**Audit API:**
- `app/api/audit/route.ts` fetches page content and analyzes AEO signals
- Tests structured extraction of llms.txt, JSON-LD schema, robots.txt
- Manual test script: `scripts/test-pillar.js`

## Testing Gaps

**No Unit Tests:**
- Utility functions lack isolated tests
  - `extractSourcesFromAnswer()` — complex URL parsing and filtering
  - `normalizeAnswer()` — handles 10+ field name variants and deep recursion
  - `stripAnswerHtml()` — recursive HTML removal

**No Component Tests:**
- React components not tested for rendering, state changes, user interactions
  - 12 tab components in `components/dashboard/tabs/`
  - Main dashboard component: `sovereign-dashboard.tsx` (1000+ LOC)

**No E2E Tests:**
- No Playwright, Cypress, or Puppeteer tests
- No user interaction flows tested end-to-end

**No API Response Tests:**
- API routes have error handling but no response validation tests
- Edge cases in Bright Data response parsing untested

## Recommendations for Adding Tests

**Unit Tests:**
- Start with `lib/server/brightdata-scraper.ts` utilities
- Test URL filtering logic in `isThirdPartyCitation()`
- Test answer text extraction in `normalizeAnswer()` with multiple field variants

**API Tests:**
- Use Jest or Vitest for `/app/api/*` routes
- Mock Zod validation results
- Test error paths (missing env vars, API failures)

**Component Tests:**
- Consider React Testing Library for interactive tabs
- Test state changes when switching tabs
- Test form inputs (audit URL, custom prompts)

---

*Testing analysis: 2026-02-28*
