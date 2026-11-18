import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, checkPassword, createSessionToken, isAdmin, isAdminConfigured } from '@/lib/auth'

export async function GET() {
  return NextResponse.json({ admin: await isAdmin() })
}

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) return NextResponse.json({ error: 'Admin login is not configured. Set ADMIN_PASSWORD in the deployment environment.' }, { status: 503 })
  const body = (await request.json().catch(() => ({}))) as { password?: unknown }
  if (typeof body.password !== 'string' || !checkPassword(body.password)) {
    return NextResponse.json({ error: 'Mali ang password' }, { status: 401 })
  }
  const { token, maxAge } = createSessionToken()
  const store = await cookies()
  // Same-site onRender host: Lax works on mobile Safari/Chrome over HTTPS.
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
  return NextResponse.json({ admin: true })
}

export async function DELETE() {
  const store = await cookies()
  store.delete({ name: ADMIN_COOKIE, path: '/' })
  return NextResponse.json({ admin: false })
}
