# Codebase Concerns

**Analysis Date:** 2026-02-28

## Tech Debt

**No explicit error messages in scrape API failures:**
- Issue: `callScrapeOne()` in `components/sovereign-dashboard.tsx:790` silently returns `null` on error without user feedback about what failed (network, auth, rate limit, data format)
- Files: `components/sovereign-dashboard.tsx:790`, `app/api/scrape/route.ts:25`
- Impact: Users cannot debug failed scrapes. Silent failures make troubleshooting API configuration nearly impossible
- Fix approach: Log detailed error messages and include them in setMessage() calls. Store structured error info in state for later inspection

**Unsafe JSON parsing without validation:**
- Issue: Multiple locations parse JSON without try-catch or schema validation
- Files: `components/sovereign-dashboard.tsx:293`, `components/sovereign-dashboard.tsx:933`, `components/dashboard/tabs/reputation-sources-tab.tsx:19`, `app/api/audit/route.ts:145`
- Impact: Malformed cached data or responses crash the app silently or produce undefined behavior
- Fix approach: Wrap all JSON.parse() in try-catch blocks with fallback values. Use Zod schema validation for complex objects before parsing

**In-memory API cache is ephemeral in edge runtime:**
- Issue: `app/api/analyze/route.ts:13` uses `new Map()` for caching, which is per-request in edge runtime
- Files: `app/api/analyze/route.ts:13`, `app/api/analyze/route.ts:69-71`
- Impact: Cache never persists; every request creates a new runtime instance. 30-minute TTL is meaningless
- Fix approach: Remove the cache entirely or migrate to Redis/Vercel KV for true distributed caching

**Type-safety issues with `unknown` types:**
- Issue: Excessive use of `unknown` type with unsafe casts instead of proper discrimination
- Files: `lib/server/brightdata-scraper.ts:81-87`, `lib/server/brightdata-scraper.ts:408-410`, `components/dashboard/tabs/citation-opportunities-tab.tsx:418`, `components/sovereign-dashboard.tsx:913-916`
- Impact: Runtime errors from accessing missing properties, difficult to debug type mismatches
- Fix approach: Use proper discriminated unions or type guards instead of `as Record<string, unknown>` casts

**Workspace state persistence uses two backends (localStorage + IndexedDB) inconsistently:**
- Issue: `loadSovereignValue()` tries IndexedDB first, then localStorage, but doesn't guarantee consistency. localStorage is 5MB quota-limited
- Files: `lib/client/sovereign-store.ts:10-31`, `components/sovereign-dashboard.tsx:292`, `components/sovereign-dashboard.tsx:351`
- Impact: Large datasets (500 runs) can exceed localStorage quota, causing quota errors that are silently caught. Data loss on quota exceeded
- Fix approach: Use IndexedDB exclusively (unlimited storage). Add size monitoring to warn users before quota issues

**React useCallback with exhaustive-deps disabled:**
- Issue: `runScheduledBatch()` has `// eslint-disable-next-line react-hooks/exhaustive-deps` at line 435
- Files: `components/sovereign-dashboard.tsx:435`
- Impact: Scheduler uses stale refs (stateRef, busyRef, callScrapeOneRef) which are updated on every render but may not be synced properly
- Fix approach: Remove disable comment and ensure all dependencies are properly tracked, or refactor to avoid the need for ref updates

---

## Known Bugs

**Scheduler interval can double-fire on state changes:**
- Symptoms: Auto-run triggers twice if scheduleIntervalMs changes while scheduled
- Files: `components/sovereign-dashboard.tsx:444-452`
- Trigger: Toggle schedule enabled or change interval duration with an active scheduler
- Workaround: Disable scheduler before changing settings

**JSON-LD schema parsing fails silently on malformed JSON-LD:**
- Symptoms: Audit checks skip invalid JSON-LD blocks without reporting them as issues
- Files: `app/api/audit/route.ts:153` (catch without logging)
- Trigger: Website with malformed schema.org JSON-LD tags
- Workaround: None—audit will show 0 schema mentions even if schema exists

