import 'server-only'
import { getRatings, getSettings, getSongRequests, hasPersistentStorage, readJson, STATE_PATH, updateSongRequest, writeJson } from './storage'
import { getListenerCount } from './listeners'
import { CHRISTMAS_ARTISTS, isChristmasSlot, isGoldenSundayWindow, isNightVolumeWindow, isOffAir, languageForSlot, manilaDateKey, manilaMonthKey, MANILA_OFFSET_MS, nextSignOff, nextSignOn, PROGRAMS, programAt, type Artist, type Program } from './schedule'
import type { AdminStatus, NowResponse, Track } from './types'

const API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const CROSSFADE_SECONDS = 8
const SONG_REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const ARTIST_WINDOW_MS = 60 * 60 * 1000
const MAX_ARTIST_PLAYS_PER_HOUR = 2
const FILL_LOCK_MS = 45_000
const SOURCE_REFRESH_WINDOW_MS = 110_000
const SOURCE_REFRESH_RETRY_MS = 45_000
const PRELOAD_QUEUE_WITH_ACTIVE_TRACKS = 2
const PRELOAD_QUEUE_WITHOUT_ACTIVE_TRACK = 1
const REJECTED_TITLE_RULE = /\b(?:it['’]?s?\s+show\s*time|show\s*time|live\s+concerts?|concerts?\s+live)\b/i
// Coalesce simultaneous listener polls that land in the same server runtime.
let activeQueueFill: Promise<void> | null = null

interface HistoryEntry {
  id: string
  key: string
  artist: string
  t: number
}

interface StationState {
  tracks: Track[]
  songCount: number
  history: HistoryEntry[]
  fillingUntil: number
  lastBreakSongCount: number
  lastGoldenSundayBreakSongCount: number
  lastNewsDate: string
  seasonalSongCount: number
  seasonalMonthKey: string
}

const EMPTY_STATE: StationState = { tracks: [], songCount: 0, history: [], fillingUntil: 0, lastBreakSongCount: 0, lastGoldenSundayBreakSongCount: 0, lastNewsDate: '', seasonalSongCount: 0, seasonalMonthKey: '' }

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
  const rejectedMetadata = /\blive\s+(?:concert|performance|recording|version|session|show|set|stream|acoustic|cover|at|in|from|on|video|audio|blog)\b|\bconcert\s+(?:live|recording|version|video|audio|footage|performance)\b|\b(?:performed|performing)\s+live\b|\blivestream\b|\bvlog\b|\bwish\s*107(?:[.]?5)?\b|\bwishclusive\b|\bwish[\s-]*bus\b/i.test(metadata)
  return liveTitleTag || rejectedMetadata
}

function isDisallowedSearchItem(item: SearchItem) {
  const liveFlag = [item.live, item.isLive].some((value) => value === true || value === 'true')
  return liveFlag || REJECTED_TITLE_RULE.test(item.title) || hasRejectedRecordingLabel(item.title, item.url, item.channel, item.author, item.uploader, item.source, item.description)
}

async function findSongRequest(request: { title: string; artist: string }, history: HistoryEntry[]) {
  const data = await fetchJson<{ items?: SearchItem[] }>(`${API_BASE}?search=${encodeURIComponent(`${request.title} ${request.artist}`)}`, 8_000)
  const playedIds = new Set(history.map((entry) => entry.id))
  const playedKeys = new Set(history.map((entry) => entry.key))
  const requestedTitle = normalize(request.title)
  const requestedWords = requestedTitle.split(' ').filter((word) => word.length > 1)
  const candidates = (data?.items ?? []).filter((item) => {
    const seconds = parseDuration(item.duration ?? '')
    const normalizedTitle = normalize(item.title)
    const titleMatches = normalizedTitle.includes(requestedTitle) || requestedWords.every((word) => normalizedTitle.includes(word))
    return seconds >= 90 && seconds <= 540 && titleMatches && !isDisallowedSearchItem(item) && !NON_LATIN.test(item.title) && !AI_RULE.test(item.title) && !ROCK_RULE.test(item.title) && !HIGH_ENERGY_DANCE_RULE.test(item.title) && !QUALITY_RULE.test(item.title) && !FOREIGN_RULE.test(item.title) && !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
  }).slice(0, 8)
  const downloads = await Promise.all(candidates.map(async (candidate) => {
    const download = await fetchJson<{ downloadUrl?: string }>(`${API_BASE}?download=${encodeURIComponent(candidate.url)}&type=mp3`, 12_000)
    if (!download?.downloadUrl) return null
    return { id: candidate.id, key: songKey(candidate.title), artist: request.artist, title: `Song request: ${candidate.title}`, src: download.downloadUrl, sourceUrl: candidate.url, sourceRefreshedAt: Date.now(), duration: parseDuration(candidate.duration) }
  }))
  return downloads.find((song) => song !== null) ?? null
}

async function findPendingSongRequest(history: HistoryEntry[]) {
  const pending = (await getSongRequests())
    .filter((request) => request.status === 'pending')
    .sort((a, b) => a.requestedAt - b.requestedAt)
    .slice(0, 12)
  for (const request of pending) {
    const song = await findSongRequest(request, history)
    if (song) return { request, song }
  }
  return null
}

const AI_RULE =
  /\bai\b|a\.i\.|artificial intelligence|suno|udio|voice ?clon|cloned|\bclone\b|deepfake|synthetic|generated|remake|re-?imagined|\bcover\b|covered by|tribute|version|parody|impersonat|soundalike/i

const ROCK_RULE = /rock|metal|punk|grunge|emo\b|screamo|hardcore|headbang/i
const HIGH_ENERGY_DANCE_RULE = /\b(?:edm|techno|trance|dubstep|rave|club mix|dance remix|dance mix|dance version|house music|eurodance|electro dance|hands up)\b/i

const QUALITY_RULE =
  /karaoke|instrumental|minus one|full album|nonstop|non-stop|medley|reaction|tutorial|remix|sped ?up|slowed|nightcore|8d|reverb|bass ?boost|mashup|playlist|compilation|1 hour|loop|ringtone|lesson|chords|piano|guitar|violin|saxophone|acoustic|sing-?along|with lyrics in/i

const FOREIGN_RULE =
  /espa[nñ]ol|spanish|en español|portugu|italiano|fran[cç]ais|deutsch|german version|korean|k-?pop|japanese|j-?pop|chinese|mandarin|cantonese|thai|vietnam|indonesia|malay|hindi|bollywood|arabic|turkish|russian|bisaya|cebuano|ilocano|subtitulado|traducida|legendado|letra/i

const TAGALOG_TITLE_RULE = /\b(?:maging\s+sino\s+ka\s+man|pag[\s-]?ibig|mahal|bakit|puso|sana|nang|wala|walang|hanggang|ikaw|aking|mga|ang|ng|sa|ako|siya|tayo|ito|dahil|paano|huwag|ko|mo|ka|ay|ba|sino|unang|huling|kasama|kita|pangarap|pag-asa|tadhana|sinta|ligaya|buhay|kahit|lahat|minsan|tanging|ngayon|basta|naman|saan|mundo|alaala|na|at|pag|tao|pasko|himig|maligayang)\b/i

const NON_LATIN = /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF\u2100-\u214F]/
const CHRISTMAS_TITLE_RULE = /\bchristmas\b|\bxmas\b|\bpasko\b|\bsanta claus\b|\bsilent night\b|\bjingle bells?\b|\bholly\b|\bwinter wonderland\b|\bmaligayang pasko\b|\bhimig ng pasko\b|\bsa araw ng pasko\b|\bdeck the halls\b|\bo holy night\b|\bjoy to the world\b|\bwe wish you\b|\blet it snow\b|\bwhite christmas\b|\brudolph\b|\bsleigh ride\b|\bfirst noel\b|\bfeliz navidad\b/i

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
  if (REJECTED_TITLE_RULE.test(title) || AI_RULE.test(title) || ROCK_RULE.test(title) || HIGH_ENERGY_DANCE_RULE.test(title)) return false
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

