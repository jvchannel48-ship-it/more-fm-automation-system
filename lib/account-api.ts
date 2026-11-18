import { NextResponse } from 'next/server'
import { getAuthenticatedUser, getSupabaseServiceClient } from './supabase'

export const privateJsonHeaders = { 'Cache-Control': 'no-store, max-age=0' }

export async function requireAccount(authorization: string | null) {
  const user = await getAuthenticatedUser(authorization)
  if (!user) return { user: null, client: null, response: NextResponse.json({ error: 'Mag-login muna sa account mo.' }, { status: 401, headers: privateJsonHeaders }) }
  try {
    return { user, client: getSupabaseServiceClient(), response: null }
  } catch {
    return { user: null, client: null, response: NextResponse.json({ error: 'Account storage is not configured.' }, { status: 503, headers: privateJsonHeaders }) }
  }
}
