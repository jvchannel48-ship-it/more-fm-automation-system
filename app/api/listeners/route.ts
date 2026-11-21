import { type NextRequest, NextResponse } from 'next/server'
import { recordListener, recordStationListener } from '@/lib/storage'
import { parseStationId, STATIONS } from '@/lib/stations'
import { getAccountFromToken, USER_SESSION_COOKIE } from '@/lib/account-store'
import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; active?: unknown; station?: unknown }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id) || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid listener heartbeat.' }, { status: 400, ...noStore })
  }

  try {
    const result = await recordListener(id, body.active)
    const station = parseStationId(body.station)
    const stationResult = await recordStationListener(id, station, body.active)
    // The anonymous listener count remains available, while an authenticated
    // phone session also gets a short-lived active-listening marker for admins.
    const token = request.cookies.get(USER_SESSION_COOKIE)?.value
    const account = await getAccountFromToken(token).catch(() => null)
    if (account) {
      await getDb().query('UPDATE morefm_listener_accounts SET last_active_at = $2, updated_at = now() WHERE id = $1', [account.id, body.active ? new Date() : null])
    }
    return NextResponse.json({ ...result, stationListenersNow: stationResult.stationListenersNow }, noStore)
  } catch (error) {
    console.error('[morefm] listener heartbeat failed', error)
    return NextResponse.json({ error: 'Could not update listener count.' }, { status: 503, ...noStore })
  }
}
