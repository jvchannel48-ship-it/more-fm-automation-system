import { NextResponse } from 'next/server'
import { getNowPlaying, submitSongRequest } from '@/lib/station'
import { DAILY_PLAYLIST_URL, DITO_PLAYLIST_URL, getPlaylistTracks, searchYouTube, WEEKEND_PLAYLIST_URL, type YouTubeSearchResult } from '@/lib/youtube-search'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function artistFromResult(item: YouTubeSearchResult) {
  const parts = item.title.split(/\s+[-–—|:]\s+/, 2).map((part) => part.trim())
  return parts.length === 2 ? parts[0] : item.channel ?? item.author ?? 'YouTube artist'
}

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? ''
    if (query) {
      const results = (await searchYouTube(`${query} official audio`, 12))
        .filter((item) => !item.live)
        .map((item) => ({ id: item.id, title: item.title, artist: artistFromResult(item), url: item.url, duration: item.duration, channel: item.channel }))
      return NextResponse.json({ query, results }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const [dito, weekend, daily, now] = await Promise.all([
      getPlaylistTracks(DITO_PLAYLIST_URL),
      getPlaylistTracks(WEEKEND_PLAYLIST_URL),
      getPlaylistTracks(DAILY_PLAYLIST_URL),
      getNowPlaying(),
    ])
    const nowMs = now.serverTime
    const queue = now.tracks
      .filter((track) => track.startAt + track.duration * 1000 > nowMs)
      .sort((a, b) => a.startAt - b.startAt)
      .slice(0, 12)
      .map((track) => ({ uid: track.uid, title: track.title ?? 'Untitled track', artist: track.artist ?? track.sourceChannel ?? 'RJ FM', startAt: track.startAt, active: track.startAt <= nowMs }))
    return NextResponse.json({
      name: 'YouTube Playlists',
      sections: [
        { id: 'dito', label: 'DITO — Updated Playlist', tracks: dito },
        { id: 'weekend', label: 'Saturday–Sunday Playlist', tracks: weekend },
        { id: 'daily', label: 'Daily Playlist', tracks: daily },
      ],
      queue,
      fetchedAt: Date.now(),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] playlist read failed', error)
    return NextResponse.json({ error: 'Playlist is temporarily unavailable.' }, { status: 502 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { name?: unknown; title?: unknown; artist?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : 'Listener'
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
    const artist = typeof body?.artist === 'string' ? body.artist.trim().slice(0, 120) : ''
    if (!title || !artist) return NextResponse.json({ error: 'Choose a song and artist first.' }, { status: 400 })
    const result = await submitSongRequest(title, artist, name || 'Listener')
    const reason = result.reason?.replace(/AutoDJ/gi, 'station queue')
    return NextResponse.json({ ...result, reason }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] playlist add failed', error)
    return NextResponse.json({ error: 'The song could not be added to the playlist.' }, { status: 500 })
  }
}
