import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/auth'

/**
 * Request interceptor that gates all routes behind JWT verification.
 * Uses Next.js 16 proxy convention (proxy.ts, not middleware.ts).
 *
 * Public paths (no auth required):
 *   - /login — the login page itself
 *   - /api/auth/login — the login API endpoint
 *
 * Protected paths:
 *   - All page routes → redirect unauthenticated requests to /login?callbackUrl=<pathname>
 *   - All API routes (/api/*) → return 401 JSON for unauthenticated requests
 *
 * Static assets (_next/static, _next/image, favicon.ico) are excluded by the matcher.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Allow public paths without authentication
  if (pathname === '/login' || pathname === '/api/auth/login') {
    return NextResponse.next()
  }

  // Read and verify session cookie
  // Use request.cookies.get() — cookies() from next/headers is not available in proxy context
  const sessionCookie = request.cookies.get('session')?.value
  const session = await decrypt(sessionCookie)

  if (!session) {
    // Unauthenticated API request — return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Unauthenticated page request — redirect to login with callbackUrl
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Session is valid — allow request to proceed
  return NextResponse.next()
}

/**
 * Matcher excludes static assets from auth check.
 * Note: _next/data is NOT excluded — that would leave API data routes unprotected.
 * Note: /api routes are NOT excluded — proxy provides defense-in-depth for API routes.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
