import { type NextRequest, NextResponse } from 'next/server'
import { recordListener } from '@/lib/storage'

export const dynamic = 'force-dynamic'

const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } }

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; active?: unknown }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id) || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid listener heartbeat.' }, { status: 400, ...noStore })
  }

  try {
    return NextResponse.json(await recordListener(id, body.active), noStore)
  } catch (error) {
    console.error('[morefm] listener heartbeat failed', error)
    return NextResponse.json({ error: 'Could not update listener count.' }, { status: 503, ...noStore })
  }
}
