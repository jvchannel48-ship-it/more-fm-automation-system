import 'server-only'
import { YouTube } from 'youtube-sr'

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

const RJ_FM_PLAYLIST_URL = 'https://www.youtube.com/playlist?list=PLd469-e1TkbM'
const PLAYLIST_CACHE_TTL_MS = 10 * 60 * 1000
let playlistCache: { expiresAt: number; tracks: PlaylistTrackResult[] } | null = null

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
  if (playlistCache && playlistCache.expiresAt > Date.now()) return playlistCache.tracks
  try {
    const playlist = await YouTube.getPlaylist(RJ_FM_PLAYLIST_URL, {
      limit: 100,
      fetchAll: true,
      requestOptions: {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; RJFM-AutoDJ/1.0)',
        },
      },
    })
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
    if (tracks.length > 0) playlistCache = { expiresAt: Date.now() + PLAYLIST_CACHE_TTL_MS, tracks }
    return tracks
  } catch (error) {
    console.error('[morefm] playlist fetch failed', error)
    return []
  }
}
