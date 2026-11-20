import { type NextRequest, NextResponse } from 'next/server'
import { privateJsonHeaders, requireAccount } from '@/lib/account-api'
import { getProfile, updateDisplayName } from '@/lib/account-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, response } = await requireAccount(request)
  if (response) return response
  try {
    const profile = await getProfile(user!.id)
    if (!profile) return NextResponse.json({ error: 'Account not found.' }, { status: 404, headers: privateJsonHeaders })
    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_data ? `/api/account/avatar?v=${encodeURIComponent(profile.updated_at)}` : null,
      creditsEnabled: profile.credits_enabled,
      ...(profile.credits_enabled ? {
        dailyCredits: profile.daily_credits,
        bonusCredits: profile.bonus_credits,
        dailyAllowance: profile.daily_allowance,
        creditsRemaining: profile.daily_credits + profile.bonus_credits,
        monthlyUsage: profile.monthlyUsage,
        usage: profile.usage.map((item) => ({
          date: item.usage_date,
          creditsUsed: item.credits_used,
          requests: item.requests_count,
        })),
      } : {}),
    }, { headers: privateJsonHeaders })
  } catch (error) {
    console.error('[morefm] profile fetch failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Hindi makuha ang account. I-check ang Render DATABASE_URL at migration.' }, { status: 503, headers: privateJsonHeaders })
  }
}

export async function PATCH(request: NextRequest) {
  const { user, response } = await requireAccount(request)
  if (response) return response
  const body = await request.json().catch(() => ({})) as { displayName?: unknown }
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  if (!displayName || displayName.length > 60) return NextResponse.json({ error: 'Name must be 1–60 characters.' }, { status: 400, headers: privateJsonHeaders })
  try {
    const savedName = await updateDisplayName(user!.id, displayName)
    return NextResponse.json({ displayName: savedName }, { headers: privateJsonHeaders })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Hindi ma-save ang profile name.' }, { status: 503, headers: privateJsonHeaders })
  }
}
