import { cookies } from 'next/headers'
import { type NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, checkPassword, createSessionToken, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }

export async function GET() {
  return NextResponse.json({ admin: await isAdmin() }, noStore)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown }
  if (typeof body.password !== 'string' || !checkPassword(body.password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401, ...noStore })
  }
  const { token, maxAge } = createSessionToken()
  const store = await cookies()
  store.set(ADMIN_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge })
  return NextResponse.json({ admin: true }, noStore)
}

export async function DELETE() {
  const store = await cookies()
  store.delete({ name: ADMIN_COOKIE, path: '/' })
  return NextResponse.json({ admin: false }, noStore)
}
