import 'server-only'
import { acquireStationLease, EMPTY_MOR_SYNC_RECORD, getRatings, getSettings, hasQueuePersistence, MOR_SYNC_PATH, QUEUE_LOCK_PATH, readJson, releaseStationLease, renewStationLease, STATE_PATH, writeJson } from './storage'
import { getListenerCount } from './listeners'
import { isChristmasTitle, isNightVolumeWindow, isOffAir, languageForSlot, manilaDateKey, MANILA_OFFSET_MS, manilaTime, nextSignOff, nextSignOn, PROGRAMS, programAt, type Artist, type Program } from './schedule'
import type { AdminStatus, MorSyncRecord, NowResponse, Track } from './types'
import { appendCompletedSong, isCompletedDailyMusicTrack, isInPlaybackQueue, repeatTitleKey, rollDailyPlayedLog } from './song-repeat'
import { fetchMorNowPlaying, normalizeMorMatchText } from './mor-sync'
import { hasBlacklistedTitle, isAllowedTrack } from './track-filter'

const API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const SONG_REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const ARTIST_WINDOW_MS = 60 * 60 * 1000
const MAX_ARTIST_PLAYS_PER_HOUR = 2
const FILL_LOCK_MS = 45_000
const QUEUE_LEASE_MS = 100_000
const SOURCE_REFRESH_WINDOW_MS = 110_000
const SOURCE_REFRESH_RETRY_MS = 45_000
const ACTIVE_SOURCE_REFRESH_AFTER_MS = 60_000
const PRELOAD_QUEUE_WITH_ACTIVE_TRACKS = 2
const PRELOAD_QUEUE_WITHOUT_ACTIVE_TRACK = 1
const REJECTED_TITLE_RULE = /\b(?:it['’]?s?\s+show\s*time|show\s*time|live\s+concerts?|concerts?\s+live)\b/i
const SHOWTIME_METADATA_RULE = /\b(?:it['’]?s?\s+show\s*time|show\s*time)\b/i
// Coalesce simultaneous listener polls that land in the same server runtime.
let activeQueueFill: Promise<void> | null = null

function playableSource(url: string) {
  return url.startsWith('/api/audio?') ? url : `/api/audio?url=${encodeURIComponent(url)}`
}

function monitorStationLease(lease: { pathname: string; owner: string }) {
  let valid = true
  let renewal = Promise.resolve()
  const timer = setInterval(() => {
    renewal = renewal.then(async () => {
      if (valid) valid = await renewStationLease(lease, QUEUE_LEASE_MS)
    }).catch((error) => {
      valid = false
      console.error('[morefm] queue lease renewal failed', error)
    })
  }, 20_000)
  timer.unref()
  return {
    isValid: async () => { await renewal; return valid },
    stop: async () => { clearInterval(timer); await renewal },
  }
}

interface HistoryEntry {
  id: string
  key: string
  artist: string
  title?: string
  t: number
}

interface DailyPlayedTitle {
  title: string
  artist: string
  playedAt: number
  key: string
}

interface StationState {
  tracks: Track[]
  songCount: number
  history: HistoryEntry[]
  fillingUntil: number
  lastBreakSongCount: number
  lastNewsDate: string
  dailyPlayedDate: string
  dailyPlayedTitles: DailyPlayedTitle[]
}

const EMPTY_STATE: StationState = { tracks: [], songCount: 0, history: [], fillingUntil: 0, lastBreakSongCount: 0, lastNewsDate: '', dailyPlayedDate: '', dailyPlayedTitles: [] }

interface SearchItem {
  id: string
  title: string
  url: string
  duration: string
  channel?: string
  author?: string
  uploader?: string
  source?: string
  description?: string
  live?: unknown
  isLive?: unknown
}

function hasRejectedRecordingLabel(title: unknown, ...values: unknown[]) {
  const titleText = typeof title === 'string' ? title : ''
  const metadata = [title, ...values].filter((value): value is string => typeof value === 'string').join(' ')
  const liveTitleTag = /(?:\(\s*live\s*\)|\[\s*live\s*\]|\blive\s*$)/i.test(titleText)
  const rejectedMetadata = SHOWTIME_METADATA_RULE.test(metadata) || /\blive\s+(?:concert|performance|recording|version|session|show|set|stream|acoustic|cover|at|in|from|on|video|audio|blog)\b|\bconcert\s+(?:live|recording|version|video|audio|footage|performance)\b|\b(?:performed|performing)\s+live\b|\blivestream\b|\bvlog\b|\bwish\s*107(?:[.]?5)?\b|\bwishclusive\b|\bwish[\s-]*bus\b/i.test(metadata)
  return liveTitleTag || rejectedMetadata || AI_RULE.test(metadata)
}

function isDisallowedSearchItem(item: SearchItem) {
  const liveFlag = [item.live, item.isLive].some((value) => value === true || value === 'true')
  return liveFlag || hasBlacklistedTitle(item.title) || REJECTED_TITLE_RULE.test(item.title) || hasRejectedRecordingLabel(item.title, item.url, item.channel, item.author, item.uploader, item.source, item.description)
}

async function findMorSong(title: string, artist: string, blockedTitleKeys: Set<string> = new Set(), requireTagalog = false) {
  if (isChristmasTitle(title) || (requireTagalog && !TAGALOG_TITLE_RULE.test(title))) return null
  if (blockedTitleKeys.has(repeatTitleKey(title, artist))) return null
  const data = await fetchJson<{ items?: SearchItem[] }>(
    `${API_BASE}?search=${encodeURIComponent(`${title} ${artist}`)}`,
    8_000,
  )
  const expectedTitle = normalizeMorMatchText(title)
  const expectedArtist = normalizeMorMatchText(artist)
  const candidates = (data?.items ?? []).filter((item) => {
    const seconds = parseDuration(item.duration ?? '')
    if (seconds < 90 || seconds > 540 || isDisallowedSearchItem(item) || !isAllowedTrack(item, artist) || isChristmasTitle(item.title) || NON_LATIN.test(item.title)) return false
    const cleanedTitle = item.title.replace(/^[A-Z]{1,4}\d{1,3}\s+/, '').replace(/\.(?:mp3|m4a|aac|wav)$/i, '').replace(/\s+(?:mp3|m4a|aac|wav)$/i, '')
    const parts = cleanedTitle.split(/\s+(?:[-–—|]|::)\s+/).map((part) => part.trim())
    const titleMatches = parts.some((part) => normalizeMorMatchText(part) === expectedTitle) || normalizeMorMatchText(cleanedTitle) === expectedTitle
    const credits = [item.author, item.channel, item.uploader, item.source].filter(Boolean).join(' ')
    const artistInTitle = parts.some((part) => normalizeMorMatchText(part) === expectedArtist)
    const artistInCredits = ` ${normalizeMorMatchText(credits)} `.includes(` ${expectedArtist} `)
    return titleMatches && (artistInTitle || artistInCredits) && !blockedTitleKeys.has(repeatTitleKey(item.title, artist))
  }).slice(0, 6)

  const downloads = await Promise.all(candidates.map(async (item) => {
    const download = await fetchJson<{ downloadUrl?: string }>(`${API_BASE}?download=${encodeURIComponent(item.url)}&type=mp3`, 12_000)
    if (!download?.downloadUrl) return null
    return {
      id: item.id,
      key: songKey(title),
      artist,
      title: item.title,
      src: playableSource(download.downloadUrl),
      sourceUrl: item.url,
      sourceChannel: item.channel,
      sourceRefreshedAt: Date.now(),
      duration: parseDuration(item.duration),
    }
  }))
  return downloads.find((song) => song !== null) ?? null
}

async function findMorFallback(program: Program, songCount: number, history: HistoryEntry[], now: number, shuffleEnabled: boolean, blockedTitleKeys: Set<string>) {
  const poolProgram = program.pools.tagalog.length > 0 ? program : PROGRAMS['love-mix']
  return findSong({ ...poolProgram, tagalogOnly: true }, songCount, history, now, shuffleEnabled, blockedTitleKeys)
}

const AI_RULE =
  /\bai\b|a\.i\.|artificial intelligence|suno|udio|voice ?clon|cloned|\bclone\b|deepfake|synthetic|generated|remake|re-?imagined|\bcover\b|covered by|tribute|version|parody|impersonat|soundalike/i

const ROCK_RULE = /rock|metal|punk|grunge|emo\b|screamo|hardcore|headbang/i
const HIGH_ENERGY_DANCE_RULE = /\b(?:edm|techno|trance|dubstep|rave|club mix|dance remix|dance mix|dance version|house music|eurodance|electro dance|hands up)\b/i

const QUALITY_RULE =
  /karaoke|instrumental|minus one|full album|nonstop|non-stop|medley|reaction|tutorial|remix|sped ?up|slowed|nightcore|8d|reverb|bass ?boost|mashup|playlist|compilation|1 hour|loop|ringtone|lesson|chords|piano|guitar|violin|saxophone|acoustic|sing-?along|with lyrics in/i

const FOREIGN_RULE =
  /espa[nñ]ol|spanish|en español|portugu|italiano|fran[cç]ais|deutsch|german version|korean|k-?pop|japanese|j-?pop|chinese|mandarin|cantonese|thai|vietnam|indonesia|malay|hindi|bollywood|arabic|turkish|russian|bisaya|cebuano|ilocano|subtitulado|traducida|legendado|letra/i

const TAGALOG_TITLE_RULE = /\b(?:anak|bayan|maging\s+sino\s+ka\s+man|pag[\s-]?ibig|mahal|bakit|puso|sana|nang|wala|walang|hanggang|ikaw|aking|mga|ang|ng|sa|ako|siya|tayo|ito|dahil|paano|huwag|ko|mo|ka|ay|ba|sino|unang|huling|kasama|kita|pangarap|pag-asa|tadhana|sinta|ligaya|buhay|kahit|lahat|minsan|tanging|ngayon|basta|naman|saan|mundo|alaala|na|pag|tao|pasko|himig|maligayang)\b/i

function isSundayOldiesArtist(name: string) {
  const normalizedName = normalizeMorMatchText(name)
  return PROGRAMS['sunday-oldies'].pools.tagalog.some((artist) => normalizeMorMatchText(artist.name) === normalizedName)
}

const NON_LATIN = /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\u2100-\u214F]/
function parseDuration(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
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

/** Strict gatekeeper: original recording by the scheduled artist, English/Tagalog only, no AI, no rock. */
function isAllowed(title: string, artist: Artist, requireTagalog = false, credits = '') {
  if (NON_LATIN.test(title)) return false
  if (hasBlacklistedTitle(title) || REJECTED_TITLE_RULE.test(title) || AI_RULE.test(title) || ROCK_RULE.test(title) || HIGH_ENERGY_DANCE_RULE.test(title)) return false
  if (QUALITY_RULE.test(title) || FOREIGN_RULE.test(title)) return false
  if (requireTagalog && !TAGALOG_TITLE_RULE.test(title)) return false
  return ` ${normalize(`${title} ${credits}`)} `.includes(` ${normalize(artist.match)} `)
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
      if (res.ok) return (await res.json()) as T
      if (attempt > 0 || (res.status !== 429 && res.status < 500)) return null
    } catch {
      if (attempt > 0) return null
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return null
}

function eligibleArtists(pool: Artist[], history: HistoryEntry[], now: number, shuffleEnabled: boolean) {
  const unique = [...new Map(pool.map((a) => [a.name, a])).values()]
  const lastArtist = history.at(-1)?.artist
  const hourCounts = new Map<string, number>()
  for (const h of history) {
    if (h.t > now - ARTIST_WINDOW_MS) hourCounts.set(h.artist, (hourCounts.get(h.artist) ?? 0) + 1)
  }
  const allowed = unique.filter(
    (a) => a.name !== lastArtist && (hourCounts.get(a.name) ?? 0) < MAX_ARTIST_PLAYS_PER_HOUR,
  )
  const recent = new Set(history.slice(-12).map((h) => h.artist))
  const fresh = allowed.filter((a) => !recent.has(a.name))
  const selected = fresh.length >= 3 ? fresh : allowed
  return shuffleEnabled ? shuffle(selected) : selected
}

async function findSong(program: Program, songCount: number, history: HistoryEntry[], now: number, shuffleEnabled = true, blockedTitleKeys: Set<string> = new Set()) {
  const language = languageForSlot(program, songCount)
  const candidatesArtists = eligibleArtists(program.pools[language], history, now, shuffleEnabled)
  const variants = program.variants[language]

  const searchResults = await Promise.all(candidatesArtists.slice(0, 8).map(async (artist) => {
    const variant = (shuffleEnabled ? variants[Math.floor(Math.random() * variants.length)] : variants[0]) ?? ''
    const data = await fetchJson<{ items?: SearchItem[] }>(
      `${API_BASE}?search=${encodeURIComponent(`${artist.name} ${variant}`.trim())}`,
      8_000,
    )
    return { artist, items: data?.items ?? [] }
  }))

  const candidates = searchResults.flatMap(({ artist, items }) => items
    .filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      if (seconds < 90 || seconds > 540) return false
      const credits = [item.author, item.channel, item.uploader, item.source].filter(Boolean).join(' ')
      const christmasTitle = isChristmasTitle(item.title)
      if (isDisallowedSearchItem(item) || christmasTitle || !isAllowedTrack(item, artist.name) || !isAllowed(item.title, artist, program.tagalogOnly, credits)) return false
      return !blockedTitleKeys.has(repeatTitleKey(item.title, artist.name))
    })
    .map((item) => ({ artist, item })))
  if (shuffleEnabled) shuffle(candidates)

  const downloadResults = await Promise.all(candidates.slice(0, 8).map(async ({ artist, item }) => {
    const download = await fetchJson<{ downloadUrl?: string }>(
      `${API_BASE}?download=${encodeURIComponent(item.url)}&type=mp3`,
      12_000,
    )
    if (!download?.downloadUrl) return null
    return {
      id: item.id,
      key: songKey(item.title),
      artist: artist.name,
      title: item.title,
      src: playableSource(download.downloadUrl),
      sourceUrl: item.url,
      sourceChannel: item.channel,
      sourceRefreshedAt: Date.now(),
      duration: parseDuration(item.duration),
    }
  }))
  return downloadResults.find((result) => result !== null) ?? null
}

async function refreshUpcomingSongSources(state: StationState, now: number) {
  const due = state.tracks.filter((track) =>
    (track.kind === 'music' || track.kind === 'mor-sync') && track.sourceUrl &&
    ((track.startAt > now && track.startAt - now <= SOURCE_REFRESH_WINDOW_MS) ||
      (track.startAt <= now && trackEnd(track) > now && track.sourceRefreshedAt !== undefined && now - track.sourceRefreshedAt >= ACTIVE_SOURCE_REFRESH_AFTER_MS)) &&
    (track.sourceRefreshedAt === undefined || now - track.sourceRefreshedAt >= SOURCE_REFRESH_RETRY_MS),
  )
  if (due.length === 0) return false
  const refreshed = await Promise.all(due.map(async (track) => ({
    track,
    download: await fetchJson<{ downloadUrl?: string }>(`${API_BASE}?download=${encodeURIComponent(track.sourceUrl!)}&type=mp3`, 8_000),
  })))
  for (const { track, download } of refreshed) {
    track.sourceRefreshedAt = now
    if (download?.downloadUrl) track.src = playableSource(download.downloadUrl)
  }
  return true
}

function trackEnd(track: Track) {
  return track.startAt + track.duration * 1000
}

function audioConfig(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    masterVolume: settings.masterVolume,
    nightVolumePercent: settings.nightVolumePercent,
    bassGainDb: settings.bassGainDb,
    crossfaderEnabled: settings.crossfaderEnabled,
    crossfaderCurve: settings.crossfaderCurve,
    crossfadeSeconds: settings.crossfadeSeconds,
    replayGainEnabled: settings.replayGainEnabled,
    replayGainTargetLufs: settings.replayGainTargetLufs,
  }
}

function queueAheadTarget(state: StationState, now: number) {
  const hasActiveTrack = state.tracks.some((track) => track.startAt <= now && trackEnd(track) > now)
  return hasActiveTrack ? PRELOAD_QUEUE_WITH_ACTIVE_TRACKS : PRELOAD_QUEUE_WITHOUT_ACTIVE_TRACK
}

function nextStart(state: StationState, now: number) {
  const last = state.tracks.at(-1)
  if (!last) return now
  return Math.max(now, trackEnd(last) - last.fadeOut * 1000)
}
function manilaHourBoundary(ms: number, hour: number) {
  const date = new Date(ms + MANILA_OFFSET_MS)
  date.setUTCHours(hour, 0, 0, 0)
  return date.getTime() - MANILA_OFFSET_MS
}
