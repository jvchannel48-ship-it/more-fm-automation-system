import { NextRequest, NextResponse } from 'next/server'
import { getNowPlaying, runMorSyncTick } from '@/lib/station'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const morSync = await runMorSyncTick()
    const station = await getNowPlaying()
    return NextResponse.json({
      ok: true,
      serverTime: station.serverTime,
      offAir: station.offAir,
      queuedTracks: station.tracks.length,
      morSyncStatus: morSync.syncStatus,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] MOR sync cron failed', error)
    return NextResponse.json({ error: 'MOR sync update failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
