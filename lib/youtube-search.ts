import 'server-only'
import { YouTube } from 'youtube-sr'
import playlistCatalog from '../data/rj-fm-playlist.json'
import ownPlaylists from '../data/rj-playlists.json'
import { getRadioCatalogSongs } from './radio-catalog'

export interface YouTubeSearchResult {
  id: string
  title: string
  url: string
  duration: string
  channel?: string
  author?: string
  uploader?: string
  source: 'YouTube' | 'MP3Juice'
  live?: boolean
}

export interface PlaylistTrackResult {
  id: string
  title: string
  url: string
  duration: number
  durationFormatted: string
  channel?: string
  artist?: string
  category?: string
  picture?: string | null
  playlistGroup?: 'RJ TOP SONGS' | 'RJ PLAYED'
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
const OWN_PLAYLIST: PlaylistTrackResult[] = [
  ...ownPlaylists.topSongs.map((track) => ({ ...track, playlistGroup: 'RJ TOP SONGS' as const })),
  ...ownPlaylists.played.map((track) => ({ ...track, playlistGroup: 'RJ PLAYED' as const })),
].map((track) => ({
  ...track,
  durationFormatted: `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}`,
}))
export const RJ_FM_PLAYLIST_URL = 'rj://original-playlists'
const PLAYLIST_REFRESH_MS = 60_000
const PLAYLIST_FETCH_TIMEOUT_MS = 120_000
const MP3JUICE_SEARCH_API = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const playlistCaches = new Map<string, { tracks: PlaylistTrackResult[]; lastCheckedAt: number; refresh: Promise<void> | null }>()
const RJ_DISCOVERY_REFRESH_MS = 5 * 60_000
const RJ_DISCOVERY_QUERIES = [
  '1960s English Tagalog love songs official audio',
  '1970s English Tagalog love songs official audio',
  '1980s English Tagalog love songs official audio',
  '1990s English Tagalog love songs official audio',
  '2000s English Tagalog love songs official audio',
  '2020s English Tagalog love songs official audio',
]
let rjCatalogCache: PlaylistTrackResult[] = OWN_PLAYLIST
let rjCatalogLastRefresh = 0
let rjCatalogRefresh: Promise<void> | null = null
let lastSearchWarningAt = 0

export async function searchYouTube(query: string, limit = 12): Promise<YouTubeSearchResult[]> {
  try {
    const response = await fetch(`${MP3JUICE_SEARCH_API}?search=${encodeURIComponent(query)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'User-Agent': 'RJFM-AutoDJ/1.0' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`MP3Juice search returned ${response.status}`)
    const payload = await response.json() as { items?: Array<{ id?: unknown; title?: unknown; url?: unknown; duration?: unknown }> }
    const items = (payload.items ?? []).flatMap((item) => {
      const id = typeof item.id === 'string' ? item.id : ''
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const url = typeof item.url === 'string' ? item.url : ''
      const duration = typeof item.duration === 'string' ? item.duration : ''
      if (!id || !title || !url || !duration) return []
      const parts = title.split(/\s+[-–—|:]\s+/, 2).map((part) => part.trim())
      const artist = parts.length === 2 ? parts[0] : undefined
      return [{ id, title, url, duration, channel: artist, author: artist, uploader: artist, source: 'MP3Juice' as const, live: false }]
    })
    if (items.length > 0) return items.slice(0, Math.max(1, limit))
  } catch (error) {
    console.warn('[morefm] MP3Juice search unavailable; falling back to YouTube search', error)
  }

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
    if (Date.now() - lastSearchWarningAt >= 60_000) {
      lastSearchWarningAt = Date.now()
      const timedOut = error instanceof Error && error.message.includes('timed out')
      console.warn(`[morefm] YouTube search ${timedOut ? 'timed out' : 'is temporarily unavailable'}; using cached or queued music`)
    }
    return []
  }
}

function parseDuration(value: string) {
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function artistFromSearchResult(item: YouTubeSearchResult) {
  const parts = item.title.split(/\s+[-–—|:]\s+/, 2).map((part) => part.trim())
  return parts.length === 2 ? parts[0] : item.channel ?? item.author ?? 'RJ FM'
}

async function refreshRjCatalog() {
  const results = await Promise.all(RJ_DISCOVERY_QUERIES.map((query) => searchYouTube(query, 12)))
  const seen = new Set(OWN_PLAYLIST.map((track) => track.id))
  const discovered: PlaylistTrackResult[] = []
  for (const items of results) {
    for (const item of items) {
      const duration = parseDuration(item.duration)
      if (!item.id || !item.url || !item.title || item.live || duration < 90 || duration > 540 || seen.has(item.id)) continue
      seen.add(item.id)
      discovered.push({
        id: item.id,
        title: item.title,
        url: item.url,
        duration,
        durationFormatted: item.duration,
        channel: item.channel,
        artist: artistFromSearchResult(item),
        playlistGroup: discovered.length % 2 === 0 ? 'RJ TOP SONGS' : 'RJ PLAYED',
        live: false,
      })
    }
  }
  if (discovered.length > 0) {
    rjCatalogCache = [...OWN_PLAYLIST, ...discovered]
    console.info(`[morefm] RJ keyless catalog refreshed: ${rjCatalogCache.length} unique tracks`)
  }
}

/** Own RJ catalog plus public keyless YouTube discovery; no YouTube API key is used. */
export async function getRjFmPlaylistTracks(options: { refreshNow?: boolean } = {}): Promise<PlaylistTrackResult[]> {
  const shouldRefresh = options.refreshNow || rjCatalogLastRefresh === 0 || Date.now() - rjCatalogLastRefresh >= RJ_DISCOVERY_REFRESH_MS
  if (shouldRefresh && !rjCatalogRefresh) {
    rjCatalogLastRefresh = Date.now()
    rjCatalogRefresh = refreshRjCatalog().finally(() => { rjCatalogRefresh = null })
  }
  if (options.refreshNow || rjCatalogCache === OWN_PLAYLIST) await rjCatalogRefresh
  return rjCatalogCache
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
    const playlistPromise = YouTube.getPlaylist(playlistUrl, {
      // fetchAll follows continuation pages until YouTube has no more tracks.
      // Omitting limit avoids imposing a total playlist-size ceiling.
      fetchAll: true,
      requestOptions: {
        signal: AbortSignal.timeout(PLAYLIST_FETCH_TIMEOUT_MS),
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; RJFM-AutoDJ/1.0)',
        },
      },
    })
    let timeout: ReturnType<typeof setTimeout> | undefined
    const playlist = await Promise.race([
      playlistPromise,
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), PLAYLIST_FETCH_TIMEOUT_MS)
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout)
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
    if (tracks.length > 0) {
      cache.tracks = tracks
      console.info(`[morefm] playlist refreshed: ${tracks.length} tracks from ${playlistUrl}`)
    }
  } catch (error) {
    console.warn(`[morefm] playlist refresh failed; using cached catalog for ${playlistUrl}`, error)
  }
}
