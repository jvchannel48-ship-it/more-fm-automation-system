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
  // Keep playlist resolution out of the request path. Render/Node instances
  // should not scrape YouTube while /api/now is trying to start playback.
  return STATIC_PLAYLIST
}
