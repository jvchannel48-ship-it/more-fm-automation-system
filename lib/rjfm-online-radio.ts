import 'server-only'

export const RJFM_STREAM_URL = 'https://stream.zeno.fm/as29d8g0g4duv'
export const RJFM_SOURCE_URL = 'https://onlineradio.ph/40-rjfm-100-3.html'
export const RJFM_PLAYLIST_URL = 'https://onlineradio.ph/playlist/40-rjfm-100-3.html'

export interface RjfmTrack {
  title: string
  artist: string
  playedAt?: string
}

export interface RjfmSnapshot {
  station: '100.3 RJFM'
  location: 'Makati, Metro Manila'
  streamUrl: string
  sourceUrl: string
  playlistUrl: string
  lastPlayed: RjfmTrack[]
  topSongs: RjfmTrack[]
  fetchedAt: number
}

const TRACK_RE = /<div class="track (?:playlist-row|top-row)">([\s\S]*?)<\/div>\s*(?=<div class="track|<\/div>\s*<\/div>)/g
const TITLE_RE = /<span class="ttitle trunc">([\s\S]*?)<\/span>/
const ARTIST_RE = /<span class="tsub trunc">([\s\S]*?)<\/span>/
const TIME_RE = /<span class="tplayed mono"[^>]*>([^<]+)<\/span>/

function decodeHtml(value: string) {
  return value
    .replace(/&#039;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTracks(html: string, rowClass: 'playlist-row' | 'top-row') {
  const rows = html.match(new RegExp(`<div class="track ${rowClass}">[\\s\\S]*?<\\/div>\\s*(?=<div class="track|<\\/div>\\s*<\\/div>)`, 'g')) ?? []
  return rows.flatMap((row) => {
    const title = row.match(TITLE_RE)?.[1]
    const artist = row.match(ARTIST_RE)?.[1]
    if (!title || !artist) return []
    const playedAt = row.match(TIME_RE)?.[1]
    return [{ title: decodeHtml(title), artist: decodeHtml(artist), ...(playedAt ? { playedAt: decodeHtml(playedAt) } : {}) }]
  })
}

export async function getRjfmSnapshot(): Promise<RjfmSnapshot> {
  const response = await fetch(RJFM_SOURCE_URL, {
    cache: 'no-store',
    headers: { 'User-Agent': 'MoreFM-RJFM-Metadata/1.0' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`RJFM metadata request failed: ${response.status}`)
  const html = await response.text()
  return {
    station: '100.3 RJFM',
    location: 'Makati, Metro Manila',
    streamUrl: RJFM_STREAM_URL,
    sourceUrl: RJFM_SOURCE_URL,
    playlistUrl: RJFM_PLAYLIST_URL,
    lastPlayed: parseTracks(html, 'playlist-row').slice(0, 8),
    topSongs: parseTracks(html, 'top-row').slice(0, 10),
    fetchedAt: Date.now(),
  }
}
