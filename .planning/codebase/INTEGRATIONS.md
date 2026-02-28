# External Integrations

**Analysis Date:** 2026-02-28

## APIs & External Services

**Web Scraping & AI Monitoring:**
- Bright Data - Web scraping and AI model response collection
  - SDK/Client: Native `fetch()` calls to Bright Data API
  - Auth: `BRIGHT_DATA_KEY` (Bearer token)
  - Base URL: `https://api.brightdata.com/datasets/v3/`
  - Endpoints used:
    - `POST /scrape` - Submit scraping job for AI provider responses
    - `GET /progress/{snapshot_id}` - Poll job status
    - `GET /snapshot/{snapshot_id}` - Download results as JSON
  - Implementation: `lib/server/brightdata-scraper.ts`
  - Datasets configured per provider (ChatGPT, Perplexity, Copilot, Gemini, Google AI, Grok)

**AI Model Inference:**
- OpenRouter - LLM API for text analysis and insights
  - SDK/Client: Native `fetch()` to OpenRouter API
  - Auth: `OPENROUTER_KEY` (Bearer token)
  - Base URL: `https://openrouter.ai/api/v1/`
  - Endpoint: `POST /chat/completions`
  - Model: `moonshotai/kimi-k2.5` (configured in `app/api/analyze/route.ts`)
  - Features: Support for custom max_tokens, temperature parameters
  - Caching: In-memory cache with 30-minute TTL (same prompt/params)
  - Edge runtime: Endpoint runs on Vercel Edge Functions

**Web Crawling (Audit):**
- Direct HTTP fetches (no external SDK)
  - User-Agent: `GEO-AEO-Tracker/1.0`
  - Protocols: HTTP/HTTPS
  - Endpoints: Standard web URLs for SEO/AEO audit checks
  - Implementation: `app/api/audit/route.ts`
  - No external API required

## Data Storage

**Databases:**
- None - Client-side storage only (no backend database)

**File Storage:**
- Local filesystem only - Next.js static assets in `/public`
- No cloud storage integration

**Client-Side Persistence:**
- IndexedDB - Primary store for user state
  - Client: `idb-keyval` library wrapper
  - Key-value pairs for dashboard state persistence
  - Implementation: `lib/client/sovereign-store.ts`
- localStorage - Fast-path cache (fallback only)
  - Used as supplementary cache with quota limits (~5 MB)
  - Automatically migrated to IndexedDB on next load

**Caching:**
- In-memory cache (server-side):
  - OpenRouter analyze endpoint: 30-minute TTL per prompt
  - Bright Data scraper: 20-minute TTL per request
  - Implementation: `Map<string, { expiresAt, value }>`

## Authentication & Identity

**Auth Provider:**
- None - No user authentication system
- BYOK (Bring Your Own Keys) model: Users provide their own API keys via environment variables
- Keys stored in environment variables:
  - `BRIGHT_DATA_KEY`
  - `OPENROUTER_KEY`

## Monitoring & Observability

**Error Tracking:**
- None detected - No external error tracking service integrated

**Logs:**
- Browser console (client-side)
- Server logs from Next.js runtime
- No external logging service

## CI/CD & Deployment

**Hosting:**
- Vercel - Recommended deployment platform
  - Supports Next.js Edge Runtime for `/api/analyze`
  - Environment variables managed via Vercel dashboard

**CI Pipeline:**
- None detected - Repository appears to use manual deployment

## Environment Configuration

**Required env vars for full functionality:**

Server-side (must be in `.env` or Vercel environment):
- `BRIGHT_DATA_KEY` - Bright Data API authentication
- `BRIGHT_DATA_DATASET_CHATGPT` - Dataset ID for ChatGPT responses
- `BRIGHT_DATA_DATASET_PERPLEXITY` - Dataset ID for Perplexity responses
- `BRIGHT_DATA_DATASET_COPILOT` - Dataset ID for Copilot responses
- `BRIGHT_DATA_DATASET_GEMINI` - Dataset ID for Gemini responses
- `BRIGHT_DATA_DATASET_GOOGLE_AI` - Dataset ID for Google AI responses
- `BRIGHT_DATA_DATASET_GROK` - Dataset ID for Grok responses
- `OPENROUTER_KEY` - OpenRouter API key for analysis endpoint

Client-visible (can be in `.env.local` or prefixed `NEXT_PUBLIC_`):
- `NEXT_PUBLIC_DEMO_ONLY` - Enable demo mode (boolean, "true"/"false")

**Secrets location:**
- Development: `.env` file (not committed)
- Production: Vercel environment variables dashboard
- Note: `.env` is in `.gitignore` to prevent secret leakage

## Webhooks & Callbacks

**Incoming:**
- None - Application is not a webhook receiver

**Outgoing:**
- Bright Data job monitoring - Polling-based (no webhooks)
  - Status checks: `GET /progress/{snapshot_id}` (polled up to 30 times with 2-second delays)
- No outbound webhooks configured

## Request/Response Patterns

**Bright Data Scraper:**
```
POST https://api.brightdata.com/datasets/v3/scrape?dataset_id={id}&notify=false
Headers: Authorization: Bearer {key}
Body: { input: [{ url, prompt, index, geolocation? }] }
Response: 202 (pending) → poll status → download JSON
```

**OpenRouter Analyze:**
```
POST https://openrouter.ai/api/v1/chat/completions
Headers: Authorization: Bearer {key}, Content-Type: application/json
Body: { model, messages: [{ role, content }], max_tokens, temperature }
Response: { choices: [{ message: { content } }] }
Cache Key: JSON.stringify({ prompt, maxTokens, temperature })
```

**Web Audit (HTTP/HTTPS):**
```
GET {target-origin}/llms.txt
GET {target-origin}/llms-full.txt
GET {target-origin}/robots.txt
GET {target-origin}/sitemap.xml
GET {target-origin}/ (main page)
Headers: User-Agent: GEO-AEO-Tracker/1.0
All requests: cache: no-store, redirect: follow
```

## API Error Handling

**Bright Data:**
- Errors: 202 (pending) handled with polling, 4xx/5xx thrown
- Validation: Zod schema enforces provider type and required fields
- Timeouts: Max 30 polling attempts (60 seconds)

**OpenRouter:**
- Errors: Non-2xx responses return JSON with error message
- Validation: Zod schema for request payload
- Fallback: In-memory cache prevents repeated requests on failure

**Web Audit:**
- Errors: tryFetch() wraps in try-catch, returns `{ ok: false, status: 0 }` on network error
- No external dependency failures block the audit

---

*Integration audit: 2026-02-28*