**Brand mention detection is case-sensitive in some places:**
- Symptoms: "Brand" vs "brand" treated differently
- Files: `components/sovereign-dashboard.tsx:677-679` (lowercase comparison works correctly)
- Trigger: Brand name with mixed case vs lookup in different case
- Workaround: Ensure brand config uses lowercase or always uppercase

---

## Security Considerations

**API keys exposed in error messages:**
- Risk: OpenRouter and Bright Data keys could leak in response error messages if APIs return them
- Files: `app/api/analyze/route.ts:37-61`, `lib/server/brightdata-scraper.ts:57-79`
- Current mitigation: Keys are passed only in Authorization headers (correct), but error responses are not sanitized
- Recommendations: Sanitize all API error responses before returning to client. Never include raw error messages that might contain auth data

**Arbitrary URL fetching in audit endpoint:**
- Risk: Users can trigger fetch() to any URL, including internal IPs or services
- Files: `app/api/audit/route.ts:26-37`
- Current mitigation: URL validation via Zod schema (must be valid URL)
- Recommendations: Add allowlist of domains or rate limiting by client IP. Consider blocking RFC1918 private IPs

**CORS not explicitly configured - relies on Next.js defaults:**
- Risk: API endpoints may accept requests from any origin
- Files: `app/api/scrape/route.ts`, `app/api/audit/route.ts`, `app/api/analyze/route.ts`
- Current mitigation: POST-only endpoints reduce some risk
- Recommendations: Add explicit CORS headers with origin whitelist, or deny all CORS if SPA is same-origin

**Local storage contains sensitive AI query history:**
- Risk: Prompts stored in localStorage may contain sensitive business strategy or proprietary info
- Files: `components/sovereign-dashboard.tsx:292-298`, `lib/client/sovereign-store.ts`
- Current mitigation: Runs to IndexedDB only (not localStorage), though workspaces/state go to both
- Recommendations: Encrypt IndexedDB with browser encryption. Document that client data is unencrypted on disk

**dangerouslySetInnerHTML used in theme script injection:**
- Risk: If theme script is ever dynamically generated, XSS is possible
- Files: `app/layout.tsx:33`
- Current mitigation: Theme script is hardcoded string (safe), but no CSP header to prevent inline scripts
- Recommendations: Add Content-Security-Policy header. Consider moving theme script to external file

---

## Performance Bottlenecks

**Reputation sources tab re-renders entire response list on every scroll:**
- Problem: `ReputationSourcesTab` renders all runs without virtualization
- Files: `components/dashboard/tabs/reputation-sources-tab.tsx:200-400`
- Cause: Large lists (500+ runs) cause DOM bloat and slow interactions
- Improvement path: Implement React virtual scrolling (react-window) or pagination, render window of 20-50 visible items only

**Visibility analytics trend recalculated on every render:**
- Problem: `visibilityTrend` useMemo iterates all 500 runs every re-render
- Files: `components/sovereign-dashboard.tsx:549-566`
- Cause: O(n) iteration on state.runs which can hold 500 items; called on every state update
- Improvement path: Add memoization key based on run count/timestamps, or maintain separate aggregated state

**Partner discovery tab filters entire run list synchronously:**
- Problem: Filter operations on 500+ items happens in render phase
- Files: `components/dashboard/tabs/partner-discovery-tab.tsx:280-300`
- Cause: Client-side filtering without debouncing
- Improvement path: Debounce filter input (300ms) and use useCallback with proper deps

**Batch run spawns sequential Promise.allSettled calls:**
- Problem: `batchRunAllPrompts()` loops through prompts sequentially, waiting for each to complete
- Files: `components/sovereign-dashboard.tsx:838-881`
- Cause: 10 prompts × 6 providers = 60 sequential API calls, takes 2+ minutes with default 2s timeout per call
- Improvement path: Implement concurrency limit (max 3-5 parallel promises) instead of sequential

