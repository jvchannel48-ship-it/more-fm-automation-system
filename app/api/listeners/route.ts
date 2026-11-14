import { NextRequest, NextResponse } from 'next/server'
import { updateListener } from '@/lib/listeners'
import { getSettings } from '@/lib/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown; active?: unknown }
    if (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.id) || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid listener heartbeat' }, { status: 400 })
    }
    const settings = await getSettings()
    const result = await updateListener(body.id, body.active, settings.listenerLimit)
    return NextResponse.json({
      accepted: result.accepted,
      listenersNow: result.listenersNow,
      listenerLimit: settings.listenerLimit,
      message: result.accepted ? undefined : 'THIS STATION IS LIMITED LISTENER. Please try again later.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] listener heartbeat failed', error)
    return NextResponse.json({ error: 'Could not check station listener capacity.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
