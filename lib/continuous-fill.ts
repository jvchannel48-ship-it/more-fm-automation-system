import 'server-only'
import { searchYouTube, type YouTubeSearchResult } from './youtube-search'
import { isChristmasTitle } from './schedule'
import { repeatTitleKey } from './song-repeat'

const API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'

const ROCK_RULE = /rock|metal|punk|grunge|emo\b|screamo|hardcore|headbang/i
const HIGH_ENERGY_DANCE_RULE = /\b(?:edm|techno|trance|dubstep|rave|club mix|dance remix|dance mix|dance version|house music|eurodance|electro dance|hands up)\b/i
const DISCO_BLOCK_RULE = /\b(?:disco|disco\s+mix|disco\s+version)\b/i

export const CONTINUOUS_CATALOG = [
  ['The Beatles', 'Let It Be'],
  ['The Carpenters', 'Top of the World'],
  ['Bread', 'Make It With You'],
  ['Bee Gees', 'How Deep Is Your Love'],
  ['Rey Valera', 'Kung Kailangan Mo Ako'],
  ['Freddie Aguilar', 'Anak'],
  ['Basil Valdez', 'Ngayon at Kailanman'],
  ['Air Supply', 'All Out of Love'],
  ['Lionel Richie', 'Hello'],
  ['Whitney Houston', 'Greatest Love of All'],
  ['Phil Collins', 'Against All Odds'],
  ['Side A', 'Forevermore'],
  ['Martin Nievera', 'Kahit Isang Saglit'],
  ['Gary Valenciano', 'Sana Maulit Muli'],
  ['Regine Velasquez', 'Pangako'],
  ['Boyz II Men', 'End of the Road'],
  ['Celine Dion', 'My Heart Will Go On'],
  ['Mariah Carey', 'Hero'],
  ['Backstreet Boys', 'I Want It That Way'],
  ['Eraserheads', 'Ang Huling El Bimbo'],
  ['MYMP', 'Especially for You'],
  ['South Border', 'Rainbow'],
  ['Westlife', 'My Love'],
  ['Jose Mari Chan', 'Please Be Careful With My Heart'],
  ['Ariel Rivera', 'Sana Kahit Minsan'],
  ['Ogie Alcasid', 'Nandito Ako'],
  ['Sharon Cuneta', "Sana'y Wala Nang Wakas"],
  ['Apo Hiking Society', 'When I Met You'],
  ['Kuh Ledesma', 'Till I Met You'],
] as const

export interface ContinuousSong {
  id: string
  key: string
  artist: string
  title: string
  src: string
  sourceUrl: string
  sourceChannel?: string
  sourceRefreshedAt: number
  duration: number
}

function playableSource(url: string) {
  return url.startsWith('/api/audio?') ? url : `/api/audio?url=${encodeURIComponent(url)}`
}

function parseDuration(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 210
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function songKey(title: string) {
  return normalize(title.replace(/\(.*?\)|\[.*?\]/g, ' '))
    .replace(/\b(official|music|video|lyric|lyrics|audio|remastered|remaster|hd|hq|4k|with|mv)\b/g, ' ')
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ')
}

function displayTitle(title: string, artist: string) {
  let clean = title
    .replace(/^[A-Z]{1,4}\d{1,3}\s+/, '')
    .replace(/\.(?:mp3|m4a|aac|wav)$/i, '')
    .replace(/\s*[\[(][^\])]*(?:official|audio|lyrics?|music\s+video|video)[^\])]*[\])]/gi, '')
    .replace(/\s+(?:official\s+)?(?:music\s+)?video\b.*$/i, '')
    .replace(/\s+(?:official\s+)?(?:(?:with\s+)?lyrics?|audio)\b.*$/i, '')
    .trim()
  const artistText = artist.trim()
  const prefix = new RegExp(`^${artistText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—|:]\\s*`, 'i')
  clean = clean.replace(prefix, '').trim()
  return clean || title.trim()
}

function isBlockedGenreTitle(title: string) {
  return ROCK_RULE.test(title) || HIGH_ENERGY_DANCE_RULE.test(title) || DISCO_BLOCK_RULE.test(title)
}

function isPlayable(item: { title: string; duration?: string; live?: boolean | unknown; isLive?: unknown }) {
  const seconds = parseDuration(typeof item.duration === 'string' ? item.duration : '')
  if (seconds < 90 || seconds > 540) return false
  if (item.live === true || item.isLive === true) return false
  if (isChristmasTitle(item.title)) return false
  if (isBlockedGenreTitle(item.title)) return false
  if (/\b(?:karaoke|lyric\s+video|live\s+at|concert|nightcore|sped\s*up|slowed|8d\s+audio|instrumental|remix)\b/i.test(item.title)) return false
  return true
}

async function searchItems(query: string): Promise<YouTubeSearchResult[]> {
  const primary = await searchYouTube(`${query} official audio`, 10)
  if (primary.length >= 4) return primary
  const secondary = await searchYouTube(query, 10)
  const seen = new Set<string>()
  return [...primary, ...secondary].filter((item) => {
    const key = item.id || item.url
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Continuous online-radio style fill: free YouTube search (no API key).
 * Blocks rock / dance / disco. Always tries until a downloadable track is found.
 */
export async function resolveContinuousSong(songCount: number, blockedTitleKeys: Set<string> = new Set()): Promise<ContinuousSong | null> {
  for (let offset = 0; offset < CONTINUOUS_CATALOG.length; offset++) {
    const [artist, title] = CONTINUOUS_CATALOG[(songCount + offset) % CONTINUOUS_CATALOG.length]
    if (blockedTitleKeys.has(repeatTitleKey(title, artist))) continue
    const items = await searchItems(`${artist} ${title}`)
    const pool = items.filter(isPlayable)
    const fallback = items.filter((c) => {
      const seconds = parseDuration(c.duration ?? '')
      return seconds >= 90 && seconds <= 540 && c.live !== true && !isBlockedGenreTitle(c.title)
    })
    for (const item of (pool.length > 0 ? pool : fallback).slice(0, 5)) {
      try {
        const res = await fetch(`${API_BASE}?download=${encodeURIComponent(item.url)}&type=mp3`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) continue
        const payload = await res.json() as { downloadUrl?: string }
        if (!payload.downloadUrl) continue
        return {
          id: item.id,
          key: songKey(item.title),
          artist,
          title: displayTitle(item.title, artist) || title,
          src: playableSource(payload.downloadUrl),
          sourceUrl: item.url,
          sourceChannel: item.channel,
          sourceRefreshedAt: Date.now(),
          duration: parseDuration(item.duration),
        }
      } catch {
        continue
      }
    }
  }
  return null
}
