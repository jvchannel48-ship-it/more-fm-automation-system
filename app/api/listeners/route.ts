import { NextRequest, NextResponse } from 'next/server'
import { updateListener } from '@/lib/listeners'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { id?: unknown; active?: unknown }
  if (typeof body.id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.id) || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Invalid listener heartbeat' }, { status: 400 })
  }
  const listenersNow = await updateListener(body.id, body.active)
  return NextResponse.json({ listenersNow }, { headers: { 'Cache-Control': 'no-store' } })
}
