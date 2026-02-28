import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'

// Lazy getter — validates AUTH_SECRET at call time, not at import time.
// proxy.ts imports this file; the env var must exist at runtime, not build time.
function getEncodedKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Creates a signed HS256 JWT containing the given payload.
 * Sets iat (issued-at) and a 7-day expiration automatically.
 */
export async function encrypt(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getEncodedKey())
}

/**
 * Verifies a signed JWT and returns its payload.
 * Returns null on any error (expired, invalid signature, undefined input).
 */
export async function decrypt(session: string | undefined): Promise<JWTPayload | null> {
  if (!session) return null
  try {
    const { payload } = await jwtVerify(session, getEncodedKey(), {
      algorithms: ['HS256'],
    })
    return payload
  } catch {
    return null
  }
}

/**
 * Creates a 7-day session by encrypting an authenticated JWT and setting
 * an httpOnly session cookie. Only call from server contexts (Route Handlers,
 * Server Actions) — NOT from proxy.ts.
 */
export async function createSession(): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const token = await encrypt({ authenticated: true, expiresAt: expiresAt.toISOString() })
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

/**
 * Reads the session cookie and verifies it.
 * Returns the JWT payload if valid, null otherwise.
 * Only call from server contexts (Route Handlers, Server Actions) — NOT from proxy.ts.
 */
export async function verifySession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const session = cookieStore.get('session')?.value
  return decrypt(session)
}
