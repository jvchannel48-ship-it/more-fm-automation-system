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

export async function searchYouTube(query: string, limit = 12): Promise<YouTubeSearchResult[]> {
  try {
    const videos = await Promise.race([
      YouTube.search(query, { limit, type: 'video', safeSearch: true }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('YouTube search timed out')), 10_000)),
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
