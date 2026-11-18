import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let serviceClient: SupabaseClient | null = null

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return serviceClient
}

export async function getAuthenticatedUser(authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!token || !url || !anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await authClient.auth.getUser(token)
  return error ? null : data.user
}
