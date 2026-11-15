import 'server-only'
import { YouTube } from 'youtube-sr'
import playlistCatalog from '../data/rj-fm-playlist.json'
import ownPlaylists from '../data/rj-playlists.json'

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

export interface PlaylistFetchOptions {
  refreshNow?: boolean
  waitForRefresh?: boolean
}

const LEGACY_PLAYLIST: PlaylistTrackResult[] = (playlistCatalog as Array<Omit<PlaylistTrackResult, 'durationFormatted'>>).map((track) => ({
  ...track,
  durationFormatted: `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`,
}))
const OWN_PLAYLIST: PlaylistTrackResult[] = ([...ownPlaylists.topSongs, ...ownPlaylists.played] as Array<Omit<PlaylistTrackResult, 'durationFormatted'>>).map((track) => ({
  ...track,
  durationFormatted: `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`,
}))
export const RJ_FM_PLAYLIST_URL = 'rj://original-playlists'
const PLAYLIST_REFRESH_MS = 60_000
const playlistCaches = new Map<string, { tracks: PlaylistTrackResult[]; lastCheckedAt: number; refresh: Promise<void> | null }>()
let lastSearchWarningAt = 0

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
    if (Date.now() - lastSearchWarningAt >= 60_000) {
      lastSearchWarningAt = Date.now()
      const timedOut = error instanceof Error && error.message.includes('timed out')
      console.warn(`[morefm] YouTube search ${timedOut ? 'timed out' : 'is temporarily unavailable'}; using cached or queued music`)
    }
    return []
  }
}

/** Load the station's curated playlist in its original order. */
export async function getRjFmPlaylistTracks(): Promise<PlaylistTrackResult[]> {
  return OWN_PLAYLIST.length > 0 ? OWN_PLAYLIST : LEGACY_PLAYLIST
}

export async function getPlaylistTracks(playlistUrl: string, fallback: PlaylistTrackResult[] = [], options: PlaylistFetchOptions = {}): Promise<PlaylistTrackResult[]> {
  const now = Date.now()
  const cache = playlistCaches.get(playlistUrl) ?? { tracks: fallback, lastCheckedAt: 0, refresh: null }
  if (!playlistCaches.has(playlistUrl)) playlistCaches.set(playlistUrl, cache)
  if (!cache.refresh && (options.refreshNow || now - cache.lastCheckedAt >= PLAYLIST_REFRESH_MS)) {
    cache.lastCheckedAt = now
    cache.refresh = refreshPlaylist(playlistUrl, cache).finally(() => { cache.refresh = null })
  }
  // Static RJ FM has a fallback catalog. A new Sunday playlist has no safe
  // fallback, so wait for its first refresh instead of selecting the wrong
  // playlist during a cold start.
  if ((cache.tracks.length === 0 || options.waitForRefresh) && cache.refresh) await cache.refresh
  return cache.tracks
}

async function refreshPlaylist(playlistUrl: string, cache: { tracks: PlaylistTrackResult[] }) {
  try {
    const playlist = await Promise.race([
      YouTube.getPlaylist(playlistUrl, {
        // Fetch the full current playlist so additions after the first 100 songs
        // are also available to AutoDJ after the next background refresh.
      limit: 500,
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
      cache.tracks = tracks
      console.info(`[morefm] playlist refreshed: ${tracks.length} tracks from ${playlistUrl}`)
    }
  } catch (error) {
    console.warn(`[morefm] playlist refresh failed; using cached catalog for ${playlistUrl}`, error)
  }
}
