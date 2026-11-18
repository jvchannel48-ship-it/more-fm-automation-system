import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, setAccountCookie } from '@/lib/account-api'
import { loginAccount, loginOrCreateDeviceAccount, removeSession, USER_SESSION_COOKIE } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { mode?: unknown; email?: unknown; password?: unknown; deviceId?: unknown }
  try {
    // Device login: phone/browser is bound automatically — no create-account form.
    if (body.mode === 'device' || (typeof body.deviceId === 'string' && body.deviceId)) {
      const session = await loginOrCreateDeviceAccount(typeof body.deviceId === 'string' ? body.deviceId : '')
      const response = NextResponse.json({ ok: true, device: true }, { headers: privateJsonHeaders })
      return setAccountCookie(response, session.token, session.expiresAt)
    }

    // Legacy email login kept for existing accounts; signup/create is disabled.
    if (body.mode === 'signup') {
      return NextResponse.json({ error: 'Create account is disabled. Open the station on your phone — credits bind to this device automatically.' }, { status: 403, headers: privateJsonHeaders })
    }

    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const session = await loginAccount(email, password)
    const response = NextResponse.json({ ok: true }, { headers: privateJsonHeaders })
    return setAccountCookie(response, session.token, session.expiresAt)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hindi nagtagumpay ang account request.'
    const status = message === 'Incorrect email or password.' ? 401
      : message === 'Invalid device id.' ? 400
      : message.includes('must') || message.includes('valid email') ? 400
      : message.includes('DATABASE_URL') || message.includes('relation') ? 503 : 500
    console.error('[morefm] account sign in failed', message)
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
