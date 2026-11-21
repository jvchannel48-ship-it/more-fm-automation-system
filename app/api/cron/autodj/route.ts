import { timingSafeEqual } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { getNowPlaying } from '@/lib/station'
import { STATIONS, parseStationId } from '@/lib/stations'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function isAuthorized(request: NextRequest) {
  const secret = process.env.AUTODJ_CRON_SECRET
  const authorization = request.headers.get('authorization') ?? ''
  if (!secret || !authorization.startsWith('Bearer ')) return false
  const supplied = Buffer.from(authorization.slice(7))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

/** Authenticated background-worker heartbeat: build/refresh one station's next tracks. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized AutoDJ worker.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const station = parseStationId(request.nextUrl.searchParams.get('station'))
    const result = await getNowPlaying({ station })
    const now = result.serverTime
    const upcoming = result.tracks.filter((track) => track.startAt > now)
    const current = result.tracks.find((track) => track.startAt <= now && track.startAt + track.duration * 1000 > now)
    return NextResponse.json({
      station,
      checkedAt: now,
      autoDjEnabled: !result.offAir,
      offAir: result.offAir,
      currentTrack: current?.title ?? null,
      upcomingTracks: upcoming.filter((track) => track.kind === 'music').length,
      queuedTrackTitles: upcoming.filter((track) => track.kind === 'music').map((track) => track.title).slice(0, 3),
      knownStations: Object.keys(STATIONS),
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    console.error('[rjfm-autodj] worker tick failed', error)
    return NextResponse.json({ error: 'AutoDJ heartbeat failed.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
