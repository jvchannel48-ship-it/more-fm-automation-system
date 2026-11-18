import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { addCreditsToAll, getAdminCreditData, setDailyAllowance } from '@/lib/account-store'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store, max-age=0' }

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  try {
    return NextResponse.json(await getAdminCreditData(), { headers })
  } catch (error) {
    // Soft-fail: do not surface DATABASE_URL/migration errors in the admin panel.
    console.error('[morefm] admin credit read failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ dailyAllowance: 0, profiles: [] }, { headers })
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  const body = await request.json().catch(() => ({})) as { dailyAllowance?: unknown }
  if (!Number.isInteger(body.dailyAllowance) || (body.dailyAllowance as number) < 0 || (body.dailyAllowance as number) > 1_000_000) {
    return NextResponse.json({ error: 'Daily credits must be a whole number from 0 to 1,000,000.' }, { status: 400, headers })
  }
  try {
    return NextResponse.json({ dailyAllowance: await setDailyAllowance(body.dailyAllowance as number) }, { headers })
  } catch (error) {
    console.error('[morefm] daily allowance update failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Hindi ma-save ngayon. Subukan ulit.' }, { status: 503, headers })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  const body = await request.json().catch(() => ({})) as { addCredits?: unknown }
  if (!Number.isInteger(body.addCredits) || (body.addCredits as number) < 1 || (body.addCredits as number) > 1_000_000) {
    return NextResponse.json({ error: 'Add-credit amount must be a whole number from 1 to 1,000,000.' }, { status: 400, headers })
  }
  try {
    return NextResponse.json({ accountsUpdated: await addCreditsToAll(body.addCredits as number), addedCredits: body.addCredits }, { headers })
  } catch (error) {
    console.error('[morefm] add-credit-all failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Hindi ma-send ngayon. Subukan ulit.' }, { status: 503, headers })
  }
}
