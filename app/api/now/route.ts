import { NextResponse } from 'next/server'
import { getNowPlaying, recoverFailedTrack } from '@/lib/station'
import { resolveContinuousSong } from '@/lib/continuous-fill'
import {
  acquireStationLease,
  releaseStationLease,
  readJson,
  writeJson,
  getSettings,
  STATE_PATH,
  QUEUE_LOCK_PATH,
} from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type StateShape = {
  tracks?: Array<Record<string, unknown>>
  songCount?: number
  history?: Array<Record<string, unknown>>
  fillingUntil?: number
  [key: string]: unknown
}

/**
 * Online-radio style safety net: if the queue is empty while on air,
 * inject a continuous YouTube track (no API key, rock/dance/disco filtered).
 */
async function ensureContinuousTrack() {
  const settings = await getSettings()
  if (!settings.broadcastEnabled) return

  const lease = await acquireStationLease(QUEUE_LOCK_PATH, 60_000)
  if (!lease) return
  try {
    const now = Date.now()
    const state = await readJson<StateShape>(STATE_PATH, { tracks: [], songCount: 0, history: [] })
    const tracks = Array.isArray(state.tracks) ? state.tracks : []
    const hasActive = tracks.some((track) => {
      const startAt = typeof track.startAt === 'number' ? track.startAt : 0
      const duration = typeof track.duration === 'number' ? track.duration : 0
      return startAt <= now && startAt + duration * 1000 > now
    })
    const hasUpcoming = tracks.some((track) => typeof track.startAt === 'number' && (track.startAt as number) > now)
    if (hasActive || hasUpcoming) return

    const songCount = typeof state.songCount === 'number' ? state.songCount : 0
    const song = await resolveContinuousSong(songCount)
    if (!song) return

    const startAt = now
    const track = {
      uid: `live-${song.id}-${startAt}`,
      src: song.src,
      youtubeId: song.id,
      startAt,
      duration: song.duration,
      fadeIn: 0,
      fadeOut: settings.crossfaderEnabled ? settings.crossfadeSeconds : 0,
      sourceUrl: song.sourceUrl,
      sourceChannel: song.sourceChannel,
      sourceRefreshedAt: song.sourceRefreshedAt,
      kind: 'music',
      title: song.title,
      artist: song.artist,
    }
    const history = Array.isArray(state.history) ? state.history : []
    await writeJson(STATE_PATH, {
      ...state,
      tracks: [track],
      songCount: songCount + 1,
      history: [...history, { id: song.id, key: song.key, artist: song.artist, title: song.title, t: startAt }].slice(-50),
      fillingUntil: 0,
    })
  } finally {
    await releaseStationLease(lease)
  }
}

export async function GET() {
  try {
    // Keep music flowing like an online radio station in PH.
    await ensureContinuousTrack().catch((error) => {
      console.error('[morefm] continuous fill failed', error)
    })
    const data = await getNowPlaying()
    // If still empty (race), try once more after getNowPlaying's own fill.
    if (!data.offAir && (!data.tracks || data.tracks.length === 0)) {
      await ensureContinuousTrack().catch(() => undefined)
      return NextResponse.json(await getNowPlaying(), { headers: { 'Cache-Control': 'no-store' } })
    }
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