**Workspace localStorage persistence synchronous on every state change:**
- Problem: `saveSovereignValue()` serializes entire AppState to JSON and writes synchronously
- Files: `components/sovereign-dashboard.tsx:344`, `lib/client/sovereign-store.ts:38-51`
- Cause: 500 runs × 3KB per run = 1.5MB serialization on every mutation
- Improvement path: Debounce saves (2s), or write only diffs, or move to background worker

---

## Fragile Areas

**Sentiment detection is brittle heuristic:**
- Files: `components/sovereign-dashboard.tsx:682-720`
- Why fragile: Uses simple word lists (positiveWords, negativeWords arrays) that don't account for negation ("not bad"), context, or sarcasm
- Safe modification: Add explicit test cases for edge cases (double negation, sarcasm). Consider adding ML model later or external sentiment API
- Test coverage: No unit tests for sentiment detection logic

**Brand mention highlighting regex is not anchored:**
- Files: `components/dashboard/tabs/reputation-sources-tab.tsx:80-88`
- Why fragile: `brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` escapes special chars but substring matching can match partial words
- Safe modification: Add word boundary checks (`\b${pattern}\b`) to avoid matching "Brand" inside "BrandX"
- Test coverage: No tests for highlight accuracy

**URL junk filtering hardcodes CDN list:**
- Files: `components/sovereign-dashboard.tsx:510-520`
- Why fragile: List of junkHosts is incomplete and will miss new CDNs. Regex for file extensions may not catch all media types
- Safe modification: Load junk list from API or config file, add metrics to track false positives, periodically review and update
- Test coverage: No tests; filtering applied silently with no audit trail

**AEO audit endpoint relies on regex heuristics:**
- Files: `app/api/audit/route.ts:93-419`
- Why fragile: 20+ regex patterns and heuristics (line 403-438) for JavaScript weight, semantic HTML detection, BLUF density
- Safe modification: Add logging for each check result. Create integration tests against real websites. Document why thresholds exist
- Test coverage: No automated tests; audit logic untested

**Bright Data API normalization extracts deeply nested fields:**
- Files: `lib/server/brightdata-scraper.ts:238-280`
- Why fragile: `extractDeepText()` recursively digs into unknown object structures to find answer text. If API changes schema, extraction fails silently
- Safe modification: Add API response validation schema before normalization. Log unexpected structures. Add fallback path
- Test coverage: No tests for edge cases (missing answer field, unexpected nesting)

---

## Scaling Limits

**IndexedDB storage is browser-dependent, typically 50MB-100MB:**
- Current capacity: App stores 500 runs × ~3KB per run (~1.5MB), plus workspaces and battlecards
- Limit: Will hit quota around 5000-10000 runs depending on browser and domain usage
- Scaling path: Implement archival (auto-export old runs as CSV or JSON), or add server-side storage option with auth, or purge runs older than 90 days

**In-memory state grows linearly with runs:**
- Current capacity: 500 runs held in AppState; each run is ~3KB after serialization
- Limit: At 5000+ runs, serialization time and memory pressure become noticeable (seconds to save, UI lag on mutations)
- Scaling path: Implement pagination in state (keep only last 100 in memory, load others on demand), or move to server backend with filtering

**Batch run execution is sequential and slow:**
- Current capacity: 10 prompts × 6 providers = 60 API calls; at 2-3s per call, total time is 2-3 minutes
- Limit: Users expect <30s for batch operations; >5 min execution timeout will cancel
- Scaling path: Implement concurrent execution with queue (max 5-10 parallel), add progress tracking with cancel button, or implement server-side batch job queue

**localStorage quota exceeded causes silent data loss:**
- Current capacity: ~5MB across all sites in localStorage; app can fit ~1.5MB with 500 runs
- Limit: Adding more workspaces, battlecards, or larger responses will exceed quota
- Scaling path: Drop localStorage entirely, use IndexedDB exclusively with size warnings at 70% quota, or compress data before storage

---

## Dependencies at Risk

