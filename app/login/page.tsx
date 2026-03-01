'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * LoginForm reads callbackUrl from search params and handles the login flow:
 * - POSTs password to /api/auth/login
 * - Shows inline error on failure
 * - Redirects client-side on success (avoids cookie race condition on server 302)
 */
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'

  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        // Client-side redirect — gives browser time to commit Set-Cookie header
        // before navigation (avoids cookie race condition, Pitfall 6)
        router.push(callbackUrl)
      } else {
        const data = await response.json()
        setError(data.error ?? 'Login failed')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="bd-panel rounded-lg p-8 max-w-sm w-full">
        <h1 className="text-xl font-semibold mb-6 text-th-text">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-th-text-secondary mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              className="bd-input w-full rounded-md px-3 py-2"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="text-th-danger text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bd-btn-primary w-full rounded-md py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * Login page — wraps LoginForm in Suspense to satisfy Next.js requirement
 * that useSearchParams() callers be wrapped in a Suspense boundary.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-th-text-muted">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
