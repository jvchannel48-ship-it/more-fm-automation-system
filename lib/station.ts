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
  // Prefer artists not heard recently so the rotation keeps changing.
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
async function fill(state: StationState, now: number, settings: Awaited<ReturnType<typeof getSettings>>) {
  const blockedTitleKeys = settings.noRepeatEnabled
    ? new Set([
        ...state.dailyPlayedTitles.map((entry) => entry.key),
        ...state.history
          .filter((entry) => manilaDateKey(entry.t) === manilaDateKey(now))
          .map((entry) => repeatTitleKey(entry.title ?? entry.key, entry.artist))
          .filter(Boolean),
        ...state.tracks
          .filter((track) => track.kind === 'music' || track.kind === 'mor-sync')
          .map((track) => repeatTitleKey(track.title ?? '', state.history.find((entry) => entry.t === track.startAt)?.artist ?? ''))
          .filter(Boolean),
      ])
    : new Set<string>()
  const targetFutureTracks = queueAheadTarget(state, now)
  let guard = 0
  while (state.tracks.filter((t) => t.startAt > now).length < targetFutureTracks && guard++ < 6) {
    const previousTrack = state.tracks.at(-1)
    const breakAt = previousTrack ? trackEnd(previousTrack) : now
    const breakTime = manilaTime(breakAt)
    const sunday = breakTime.day === 0
    const sundayGoldenBreak = sunday && breakTime.hour >= 6 && state.songCount > 0 && state.songCount % 5 === 0
    const regularBreak = !sunday && state.songCount > 0 && state.songCount % 4 === 0
    if ((sundayGoldenBreak || regularBreak) && state.lastBreakSongCount !== state.songCount) {
      state.lastBreakSongCount = state.songCount
      const spots: Array<{ asset: NonNullable<typeof settings.jingle>; kind: 'jingle' | 'commercial' | 'golden-sunday' }> = []
      if (sundayGoldenBreak && settings.goldenSunday) spots.push({ asset: settings.goldenSunday, kind: 'golden-sunday' })
      if (regularBreak && settings.jingleEnabled && settings.jingle) spots.push({ asset: settings.jingle, kind: 'jingle' })
      if (regularBreak && settings.jingleEnabled && settings.commercialEnabled) {
        for (const asset of settings.commercials) if (asset) spots.push({ asset, kind: 'commercial' })
      }
      if (spots.length > 0) {
        const previous = state.tracks.at(-1)
        if (previous) previous.fadeOut = 0
        for (const { asset, kind } of spots) {
          const startAt = nextStart(state, now)
          if (isOffAir(startAt, settings.signOffHour, settings.signOnHour)) break
          state.tracks.push({
            uid: `${kind}-${startAt}-${Math.random().toString(36).slice(2, 8)}`,
            src: asset.url,
            startAt,
            duration: asset.duration,
            fadeIn: 0,
            fadeOut: 0,
            kind,
            title: asset.name,
          })
        }
        continue
      }
    }
    const startAt = nextStart(state, now)
    if (isOffAir(startAt, settings.signOffHour, settings.signOnHour)) break
    const program = programAt(startAt, settings.signOffHour, settings.signOnHour, settings.discoStartHour, settings.discoEndHour, settings.newsEnabled)
    if (!settings.tagalogOnlyEnabled && program.id === 'news' && settings.news) {
      const newsDate = manilaDateKey(startAt)
      if (state.lastNewsDate !== newsDate) {
        state.lastNewsDate = newsDate
        state.tracks.push({
          uid: `news-${startAt}-${Math.random().toString(36).slice(2, 8)}`,
          src: settings.news.url,
          startAt,
          duration: settings.news.duration,
          fadeIn: 0,
          fadeOut: 0,
          kind: 'news',
          title: settings.news.name,
        })
        continue
      }
    }
    const rotationProgram = manilaTime(startAt).day === 0
      ? program.id === 'sunday-english-oldies' ? PROGRAMS['sunday-english-oldies'] : PROGRAMS['sunday-oldies']
      : settings.tagalogOnlyEnabled
        ? PROGRAMS['sunday-tagalog']
        : settings.goodVibesEnabled ? PROGRAMS['good-vibes']
        : program.id === 'news' ? PROGRAMS['love-mix'] : program
    const fadeIn = state.tracks.at(-1)?.fadeOut ?? 0
    const song = await findSong(rotationProgram, state.songCount, state.history, startAt, settings.shuffleEnabled, blockedTitleKeys)
    if (!song) break
    // Song lookup can take several seconds; never schedule a fresh start in the past.
    const songStart = Math.max(nextStart(state, now), Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    const sundayEnglishBoundary = program.id === 'sunday-english-oldies' ? manilaHourBoundary(songStart, 6) : Number.POSITIVE_INFINITY
    state.tracks.push({
      uid: `${song.id}-${songStart}`,
      src: song.src,
      startAt: songStart,
      duration: Math.max(1, Math.min(song.duration, (sundayEnglishBoundary - songStart) / 1000)),
      fadeIn: settings.crossfaderEnabled ? fadeIn : 0,
      fadeOut: settings.crossfaderEnabled ? settings.crossfadeSeconds : 0,
      sourceUrl: song.sourceUrl,
      sourceChannel: song.sourceChannel,
      sourceRefreshedAt: song.sourceRefreshedAt,
      kind: 'music',
      title: song.title,
    })
    state.history.push({ id: song.id, key: song.key, artist: song.artist, title: song.title, t: songStart })
    if (settings.noRepeatEnabled) blockedTitleKeys.add(repeatTitleKey(song.title, song.artist))
    state.history = state.history.slice(-settings.rotationPoolSize)
    state.songCount++
    // One song per station poll keeps the now-playing endpoint responsive.
    break
  }
}

async function loadState(now: number) {
  const state: StationState = { ...EMPTY_STATE, ...(await readJson<Partial<StationState>>(STATE_PATH, {})) }
  state.lastBreakSongCount = state.lastBreakSongCount ?? 0
  state.lastNewsDate = state.lastNewsDate ?? ''
  state.dailyPlayedTitles = Array.isArray(state.dailyPlayedTitles) ? state.dailyPlayedTitles.filter((entry) => Boolean(entry && typeof entry.key === 'string' && typeof entry.title === 'string' && typeof entry.artist === 'string' && typeof entry.playedAt === 'number')) : []
  state.dailyPlayedDate = typeof state.dailyPlayedDate === 'string' ? state.dailyPlayedDate : ''
  let dailyChanged = false
  const currentDay = manilaDateKey(now)
  const rolledLog = rollDailyPlayedLog(state.dailyPlayedDate, currentDay, state.dailyPlayedTitles)
  state.dailyPlayedDate = rolledLog.date
  state.dailyPlayedTitles = rolledLog.entries.map((entry) => ({ ...entry, key: repeatTitleKey(entry.title, entry.artist) }))
  dailyChanged ||= state.dailyPlayedTitles.some((entry, index) => entry.key !== rolledLog.entries[index]?.key)
  dailyChanged ||= rolledLog.changed
  const dailyKeys = new Set(state.dailyPlayedTitles.map((entry) => entry.key))
  for (const track of state.tracks) {
    if (!track.title) continue
    const trackManila = manilaTime(track.startAt)
    if (trackManila.day === 0 && trackManila.hour >= 4 && trackManila.hour < 6) {
      const endAt = manilaHourBoundary(track.startAt, 6)
      if (trackEnd(track) > endAt) track.duration = Math.max(1, (endAt - track.startAt) / 1000)
    }
    if (!isCompletedDailyMusicTrack({
      kind: track.kind,
      title: track.title,
      endAt: trackEnd(track),
      trackDay: manilaDateKey(track.startAt),
      currentDay,
      now,
    })) continue
    const artist = state.history.find((entry) => entry.t === track.startAt)?.artist ?? 'Unknown artist'
    const key = repeatTitleKey(track.title, artist)
    if (!key || dailyKeys.has(key)) continue
    const completed = appendCompletedSong(state.dailyPlayedTitles, {
      title: track.title.replace(/^song request\s*:\s*/i, ''),
      artist,
      playedAt: trackEnd(track),
      key,
    })
    if (completed !== state.dailyPlayedTitles) {
      state.dailyPlayedTitles = completed
      dailyKeys.add(key)
      dailyChanged = true
    }
  }
  const before = state.tracks.length
  state.tracks = state.tracks.filter((track) => {
    const isMusicTrack = track.kind === 'music' || track.kind === 'mor-sync'
    const isChristmasTrack = isChristmasTitle(track.title ?? '')
    const isFutureTrack = track.startAt > now
    const staleRequest = isMusicTrack && isFutureTrack && track.title?.startsWith('Song request:')
    const removeChristmas = isMusicTrack && isChristmasTrack
    const removeBrigada = track.kind === 'brigada-news'
    const sunday = manilaTime(now).day === 0
    const artist = state.history.find((entry) => entry.t === track.startAt)?.artist ?? ''
    const removeFilteredTrack = isMusicTrack && !isAllowedTrack({ title: track.title, channel: track.sourceChannel }, artist)
    const trackManila = manilaTime(track.startAt)
    const validSundayEnglishOldies = trackManila.hour >= 4 && trackManila.hour < 6
    const validSundayOldies = isSundayOldiesArtist(artist) && TAGALOG_TITLE_RULE.test(track.title ?? '')
    const removeSundayBreak = sunday && (
      ['jingle', 'commercial', 'news', 'dj-mic'].includes(track.kind ?? '')
      || (track.kind === 'golden-sunday' && manilaTime(track.startAt).hour < 6)
    )
    const removeSundayMusic = sunday && isMusicTrack && (
      manilaTime(track.startAt).day !== 0 || (!validSundayOldies && !validSundayEnglishOldies)
    )
    return isInPlaybackQueue(trackEnd(track), now)
      && !staleRequest
      && !removeFilteredTrack
      && !removeChristmas
      && !removeBrigada
      && !removeSundayBreak
      && !removeSundayMusic
      && (
        track.startAt <= now || (track.kind !== 'music' && track.kind !== undefined) || (!REJECTED_TITLE_RULE.test(track.title ?? '') && !hasRejectedRecordingLabel(track.title, track.src))
      )
  })
  state.history = state.history.filter((h) => h.t > now - SONG_REPEAT_WINDOW_MS)
  return { state, changed: dailyChanged || state.tracks.length !== before }
}

export async function runMorSyncTick(): Promise<MorSyncRecord> {
  const current = await readJson<MorSyncRecord>(MOR_SYNC_PATH, EMPTY_MOR_SYNC_RECORD)
  const settings = await getSettings()
  if (!settings.morSyncEnabled) return { ...current, syncStatus: 'MOR SYNC OFF' }

  const metadata = await fetchMorNowPlaying()
  const lease = await acquireStationLease(QUEUE_LOCK_PATH, QUEUE_LEASE_MS)
  if (!lease) return await readJson<MorSyncRecord>(MOR_SYNC_PATH, { ...current, metadata })
  const leaseGuard = monitorStationLease(lease)
  try {
    const latestSettings = await getSettings()
    const latest = await readJson<MorSyncRecord>(MOR_SYNC_PATH, EMPTY_MOR_SYNC_RECORD)
    if (!latestSettings.morSyncEnabled) return { ...latest, syncStatus: 'MOR SYNC OFF' }

    if (!latestSettings.autoDjEnabled) {
      const record = { ...latest, metadata, syncStatus: 'AUTODJ OFF' as const, updatedAt: Date.now() }
      await writeJson(MOR_SYNC_PATH, record)
      return record
    }
    if (metadata.status !== 'music' || !metadata.title || !metadata.artist || !metadata.key) {
      const record: MorSyncRecord = {
        ...latest,
        metadata,
        syncStatus: 'HINDI NAKITA YUNG KANTA',
        lastProcessedKey: null,
        lastProcessedMatched: null,
        queuedTitle: null,
        updatedAt: Date.now(),
      }
      await writeJson(MOR_SYNC_PATH, record)
      return record
    }
    if (latest.lastProcessedKey === metadata.key) {
      const record = { ...latest, metadata, updatedAt: Date.now() }
      await writeJson(MOR_SYNC_PATH, record)
      return record
    }

    const now = Date.now()
    if (!latestSettings.broadcastEnabled || isOffAir(now, latestSettings.signOffHour, latestSettings.signOnHour)) {
      const record: MorSyncRecord = {
        ...latest,
        metadata,
        syncStatus: 'HINDI NAKITA YUNG KANTA',
        lastProcessedKey: null,
        lastProcessedMatched: null,
        queuedTitle: null,
        updatedAt: Date.now(),
      }
      await writeJson(MOR_SYNC_PATH, record)
      return record
    }
    const loaded = await loadState(now)
    const state = loaded.state
    const inProgram = programAt(now, latestSettings.signOffHour, latestSettings.signOnHour, latestSettings.discoStartHour, latestSettings.discoEndHour, latestSettings.newsEnabled)
    const blockedTitleKeys = latestSettings.noRepeatEnabled
      ? new Set([
          ...state.dailyPlayedTitles.map((entry) => entry.key),
          ...state.history
            .filter((entry) => manilaDateKey(entry.t) === manilaDateKey(now))
            .map((entry) => repeatTitleKey(entry.title ?? entry.key, entry.artist))
            .filter(Boolean),
          ...state.tracks.filter((track) => track.kind === 'music' || track.kind === 'mor-sync').map((track) => repeatTitleKey(track.title ?? '', state.history.find((entry) => entry.t === track.startAt)?.artist ?? '')).filter(Boolean),
        ])
      : new Set<string>()
    const sunday = manilaTime(now).day === 0
    const requireTagalog = latestSettings.tagalogOnlyEnabled || sunday
    const morArtistIsAllowed = !sunday || isSundayOldiesArtist(metadata.artist)
    const matchedSong = morArtistIsAllowed
      ? await findMorSong(metadata.title, metadata.artist, blockedTitleKeys, requireTagalog)
      : null
    const song = matchedSong ?? await findMorFallback(inProgram, state.songCount, state.history, now, latestSettings.shuffleEnabled, blockedTitleKeys)
    if (!(await leaseGuard.isValid())) return latest
    const verifiedSettings = await getSettings()
    if (!verifiedSettings.morSyncEnabled || !verifiedSettings.autoDjEnabled) {
      const record: MorSyncRecord = {
        ...latest,
        metadata,
        syncStatus: verifiedSettings.morSyncEnabled ? 'AUTODJ OFF' : 'MOR SYNC OFF',
        updatedAt: Date.now(),
      }
      await writeJson(MOR_SYNC_PATH, record)
      return record
    }
    const finalNow = Date.now()
    const freshState = await loadState(finalNow)
    Object.assign(state, freshState.state)
    if (isOffAir(finalNow, verifiedSettings.signOffHour, verifiedSettings.signOnHour) || !verifiedSettings.broadcastEnabled) {
      const record: MorSyncRecord = { ...latest, metadata, syncStatus: 'HINDI NAKITA YUNG KANTA', lastProcessedKey: null, lastProcessedMatched: null, queuedTitle: null, updatedAt: Date.now() }
      await writeJson(MOR_SYNC_PATH, record)
      return record
    }
    if (song) {
      const activeTracks = state.tracks.filter((track) => track.startAt <= finalNow && trackEnd(track) > finalNow)
      state.tracks = activeTracks
      const startAt = nextStart(state, finalNow)
      state.tracks.push({
        uid: `mor-${metadata.key}-${startAt}`,
        src: song.src,
        startAt,
        duration: song.duration,
        fadeIn: verifiedSettings.crossfaderEnabled ? (state.tracks.at(-1)?.fadeOut ?? 0) : 0,
        fadeOut: verifiedSettings.crossfaderEnabled ? verifiedSettings.crossfadeSeconds : 0,
        sourceUrl: song.sourceUrl,
        sourceChannel: song.sourceChannel,
        sourceRefreshedAt: song.sourceRefreshedAt,
        kind: 'mor-sync',
        title: matchedSong ? metadata.title : song.title,
        morKey: metadata.key,
        morExactMatch: Boolean(matchedSong),
      })
      state.history.push({ id: song.id, key: songKey(matchedSong ? metadata.title! : song.title), artist: matchedSong ? metadata.artist! : song.artist, title: matchedSong ? metadata.title! : song.title, t: startAt })
      state.history = state.history.slice(-verifiedSettings.rotationPoolSize)
      state.songCount++
      if (!(await leaseGuard.isValid())) return latest
      await writeJson(STATE_PATH, state)
    }

    const record: MorSyncRecord = {
      metadata,
      syncStatus: matchedSong ? 'SYNCED' : 'HINDI NAKITA YUNG KANTA',
      lastProcessedKey: metadata.key,
      lastProcessedMatched: Boolean(matchedSong),
      queuedTitle: song ? (matchedSong ? metadata.title : song.title) : null,
      updatedAt: Date.now(),
    }
    await writeJson(MOR_SYNC_PATH, record)
    return record
  } finally {
    await leaseGuard.stop()
    await releaseStationLease(lease)
  }
}

async function fillQueueIfNeeded(settings: Awaited<ReturnType<typeof getSettings>>) {
  if (activeQueueFill) return activeQueueFill

  const fillPromise = (async () => {
    const lease = await acquireStationLease(QUEUE_LOCK_PATH, QUEUE_LEASE_MS)
    if (!lease) return
    const leaseGuard = monitorStationLease(lease)
    try {
    const now = Date.now()
    const { state, changed } = await loadState(now)
    if (changed && await leaseGuard.isValid()) await writeJson(STATE_PATH, state)
    const needsFill = state.tracks.filter((track) => track.startAt > now).length < queueAheadTarget(state, now)
    if (!settings.autoDjEnabled || !needsFill || state.fillingUntil >= now) return

    if (settings.morSyncEnabled) {
      const mor = await readJson<MorSyncRecord>(MOR_SYNC_PATH, EMPTY_MOR_SYNC_RECORD)
      const morTrackQueued = state.tracks.some((track) => track.kind === 'mor-sync' && track.startAt > now && trackEnd(track) > now)
      const awaitingMorTick = mor.metadata?.status === 'music' && mor.lastProcessedKey !== mor.metadata.key
        && now - mor.metadata.checkedAt < 2 * 60_000
      if (morTrackQueued || awaitingMorTick) return
    }

    state.fillingUntil = now + FILL_LOCK_MS
    if (!(await leaseGuard.isValid())) return
    await writeJson(STATE_PATH, state)
    try {
      await fill(state, now, settings)
    } finally {
      state.fillingUntil = 0
      if (await leaseGuard.isValid()) await writeJson(STATE_PATH, state)
    }
    } finally {
      await leaseGuard.stop()
      await releaseStationLease(lease)
    }
  })()

  activeQueueFill = fillPromise
  try {
    await fillPromise
  } finally {
    if (activeQueueFill === fillPromise) activeQueueFill = null
  }
}

export async function getNowPlaying(): Promise<NowResponse> {
  const now = Date.now()
  const [loaded, settings] = await Promise.all([loadState(now), getSettings()])
  let { state } = loaded
  const offAir = isOffAir(now, settings.signOffHour, settings.signOnHour) || !settings.broadcastEnabled

  if (offAir) {
    if (state.tracks.length > 0) {
      state.tracks = []
      await writeJson(STATE_PATH, state)
    } else if (loaded.changed) {
      await writeJson(STATE_PATH, state)
    }
    return {
      serverTime: Date.now(),
      offAir: true,
      boardOperatorEnabled: settings.boardOperatorEnabled,
      nextOnAir: settings.broadcastEnabled ? nextSignOn(now, settings.signOnHour) : null,
      signOffAt: settings.broadcastEnabled ? null : now,
      tracks: [],
      nightVolumeActive: settings.nightVolumeEnabled && isNightVolumeWindow(now, settings.nightVolumeStartHour, settings.nightVolumeEndHour),
      audioConfig: audioConfig(settings),
    }
  }

  if (!settings.morSyncEnabled && state.tracks.some((track) => track.kind === 'mor-sync' && track.startAt > now)) {
    state.tracks = state.tracks.filter((track) => track.startAt <= now)
    await writeJson(STATE_PATH, state)
  }

  const needsFill = state.tracks.filter((track) => track.startAt > now).length < queueAheadTarget(state, now)
  if (settings.autoDjEnabled && needsFill) {
    await fillQueueIfNeeded(settings)
    const refreshed = await loadState(Date.now())
    state = refreshed.state
  }

  const responseNow = Date.now()
  if (isOffAir(responseNow, settings.signOffHour, settings.signOnHour) || !settings.broadcastEnabled) {
    state.tracks = []
    await writeJson(STATE_PATH, state)
    return {
      serverTime: responseNow,
      offAir: true,
      boardOperatorEnabled: settings.boardOperatorEnabled,
      nextOnAir: settings.broadcastEnabled ? nextSignOn(responseNow, settings.signOnHour) : null,
      signOffAt: settings.broadcastEnabled ? null : responseNow,
      tracks: [],
      nightVolumeActive: settings.nightVolumeEnabled && isNightVolumeWindow(responseNow, settings.nightVolumeStartHour, settings.nightVolumeEndHour),
      audioConfig: audioConfig(settings),
    }
  } else {
    const lease = await acquireStationLease(QUEUE_LOCK_PATH, QUEUE_LEASE_MS)
    if (lease) {
      try {
        const latest = await loadState(responseNow)
        state = latest.state
        const sourcesChanged = await refreshUpcomingSongSources(state, responseNow)
        if (latest.changed || sourcesChanged) await writeJson(STATE_PATH, state)
      } finally {
        await releaseStationLease(lease)
      }
    } else {
      state = (await loadState(responseNow)).state
    }
  }

  const tracks = state.tracks.map((track) => track.kind === 'music' || track.kind === 'mor-sync' ? { ...track, src: playableSource(track.src) } : track)
  return { serverTime: responseNow, offAir: false, boardOperatorEnabled: settings.boardOperatorEnabled, nextOnAir: null, signOffAt: nextSignOff(responseNow, settings.signOffHour), tracks, nightVolumeActive: settings.nightVolumeEnabled && isNightVolumeWindow(responseNow, settings.nightVolumeStartHour, settings.nightVolumeEndHour), audioConfig: audioConfig(settings) }
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const now = Date.now()
  const [loaded, settings, listenersNow, ratings, morRecord] = await Promise.all([
    loadState(now), getSettings(), getListenerCount(), getRatings(),
    readJson<MorSyncRecord>(MOR_SYNC_PATH, EMPTY_MOR_SYNC_RECORD),
  ])
  const { state } = loaded
  if (loaded.changed) await writeJson(STATE_PATH, state)
  const activeTrack = state.tracks.find((track) => track.startAt <= now && trackEnd(track) > now)
  const nextTrack = state.tracks.find((track) => track.startAt > now)
  const morSyncStatus = !settings.morSyncEnabled ? 'MOR SYNC OFF' : !settings.autoDjEnabled ? 'AUTODJ OFF' : morRecord.syncStatus
  const hourArtists = new Set(state.history.filter((h) => h.t > now - ARTIST_WINDOW_MS).map((h) => h.artist))
  const last24Hours = state.history.filter((h) => h.t > now - 24 * 60 * 60 * 1000)
  const last7Days = state.history.filter((h) => h.t > now - 7 * 24 * 60 * 60 * 1000)
  const artistCounts = new Map<string, number>()
  for (const entry of last7Days) artistCounts.set(entry.artist, (artistCounts.get(entry.artist) ?? 0) + 1)
  return {
    ...settings,
    queuePersistenceConfigured: hasQueuePersistence,
    songsThisWeek: state.history.length,
    artistsThisHour: hourArtists.size,
    queued: state.tracks.filter((t) => t.startAt > now).length,
    listenersNow,
    totalRatings: ratings.total,
    morNowPlayingTitle: morRecord.metadata?.title ?? null,
    morNowPlayingArtist: morRecord.metadata?.artist ?? null,
    morNowPlayingRaw: morRecord.metadata?.raw ?? null,
    morNowPlayingStatus: morRecord.metadata?.status ?? null,
    moreFmNowPlaying: activeTrack?.title ?? nextTrack?.title ?? null,
    morSyncStatus,
    morCheckedAt: morRecord.metadata?.checkedAt ?? null,
    dailyPlayedDate: state.dailyPlayedDate,
    dailyPlayedTitles: state.dailyPlayedTitles.slice().reverse().map((entry) => ({ title: entry.title, artist: entry.artist, playedAt: entry.playedAt })),
    playbackStats: {
      last24Hours: last24Hours.length,
      last7Days: last7Days.length,
      topArtists: [...artistCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([artist, plays]) => ({ artist, plays })),
      recentSongs: state.history.slice(-12).reverse().map((entry) => ({ title: entry.title ?? entry.key, artist: entry.artist, playedAt: entry.t })),
    },
  }
}

export async function refreshQueue() {
  const lease = await acquireStationLease(QUEUE_LOCK_PATH, QUEUE_LEASE_MS)
  if (!lease) return
  try {
  const now = Date.now()
  const { state } = await loadState(now)
  // Keep only the song on air; the next request picks a fresh upcoming song.
  state.tracks = state.tracks.filter((t) => t.startAt <= now)
  state.fillingUntil = 0
  await writeJson(STATE_PATH, state)
  } finally {
    await releaseStationLease(lease)
  }
}

export async function recoverFailedTrack(uid: string) {
  const lease = await acquireStationLease(QUEUE_LOCK_PATH, QUEUE_LEASE_MS)
  if (!lease) return getNowPlaying()
  try {
    const now = Date.now()
    const { state } = await loadState(now)
    if (state.tracks.some((track) => track.uid === uid)) {
      state.tracks = state.tracks.filter((track) => track.uid !== uid && track.startAt <= now)
      state.fillingUntil = 0
      await writeJson(STATE_PATH, state)
    }
  } finally {
    await releaseStationLease(lease)
  }
  return getNowPlaying()
}

export async function queueDjMic(asset: { url: string; name: string; duration: number }) {
  const lease = await acquireStationLease(QUEUE_LOCK_PATH, QUEUE_LEASE_MS)
  if (!lease) return
  try {
  const now = Date.now()
  const { state } = await loadState(now)
  if (manilaTime(now).day === 0) {
    await writeJson(STATE_PATH, state)
    return
  }
  const current = state.tracks.filter((track) => track.startAt <= now && trackEnd(track) > now).at(-1)
  state.tracks = current ? [current] : []
  const startAt = current ? trackEnd(current) : now
  state.tracks.push({
    uid: `dj-mic-${startAt}-${Math.random().toString(36).slice(2, 8)}`,
    src: asset.url,
    startAt,
    duration: asset.duration,
    fadeIn: 0,
    fadeOut: 0,
    kind: 'dj-mic',
    title: asset.name,
  })
  await writeJson(STATE_PATH, state)
  } finally {
    await releaseStationLease(lease)
  }
}
