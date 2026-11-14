import 'server-only'
import { YouTube } from 'youtube-sr'
import playlistCatalog from '../data/rj-fm-playlist.json'

export interface YouTubeSearchResult {
  id: string
  title: string
  url: string
  duration: string
  channel?: string
  author?: string
  uploader?: string
  source: 'YouTube'
  live?: boolean
}

export interface PlaylistTrackResult {
  id: string
  title: string
  url: string
  duration: number
  durationFormatted: string
  channel?: string
  live?: boolean
}

const STATIC_PLAYLIST: PlaylistTrackResult[] = (playlistCatalog as Array<Omit<PlaylistTrackResult, 'durationFormatted'>>).map((track) => ({
  ...track,
  durationFormatted: `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`,
}))
const RJ_FM_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLd469-e1TkbM'
const PLAYLIST_REFRESH_MS = 60_000
let playlistCache = STATIC_PLAYLIST
let playlistLastCheckedAt = 0
let playlistRefresh: Promise<void> | null = null

export async function searchYouTube(query: string, limit = 12): Promise<YouTubeSearchResult[]> {
  try {
    const videos = await Promise.race([
      YouTube.search(query, { limit, type: 'video', safeSearch: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('YouTube search timed out')), 4_000)),
    ])
    return videos.flatMap((video) => {
      if (!video.id || !video.url || !video.title || !video.durationFormatted) return []
      return [{
        id: video.id,
        title: video.title,
        url: video.url,
        duration: video.durationFormatted ?? '',
        channel: video.channel?.name,
        author: video.channel?.name,
        uploader: video.channel?.name,
        source: 'YouTube' as const,
        live: video.live,
      }]
    })
  } catch (error) {
    console.error('[morefm] YouTube search failed', error)
    return []
  }
}

/** Load the station's curated playlist in its original order. */
export async function getRjFmPlaylistTracks(): Promise<PlaylistTrackResult[]> {
  const now = Date.now()
  if (!playlistRefresh && now - playlistLastCheckedAt >= PLAYLIST_REFRESH_MS) {
    playlistLastCheckedAt = now
    playlistRefresh = refreshRjFmPlaylist().finally(() => { playlistRefresh = null })
  }
  // Never make /api/now wait for YouTube. The previous catalog keeps playback
  // alive while the refresh runs, and the next queue fill sees new tracks.
  return playlistCache
}

async function refreshRjFmPlaylist() {
  try {
    const playlist = await Promise.race([
      YouTube.getPlaylist(RJ_FM_PLAYLIST_URL, {
        limit: 100,
        fetchAll: true,
        requestOptions: {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            'User-Agent': 'Mozilla/5.0 (compatible; RJFM-AutoDJ/1.0)',
          },
        },
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000)),
    ])
    const tracks = (playlist?.videos ?? []).flatMap((video) => {
      if (!video.id || !video.title || !video.url || !video.duration || video.duration < 60) return []
      return [{
        id: video.id,
        title: video.title,
        url: video.url,
        duration: video.duration,
        durationFormatted: video.durationFormatted,
        channel: video.channel?.name,
        live: video.live,
      }]
    })
    if (tracks.length > 0) {
      playlistCache = tracks
      console.info(`[morefm] playlist refreshed: ${tracks.length} tracks`)
    }
  } catch (error) {
    console.warn('[morefm] playlist refresh failed; using cached catalog', error)
  }
}
