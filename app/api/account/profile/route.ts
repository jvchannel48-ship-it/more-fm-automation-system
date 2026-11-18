import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, client, response } = await requireAccount(request.headers.get('authorization'))
  if (response) return response
  const { data, error: creditError } = await client!.rpc('listener_credit_state', { p_user_id: user!.id }).maybeSingle()
  const credits = data as { daily_credits: number; bonus_credits: number; daily_allowance: number; credits_remaining: number } | null
  const { data: profile, error: profileError } = await client!.from('listener_profiles').select('display_name,avatar_url').eq('user_id', user!.id).maybeSingle()
  if (creditError || profileError || !credits) return NextResponse.json({ error: 'Hindi makuha ang account credits. I-apply muna ang Supabase migration.' }, { status: 503, headers: privateJsonHeaders })
  return NextResponse.json({
    id: user!.id,
    email: user!.email,
    displayName: profile?.display_name ?? user!.user_metadata?.display_name ?? '',
    avatarUrl: profile?.avatar_url ?? null,
    dailyCredits: credits.daily_credits,
    bonusCredits: credits.bonus_credits,
    dailyAllowance: credits.daily_allowance,
    creditsRemaining: credits.credits_remaining,
  }, { headers: privateJsonHeaders })
}

export async function PATCH(request: NextRequest) {
  const { user, client, response } = await requireAccount(request.headers.get('authorization'))
  if (response) return response
  const body = await request.json().catch(() => ({})) as { displayName?: unknown }
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName || displayName.length > 60) return NextResponse.json({ error: 'Name must be 1–60 characters.' }, { status: 400, headers: privateJsonHeaders })
  const { error } = await client!.from('listener_profiles').upsert({ user_id: user!.id, display_name: displayName, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: 'Hindi ma-save ang profile name. I-apply muna ang Supabase migration.' }, { status: 503, headers: privateJsonHeaders })
  await client!.auth.admin.updateUserById(user!.id, { user_metadata: { ...user!.user_metadata, display_name: displayName } })
  return NextResponse.json({ displayName }, { headers: privateJsonHeaders })
}