**Bright Data API implementation is tightly coupled:**
- Risk: API schema changes, rate limits, or service outages break the entire scraper
- Impact: All AI visibility tracking fails if Bright Data API changes or goes down
- Migration plan: Decouple scraper logic from provider-specific dataset configs. Add abstraction layer for data normalization. Consider multi-provider aggregation

**OpenRouter API fallback not implemented:**
- Risk: Using single LLM provider (moonshotai/kimi-k2.5) with no fallback
- Impact: Analysis feature breaks if OpenRouter model becomes unavailable
- Migration plan: Add fallback model list (Claude, GPT-4, etc.). Implement retry logic with exponential backoff and different models

**Bright Data hardcodes dataset IDs per provider:**
- Risk: If Bright Data rotates dataset IDs or deprecates a provider, code breaks
- Impact: Individual providers can become non-functional independently
- Migration plan: Store dataset IDs in database or config service. Implement health checks to detect broken providers early

**No fallback for IndexedDB:**
- Risk: IndexedDB disabled in private browsing mode, or browser storage API unavailable
- Impact: Demo mode is the only working mode for private browsing users
- Migration plan: Detect IndexedDB unavailability and fall back to localStorage or in-memory state. Warn user that data won't persist

---

## Missing Critical Features

**No data export:**
- Problem: Users cannot export runs, audit reports, or battlecards for external analysis or sharing
- Blocks: Power users who want to aggregate data with other tools, compliance requirements (data portability)
- Feature scope: CSV export for runs (visibility score, sentiment, sources), JSON export for full state, audit reports as PDF

**No authentication or multi-user access:**
- Problem: All data is browser-local, no way to share workspaces or collaborate
- Blocks: Team adoption, security of shared credentials
- Feature scope: Simple API auth (API key), shared workspace URLs with read-only mode, user invitations

**No API documentation or sandbox:**
- Problem: No OpenAPI spec, no way for users to call audit/analyze endpoints programmatically
- Blocks: External tool integrations, automation
- Feature scope: OpenAPI spec, Swagger UI, code generation for client libraries

**No data validation or schema versioning:**
- Problem: If AppState schema changes, old stored data silently breaks during load
- Blocks: Rolling out new fields, schema migrations
- Feature scope: Zod schema for AppState, migration functions for versioning, versioned storage keys

---

## Test Coverage Gaps

**No unit tests for core business logic:**
- What's not tested: Visibility score calculation, sentiment detection, drift alert generation, URL filtering
- Files: `components/sovereign-dashboard.tsx:721-755` (calcVisibilityScore), `components/sovereign-dashboard.tsx:682-720` (detectSentiment), `components/sovereign-dashboard.tsx:509-547` (partnerLeaderboard)
- Risk: Scoring algorithm changes silently break results; no regression detection
- Priority: High—scoring is the core value prop

**No tests for API error handling:**
- What's not tested: Missing API keys, rate limits, network timeouts, malformed responses
- Files: `app/api/scrape/route.ts`, `app/api/audit/route.ts`, `app/api/analyze/route.ts`
- Risk: API errors cascade to user-facing crashes instead of graceful degradation
- Priority: High—affects user experience directly

**No integration tests for Bright Data scraper:**
- What's not tested: Provider-specific response parsing, edge cases in answer extraction
- Files: `lib/server/brightdata-scraper.ts`
- Risk: Silent failures when API response schema changes; no early detection
- Priority: High—scraper is critical path

**No tests for storage layer:**
- What's not tested: IndexedDB/localStorage persistence, quota handling, data corruption recovery
- Files: `lib/client/sovereign-store.ts`, `components/sovereign-dashboard.tsx:290-344`
- Risk: Silent data loss on quota exceeded; no validation of stored data integrity
- Priority: Medium—data loss is critical but rare

**No E2E tests for dashboard interactions:**
- What's not tested: Workflow (add prompt → run scrape → view results), workspace switching, tab navigation
- Files: `components/sovereign-dashboard.tsx` (all UI logic)
- Risk: UI regressions go undetected; refactoring breaks end-to-end user flows
- Priority: Medium—caught by manual testing but not automated

---

*Concerns audit: 2026-02-28*