async function findSong(program: Program, songCount: number, history: HistoryEntry[], now: number, christmas = false, shuffleEnabled = true) {
  const language = languageForSlot(program, songCount)
  const playedIds = new Set(history.map((h) => h.id))
  const playedKeys = new Set(history.map((h) => h.key))
  const candidatesArtists = eligibleArtists(christmas ? CHRISTMAS_ARTISTS[language] : program.pools[language], history, now, shuffleEnabled)
  const variants = christmas
    ? language === 'english' ? ['Christmas song', 'Christmas classic'] : ['Tagalog Christmas song', 'Pasko OPM']
    : program.variants[language]

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
      if (isDisallowedSearchItem(item) || !isAllowed(item.title, artist, program.tagalogOnly, credits)) return false
      if (christmas && !CHRISTMAS_TITLE_RULE.test(item.title)) return false
      return !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
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
      src: download.downloadUrl,
      sourceUrl: item.url,
      sourceRefreshedAt: Date.now(),
      duration: parseDuration(item.duration),
    }
  }))
  return downloadResults.find((result) => result !== null) ?? null
}

async function refreshUpcomingSongSources(state: StationState, now: number) {
  const due = state.tracks.filter((track) =>
    track.kind === 'music' && track.sourceUrl && track.startAt > now && track.startAt - now <= SOURCE_REFRESH_WINDOW_MS &&
    (track.sourceRefreshedAt === undefined || now - track.sourceRefreshedAt >= SOURCE_REFRESH_RETRY_MS),
  )
  if (due.length === 0) return false
  const refreshed = await Promise.all(due.map(async (track) => ({
    track,
    download: await fetchJson<{ downloadUrl?: string }>(`${API_BASE}?download=${encodeURIComponent(track.sourceUrl!)}&type=mp3`, 8_000),
  })))
  for (const { track, download } of refreshed) {
    track.sourceRefreshedAt = now
    if (download?.downloadUrl) track.src = download.downloadUrl
  }
  return true
}

