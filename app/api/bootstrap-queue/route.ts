import { NextResponse } from 'next/server'
import { getSettings, readJson, writeJson, STATE_PATH, acquireStationLease, releaseStationLease, QUEUE_LOCK_PATH } from '@/lib/storage'
import { searchYouTube } from '@/lib/youtube-search'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'

const EMERGENCY = [
  ['Rey Valera', 'Kung Kailangan Mo Ako'],
  ['Basil Valdez', 'Ngayon at Kailanman'],
  ['Martin Nievera', 'Kahit Isang Saglit'],
  ['Side A', 'Forevermore'],
  ['Air Supply', 'All Out of Love'],
  ['Gary Valenciano', 'Sana Maulit Muli'],
  ['Regine Velasquez', 'Pangako'],
  ['Jose Mari Chan', 'Please Be Careful With My Heart'],
] as const

function playableSource(url: string) {
  return url.startsWith('/api/audio?') ? url : `/api/audio?url=${encodeURIComponent(url)}`
}

function parseDuration(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 210
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

async function resolveEmergencySong(songCount: number) {
  for (let offset = 0; offset < EMERGENCY.length; offset++) {
    const [artist, title] = EMERGENCY[(songCount + offset) % EMERGENCY.length]
    const items = await searchYouTube(`${artist} ${title}`, 8)
    const ranked = items.filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      if (seconds < 90 || seconds > 540) return false
      if (item.live) return false
      if (/\b(?:karaoke|lyric\s+video|live\s+at|concert|remix|nightcore)\b/i.test(item.title)) return false
      return true
    })
    const pool = ranked.length > 0 ? ranked : items.filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      return seconds >= 90 && seconds <= 540 && !item.live
    })
    for (const item of pool.slice(0, 4)) {
      try {
        const response = await fetch(
          `${API_BASE}?download=${encodeURIComponent(item.url)}&type=mp3`,
          { cache: 'no-store', signal: AbortSignal.timeout(12_000) },
        )
        if (!response.ok) continue
        const payload = await response.json() as { downloadUrl?: string }
        if (!payload.downloadUrl) continue
        return {
          id: item.id,
          artist,
          title: title,
          src: playableSource(payload.downloadUrl),
          sourceUrl: item.url,
          sourceChannel: item.channel,
          duration: parseDuration(item.duration),
        }
      } catch {
        continue
      }
    }
  }
  return null
}

type StateShape = {
  tracks?: Array<Record<string, unknown>>
  songCount?: number
  history?: Array<Record<string, unknown>>
  fillingUntil?: number
  [key: string]: unknown
}

export async function POST() {
  const lease = await acquireStationLease(QUEUE_LOCK_PATH, 90_000)
  if (!lease) {
    return NextResponse.json({ ok: false, reason: 'Station busy' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const settings = await getSettings()
    if (!settings.broadcastEnabled) {
      return NextResponse.json({ ok: false, reason: 'Broadcast is off' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    const now = Date.now()
    const state = await readJson<StateShape>(STATE_PATH, { tracks: [], songCount: 0, history: [] })
    const tracks = Array.isArray(state.tracks) ? state.tracks : []
    const hasActive = tracks.some((track) => {
      const startAt = typeof track.startAt === 'number' ? track.startAt : 0
      const duration = typeof track.duration === 'number' ? track.duration : 0
      return startAt <= now && startAt + duration * 1000 > now
    })
    if (hasActive) {
      return NextResponse.json({ ok: true, reason: 'Already on air', tracks: tracks.length }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const songCount = typeof state.songCount === 'number' ? state.songCount : 0
    const song = await resolveEmergencySong(songCount)
    if (!song) {
      return NextResponse.json({ ok: false, reason: 'No emergency song resolved' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }

    const startAt = now
    const track = {
      uid: `emergency-${song.id}-${startAt}`,
      src: song.src,
      youtubeId: song.id,
      startAt,
      duration: song.duration,
      fadeIn: 0,
      fadeOut: settings.crossfaderEnabled ? settings.crossfadeSeconds : 0,
      sourceUrl: song.sourceUrl,
      sourceChannel: song.sourceChannel,
      sourceRefreshedAt: Date.now(),
      kind: 'music',
      title: song.title,
      artist: song.artist,
    }
    const history = Array.isArray(state.history) ? state.history : []
    const nextState: StateShape = {
      ...state,
      tracks: [...tracks.filter((t) => typeof t.startAt === 'number' && (t.startAt as number) > now - 30_000), track],
      songCount: songCount + 1,
      history: [...history, { id: song.id, key: song.title.toLowerCase(), artist: song.artist, title: song.title, t: startAt }].slice(-50),
      fillingUntil: 0,
    }
    await writeJson(STATE_PATH, nextState)
    return NextResponse.json(
      { ok: true, track: { title: song.title, artist: song.artist, duration: song.duration } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[morefm] bootstrap-queue failed', error)
    return NextResponse.json({ ok: false, reason: 'Bootstrap failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  } finally {
    await releaseStationLease(lease)
  }
}

export async function GET() {
  return POST()
}
