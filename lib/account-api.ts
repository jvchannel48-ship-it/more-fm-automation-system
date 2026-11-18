import { NextResponse, type NextRequest } from 'next/server'
import { getAccountFromToken, USER_SESSION_COOKIE } from './account-store'

export const privateJsonHeaders = { 'Cache-Control': 'no-store, max-age=0' }

export async function requireAccount(request: NextRequest) {
  try {
    const user = await getAccountFromToken(request.cookies.get(USER_SESSION_COOKIE)?.value)
    if (!user) return { user: null, response: NextResponse.json({ error: 'Mag-login muna sa account mo.' }, { status: 401, headers: privateJsonHeaders }) }
    return { user, response: null }
  } catch (error) {
    console.error('[morefm] account database unavailable', error instanceof Error ? error.message : 'unknown error')
    return { user: null, response: NextResponse.json({ error: 'Listener account database is unavailable. Check the Render DATABASE_URL and migration.' }, { status: 503, headers: privateJsonHeaders }) }
  }
}

export function setAccountCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
  return response
}
