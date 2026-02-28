import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSession } from '@/lib/auth'
import crypto from 'crypto'

const LoginSchema = z.object({
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const { password } = LoginSchema.parse(await req.json())

    const expected = process.env.SITE_PASSWORD
    if (!expected) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
    }

    // Constant-time comparison to prevent timing attacks (Pitfall 7: check lengths first
    // because timingSafeEqual throws if buffer lengths differ).
    const inputBuf = Buffer.from(password)
    const expectedBuf = Buffer.from(expected)
    const match =
      inputBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(inputBuf, expectedBuf)

    if (!match) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    await createSession()
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
