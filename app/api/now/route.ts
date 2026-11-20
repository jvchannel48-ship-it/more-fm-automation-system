import { type NextRequest, NextResponse } from 'next/server'
import { getNowPlaying, recoverFailedTrack } from '@/lib/station'
import { parseStationId } from '@/lib/stations'
import { getSettings } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const station = parseStationId(request.nextUrl.searchParams.get('station'))
    const [data, settings] = await Promise.all([getNowPlaying({ station }), getSettings()])
    return NextResponse.json({ ...data, songRequestsEnabled: settings.songRequestsEnabled }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] now playing failed', error)
    return NextResponse.json({ error: 'Station unavailable' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const station = parseStationId(request.nextUrl.searchParams.get('station'))
    const body = await request.json().catch(() => null) as { uid?: unknown } | null
    const uid = typeof body?.uid === 'string' ? body.uid.slice(0, 200) : ''
    if (!uid) return NextResponse.json({ error: 'Missing track id.' }, { status: 400 })
    return NextResponse.json(await recoverFailedTrack(uid, { station }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[rjfm] failed track recovery', error)
    return NextResponse.json({ error: 'Station recovery failed' }, { status: 500 })
  }
}