function trackEnd(track: Track) {
  return track.startAt + track.duration * 1000
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

async function fill(state: StationState, now: number, settings: Awaited<ReturnType<typeof getSettings>>) {
  const targetFutureTracks = queueAheadTarget(state, now)
  let guard = 0
  while (state.tracks.filter((t) => t.startAt > now).length < targetFutureTracks && guard++ < 6) {
    const previousTrack = state.tracks.at(-1)
    const breakAt = previousTrack ? trackEnd(previousTrack) : now
    if (isGoldenSundayWindow(breakAt)) {
      const localDay = new Date(breakAt + MANILA_OFFSET_MS)
      localDay.setUTCHours(4, 0, 0, 0)
      const sundayStart = localDay.getTime() - MANILA_OFFSET_MS
      const sundaySongs = state.history.filter((entry) => entry.t >= sundayStart && entry.t < breakAt).length
      if (sundaySongs > 0 && sundaySongs % 3 === 0 && state.lastGoldenSundayBreakSongCount !== state.songCount) {
        state.lastGoldenSundayBreakSongCount = state.songCount
        if (settings.goldenSunday) {
          if (previousTrack) previousTrack.fadeOut = 0
          const startAt = Math.max(breakAt, now)
          state.tracks.push({
            uid: `golden-sunday-${startAt}`,
            src: settings.goldenSunday.url,
            startAt,
            duration: settings.goldenSunday.duration,
            fadeIn: 0,
            fadeOut: 0,
            kind: 'golden-sunday',
            title: settings.goldenSunday.name,
          })
          continue
        }
      }
    } else if (state.songCount > 0 && state.songCount % 3 === 0 && state.lastBreakSongCount !== state.songCount) {
      state.lastBreakSongCount = state.songCount
      const spots: Array<{ asset: NonNullable<typeof settings.jingle>; kind: 'jingle' | 'commercial' }> = []
      if (settings.jingleEnabled && settings.jingle) spots.push({ asset: settings.jingle, kind: 'jingle' })
      if (settings.jingleEnabled && settings.commercialEnabled) {
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
    const rotationProgram = settings.tagalogOnlyEnabled
      ? PROGRAMS['sunday-tagalog']
      : settings.goodVibesEnabled ? PROGRAMS['good-vibes']
      : program.id === 'news' ? PROGRAMS['love-mix'] : program
    let fadeIn = state.tracks.at(-1)?.fadeOut ?? 0

    let song = null
    const requestMatch = settings.tagalogOnlyEnabled ? null : await findPendingSongRequest(state.history)
    const requested = requestMatch?.request
    if (requestMatch) {
      song = requestMatch.song
      if (song && settings.autoVoiceEnabled && settings.autoVoiceAnnouncement) {
        const announcementStart = nextStart(state, now)
        const previous = state.tracks.at(-1)
        if (previous) previous.fadeOut = 0
        state.tracks.push({
          uid: `auto-voice-${requested.id}-${announcementStart}`,
          src: settings.autoVoiceAnnouncement.url,
          startAt: announcementStart,
          duration: settings.autoVoiceAnnouncement.duration,
          fadeIn: 0,
          fadeOut: 0,
          kind: 'dj-mic',
          title: settings.autoVoiceAnnouncement.name,
        })
        fadeIn = 0
      }
    }
    if (!song && settings.christmasEnabled && isChristmasSlot(state.seasonalSongCount, startAt)) {
      song = await findSong(rotationProgram, state.songCount, state.history, startAt, true, settings.shuffleEnabled)
    }
    if (!song) song = await findSong(rotationProgram, state.songCount, state.history, startAt, false, settings.shuffleEnabled)
    if (!song) break
    // Song lookup can take several seconds; never schedule a fresh start in the past.
    const songStart = Math.max(nextStart(state, now), Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    state.tracks.push({
      uid: `${song.id}-${songStart}`,
      src: song.src,
      startAt: songStart,
      duration: song.duration,
      fadeIn,
      fadeOut: CROSSFADE_SECONDS,
      sourceUrl: song.sourceUrl,
      sourceRefreshedAt: song.sourceRefreshedAt,
      kind: 'music',
      title: song.title,
    })
    state.history.push({ id: song.id, key: song.key, artist: song.artist, t: songStart })
    state.history = state.history.slice(-settings.rotationPoolSize)
    state.songCount++
    state.seasonalSongCount++
    if (requested && song) await updateSongRequest(requested.id, 'played')
    // One song per request keeps the now-playing endpoint responsive; subsequent polls
    // fill the second queue slot well before the current track finishes.
    break
  }
}

async function loadState(now: number) {
  const state: StationState = { ...EMPTY_STATE, ...(await readJson<Partial<StationState>>(STATE_PATH, {})) }
  state.lastBreakSongCount = state.lastBreakSongCount ?? 0
  state.lastGoldenSundayBreakSongCount = state.lastGoldenSundayBreakSongCount ?? 0
  state.lastNewsDate = state.lastNewsDate ?? ''
  state.seasonalSongCount = state.seasonalSongCount ?? 0
  const monthKey = manilaMonthKey(now)
  if (state.seasonalMonthKey !== monthKey) {
    state.seasonalMonthKey = monthKey
    state.seasonalSongCount = 0
  }
  const before = state.tracks.length
  state.tracks = state.tracks.filter((track) => trackEnd(track) >= now - 1000 && (
    track.startAt <= now || (track.kind !== 'music' && track.kind !== undefined) || (!REJECTED_TITLE_RULE.test(track.title ?? '') && !hasRejectedRecordingLabel(track.title, track.src))
  ))
  state.history = state.history.filter((h) => h.t > now - SONG_REPEAT_WINDOW_MS)
  return { state, changed: state.tracks.length !== before }
}

async function fillQueueIfNeeded(settings: Awaited<ReturnType<typeof getSettings>>) {
  if (activeQueueFill) return activeQueueFill

  const fillPromise = (async () => {
    const now = Date.now()
    const { state, changed } = await loadState(now)
    if (changed) await writeJson(STATE_PATH, state)
    const needsFill = state.tracks.filter((track) => track.startAt > now).length < queueAheadTarget(state, now)
    if (!settings.autoDjEnabled || !needsFill || state.fillingUntil >= now) return

    state.fillingUntil = now + FILL_LOCK_MS
    await writeJson(STATE_PATH, state)
    try {
      await fill(state, now, settings)
    } finally {
      state.fillingUntil = 0
      await writeJson(STATE_PATH, state)
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
  let { state, changed } = loaded
  const offAir = isOffAir(now, settings.signOffHour, settings.signOnHour) || !settings.broadcastEnabled

  if (offAir) {
    if (state.tracks.length > 0) {
      state.tracks = []
      await writeJson(STATE_PATH, state)
    }
    return {
      serverTime: Date.now(),
      offAir: true,
      nextOnAir: settings.broadcastEnabled ? nextSignOn(now, settings.signOnHour) : null,
      signOffAt: settings.broadcastEnabled ? null : now,
      tracks: [],
      nightVolumeActive: settings.nightVolumeEnabled && isNightVolumeWindow(now, settings.nightVolumeStartHour, settings.nightVolumeEndHour),
    }
  }

  const hasActiveTrack = state.tracks.some((track) => track.startAt <= now && trackEnd(track) > now)
  const needsFill = hasPersistentStorage
    ? state.tracks.filter((track) => track.startAt > now).length < queueAheadTarget(state, now)
    : !hasActiveTrack && state.tracks.filter((track) => track.startAt > now).length < PRELOAD_QUEUE_WITHOUT_ACTIVE_TRACK
  if (settings.autoDjEnabled && needsFill) {
    await fillQueueIfNeeded(settings)
    const refreshed = await loadState(Date.now())
    state = refreshed.state
    changed = refreshed.changed
  }

  const responseNow = Date.now()
  if (isOffAir(responseNow, settings.signOffHour, settings.signOnHour) || !settings.broadcastEnabled) {
    state.tracks = []
    await writeJson(STATE_PATH, state)
    return {
      serverTime: responseNow,
      offAir: true,
      nextOnAir: settings.broadcastEnabled ? nextSignOn(responseNow, settings.signOnHour) : null,
      signOffAt: settings.broadcastEnabled ? null : responseNow,
      tracks: [],
      nightVolumeActive: settings.nightVolumeEnabled && isNightVolumeWindow(responseNow, settings.nightVolumeStartHour, settings.nightVolumeEndHour),
    }
  } else {
    const sourcesChanged = await refreshUpcomingSongSources(state, responseNow)
    if (changed || sourcesChanged) await writeJson(STATE_PATH, state)
  }

  return { serverTime: responseNow, offAir: false, nextOnAir: null, signOffAt: nextSignOff(responseNow, settings.signOffHour), tracks: state.tracks, nightVolumeActive: settings.nightVolumeEnabled && isNightVolumeWindow(responseNow, settings.nightVolumeStartHour, settings.nightVolumeEndHour) }
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const now = Date.now()
  const [{ state }, settings, listenersNow, ratings, requests] = await Promise.all([loadState(now), getSettings(), getListenerCount(), getRatings(), getSongRequests()])
  const hourArtists = new Set(state.history.filter((h) => h.t > now - ARTIST_WINDOW_MS).map((h) => h.artist))
  return {
    ...settings,
    songsThisWeek: state.history.length,
    artistsThisHour: hourArtists.size,
    queued: state.tracks.filter((t) => t.startAt > now).length,
    listenersNow,
    totalRatings: ratings.total,
    pendingRequests: requests.filter((request) => request.status === 'pending').length,
  }
}

export async function refreshQueue() {
  const now = Date.now()
  const { state } = await loadState(now)
  // Keep only the song on air; the next request picks a fresh upcoming song.
  state.tracks = state.tracks.filter((t) => t.startAt <= now)
  state.fillingUntil = 0
  await writeJson(STATE_PATH, state)
}

export async function queueDjMic(asset: { url: string; name: string; duration: number }) {
  const now = Date.now()
  const { state } = await loadState(now)
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
}
