import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { getSupabaseServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  try {
    const client = getSupabaseServiceClient()
    const { data: config, error: configError } = await client.from('station_credit_settings').select('daily_allowance').eq('id', true).maybeSingle()
    if (configError) throw new Error('Supabase setup is incomplete. Apply the account/credit migration.')
    const profiles: Array<{ user_id: string; display_name: string; avatar_url: string | null; daily_credits: number; bonus_credits: number; credit_date: string; created_at: string }> = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('listener_profiles').select('user_id,display_name,avatar_url,daily_credits,bonus_credits,credit_date,created_at').order('created_at', { ascending: false }).range(offset, offset + 999)
      if (error) throw new Error('Supabase setup is incomplete. Apply the account/credit migration.')
      profiles.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    const users = []
    for (let page = 1; ; page++) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw new Error('Unable to list Supabase Auth users.')
      users.push(...data.users)
      if (data.users.length < 1000 || page >= 50) break
    }
    const emails = new Map(users.map((user) => [user.id, user.email ?? '']))
    return NextResponse.json({ dailyAllowance: config?.daily_allowance ?? 0, profiles: profiles.map((profile) => ({ ...profile, email: emails.get(profile.user_id) ?? '' })) }, { headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Supabase credit storage is not configured.' }, { status: 503, headers })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  const body = await request.json().catch(() => ({})) as { dailyAllowance?: unknown }
  if (!Number.isInteger(body.dailyAllowance) || (body.dailyAllowance as number) < 0 || (body.dailyAllowance as number) > 1_000_000) return NextResponse.json({ error: 'Daily credits must be a whole number from 0 to 1,000,000.' }, { status: 400, headers })
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('set_daily_credit_allowance', { p_amount: body.dailyAllowance })
    if (error) throw error
    return NextResponse.json({ dailyAllowance: data }, { headers })
  } catch {
    return NextResponse.json({ error: 'Hindi ma-save. I-apply muna ang Supabase account/credit migration at i-configure ang service-role key.' }, { status: 503, headers })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  const body = await request.json().catch(() => ({})) as { addCredits?: unknown }
  if (!Number.isInteger(body.addCredits) || (body.addCredits as number) < 1 || (body.addCredits as number) > 1_000_000) return NextResponse.json({ error: 'Add-credit amount must be a whole number from 1 to 1,000,000.' }, { status: 400, headers })
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('add_credit_all', { p_amount: body.addCredits })
    if (error) throw error
    return NextResponse.json({ accountsUpdated: data, addedCredits: body.addCredits }, { headers })
  } catch {
    return NextResponse.json({ error: 'Hindi ma-add ang credits. I-apply muna ang Supabase account/credit migration.' }, { status: 503, headers })
  }
}
