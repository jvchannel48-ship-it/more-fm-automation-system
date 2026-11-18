import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, setAccountCookie } from '@/lib/account-api'
import { createAccount, loginAccount, removeSession, USER_SESSION_COOKIE } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { mode?: unknown; email?: unknown; password?: unknown; displayName?: unknown }
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''
  try {
    const session = body.mode === 'signup'
      ? await createAccount(email, typeof body.displayName === 'string' ? body.displayName : '', password)
      : await loginAccount(email, password)
    const response = NextResponse.json({ ok: true }, { headers: privateJsonHeaders })
    return setAccountCookie(response, session.token, session.expiresAt)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hindi nagtagumpay ang account request.'
    const status = message === 'Incorrect email or password.' ? 401
      : message === 'An account with this email already exists.' ? 409
      : message.includes('must') || message.includes('valid email') ? 400
      : message.includes('DATABASE_URL') || message.includes('relation') ? 503 : 500
    console.error('[morefm] account sign in/up failed', message)
    return NextResponse.json({ error: status === 500 ? 'Hindi makumpleto ang account request ngayon.' : message }, { status, headers: privateJsonHeaders })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await removeSession(request.cookies.get(USER_SESSION_COOKIE)?.value)
  } catch (error) { console.error('[morefm] failed to remove account session', error instanceof Error ? error.message : 'unknown error') }
  const response = NextResponse.json({ ok: true }, { headers: privateJsonHeaders })
  response.cookies.delete(USER_SESSION_COOKIE)
  return response
}
