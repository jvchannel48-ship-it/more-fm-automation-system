import { NextResponse } from 'next/server'
import { getNowPlaying, recoverFailedTrack } from '@/lib/station'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  try {
    const data = await getNowPlaying()
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] now playing failed', error)
    return NextResponse.json({ error: 'Station unavailable' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { uid?: unknown } | null
    const uid = typeof body?.uid === 'string' ? body.uid.slice(0, 200) : ''
    if (!uid) return NextResponse.json({ error: 'Missing track id.' }, { status: 400 })
    return NextResponse.json(await recoverFailedTrack(uid), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] failed track recovery', error)
    return NextResponse.json({ error: 'Station recovery failed' }, { status: 500 })
  }
}
