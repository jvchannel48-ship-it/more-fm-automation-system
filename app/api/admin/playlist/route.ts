import { type NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { clearRadioCatalogSongs, deactivateRadioCatalogSong, getRadioCatalogSongs, upsertRadioCatalogSong, type RadioCatalogSong } from '@/lib/radio-catalog'
import { searchYouTube } from '@/lib/youtube-search'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const jsonError = (error: string, status = 500) => NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })

function durationSeconds(value: string) {
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return 0
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0
}

function artistFromTitle(title: string, channel?: string) {
  const parts = title.split(/\s+[-–—|:]\s+/, 2).map((part) => part.trim())
  return parts.length === 2 ? parts[0] : channel ?? 'YouTube artist'
}

function rankSearchResults(results: Array<{ id: string; title: string; artist: string; duration: string; durationSeconds: number; channel?: string; picture: string }>, query: string) {
  const q = query.toLowerCase()
  const parts = q.split(/\s+/).filter(Boolean)
  return [...results].sort((a, b) => {
    const score = (item: typeof a) => {
      let value = 0
      const title = item.title.toLowerCase()
      const artist = item.artist.toLowerCase()
      if (title.includes(q) || q.includes(title)) value += 4
      for (const part of parts) {
        if (title.includes(part)) value += 2
        if (artist.includes(part)) value += 1
      }
      if (item.durationSeconds >= 150 && item.durationSeconds <= 360) value += 2
      return value
    }
    return score(b) - score(a)
  })
}

export async function GET(request: Request) {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 120) ?? ''
    if (query) {
      const results = rankSearchResults(
        (await searchYouTube(`${query} official audio`, 12))
          .filter((item) => !item.live)
          .map((item) => ({
            id: item.id,
            title: item.title,
            artist: artistFromTitle(item.title, item.channel ?? item.author),
            url: item.url,
            duration: item.duration,
            durationSeconds: durationSeconds(item.duration),
            channel: item.channel,
            picture: `https://i.ytimg.com/vi/${encodeURIComponent(item.id)}/hqdefault.jpg`,
          }))
          .filter((item) => item.durationSeconds >= 60 && item.durationSeconds <= 540),
        query,
      )
      return NextResponse.json({ query, results }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const songs = (await getRadioCatalogSongs()) ?? []
    return NextResponse.json({ songs }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] admin playlist read failed', error)
    return jsonError(error instanceof Error ? error.message : 'Could not load the songs playlist.')
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const body = await request.json().catch(() => ({})) as Partial<{
      title: string
      artist: string
      youtubeId: string
      durationSeconds: number
      playlistGroup: RadioCatalogSong['playlist_group']
      category: string
      picture: string
    }>
    const youtubeId = typeof body.youtubeId === 'string' ? body.youtubeId.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const artist = typeof body.artist === 'string' ? body.artist.trim() : ''
    const duration = Number(body.durationSeconds)
    const playlistGroup = body.playlistGroup
    if (!/^[\w-]{6,32}$/.test(youtubeId) || !title || !artist || !Number.isFinite(duration) || !['RJ TOP SONGS', 'RJ PLAYED'].includes(String(playlistGroup))) {
      return jsonError('Choose a valid YouTube song and playlist group.', 400)
    }
    const song = await upsertRadioCatalogSong({ title, artist, youtubeId, durationSeconds: duration, playlistGroup: playlistGroup as RadioCatalogSong['playlist_group'], category: typeof body.category === 'string' ? body.category : 'english', picture: typeof body.picture === 'string' ? body.picture : null })
    return NextResponse.json({ song }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] admin playlist add failed', error)
    return jsonError(error instanceof Error ? error.message : 'Could not save the song.')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdmin())) return jsonError('Unauthorized', 401)
    const body = await request.json().catch(() => ({})) as { youtubeId?: unknown; clearAll?: unknown }
    if (body.clearAll === true) {
      await clearRadioCatalogSongs()
      return NextResponse.json({ removed: true, cleared: 'saved song catalog and top-played history' }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const youtubeId = typeof body.youtubeId === 'string' ? body.youtubeId.trim() : ''
    if (!/^[\w-]{6,32}$/.test(youtubeId)) return jsonError('Invalid YouTube song.', 400)
    const removed = await deactivateRadioCatalogSong(youtubeId)
    if (!removed) return jsonError('Song not found in the playlist.', 404)
    return NextResponse.json({ removed: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[morefm] admin playlist remove failed', error)
    return jsonError(error instanceof Error ? error.message : 'Could not remove the song.')
  }
}
