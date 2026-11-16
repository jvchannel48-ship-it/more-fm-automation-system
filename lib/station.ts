import 'server-only'
import { getActiveListenerCount, getSettings, isBlobStorageAvailable, readJson, STATE_PATH, writeJson } from './storage'
import { CHRISTMAS_ARTISTS, isChristmasSlot, isOffAir, languageForSlot, nextSignOn, PROGRAMS, programAt, type Artist, type Language, type Program } from './schedule'
import type { AdminStatus, NowResponse, SongRequest, Track } from './types'

const BETADASH_API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const CROSSFADE_SECONDS = 8
const SONG_REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const ARTIST_WINDOW_MS = 60 * 60 * 1000
const MAX_ARTIST_PLAYS_PER_HOUR = 2
const FILL_LOCK_MS = 45_000

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
  requestQueue: SongRequest[]
}

const EMPTY_STATE: StationState = { tracks: [], songCount: 0, history: [], fillingUntil: 0, requestQueue: [] }

interface SearchItem {
  id: string
  title: string
  url: string
  duration: string
}

const AI_RULE =
  /\bai\b|a\.i\.|artificial intelligence|suno|udio|voice ?clon|cloned|\bclone\b|deepfake|synthetic|generated|remake|re-?imagined|\bcover\b|covered by|tribute|version|parody|impersonat|soundalike/i

const ROCK_RULE = /rock|metal|punk|grunge|emo\b|screamo|hardcore|headbang/i

const QUALITY_RULE =
  /karaoke|instrumental|minus one|full album|nonstop|non-stop|medley|reaction|tutorial|remix|sped ?up|slowed|nightcore|8d|reverb|bass ?boost|mashup|playlist|compilation|1 hour|loop|ringtone|lesson|chords|piano|guitar|violin|saxophone|acoustic|sing-?along|with lyrics in/i

const FOREIGN_RULE =
  /espa[nñ]ol|spanish|en español|portugu|italiano|fran[cç]ais|deutsch|german version|korean|k-?pop|japanese|j-?pop|chinese|mandarin|cantonese|thai|vietnam|indonesia|malay|hindi|bollywood|arabic|turkish|russian|bisaya|cebuano|ilocano|subtitulado|traducida|legendado|letra/i

const TAGALOG_TITLE_RULE = /\b(?:pasko|maligayang|himig ng pasko|araw ng pasko|sinta ko|sa araw ng pasko)\b/i
const CHRISTMAS_TITLE_RULE = /\bchristmas\b|\bxmas\b|\bpasko\b|\bsanta claus\b|\bsilent night\b|\bjingle bells?\b|\bholly\b|\bwinter wonderland\b|\bdeck the halls\b|\bo holy night\b|\bjoy to the world\b|\bwe wish you\b|\blet it snow\b|\bwhite christmas\b|\brudolph\b|\bsleigh ride\b|\bfirst noel\b|\bfeliz navidad\b|\bmost wonderful time\b/i
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
function isAllowed(title: string, artist: Artist, requireTagalog = false) {
  if (NON_LATIN.test(title)) return false
  if (AI_RULE.test(title) || ROCK_RULE.test(title)) return false
  if (QUALITY_RULE.test(title) || FOREIGN_RULE.test(title)) return false
  if (requireTagalog && !TAGALOG_TITLE_RULE.test(title)) return false
  return ` ${normalize(title)} `.includes(` ${normalize(artist.match)} `)
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
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function betadashUrl(params: Record<string, string>) {
  const url = new URL(BETADASH_API_BASE)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

function eligibleArtists(pool: Artist[], history: HistoryEntry[], now: number) {
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
  return shuffle(fresh.length >= 3 ? fresh : allowed)
}

async function findSong(program: Program, songCount: number, history: HistoryEntry[], now: number, christmas = false, languageOverride?: Language) {
  const language = languageOverride ?? languageForSlot(program, songCount)
  const playedIds = new Set(history.map((h) => h.id))
  const playedKeys = new Set(history.map((h) => h.key))
  const candidatesArtists = eligibleArtists(christmas ? CHRISTMAS_ARTISTS[language] : program.pools[language], history, now)
  const variants = christmas
    ? language === 'english' ? ['Christmas song', 'Christmas classic'] : ['Tagalog Christmas song', 'Pasko OPM']
    : program.variants[language]

  for (const artist of candidatesArtists.slice(0, 5)) {
    const artistVariants = program.id === 'classic-love' && artist.name !== 'James Ingram' ? variants.filter((variant) => variant !== 'Just Once') : variants
    const variant = artistVariants[Math.floor(Math.random() * artistVariants.length)] ?? ''
    const data = await fetchJson<{ items?: SearchItem[] }>(
      betadashUrl({ search: `${artist.name} ${variant}`.trim() }),
      15_000,
    )
    const candidates = (data?.items ?? []).filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      if (seconds < 120 || seconds > 420) return false
      const requireTagalog = christmas ? language === 'tagalog' : program.tagalogOnly
      if (!isAllowed(item.title, artist, requireTagalog)) return false
      if (christmas && !CHRISTMAS_TITLE_RULE.test(item.title)) return false
      if (christmas && language === 'english' && TAGALOG_TITLE_RULE.test(item.title)) return false
      return !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
    })

    for (const item of shuffle(candidates.slice(0, 10)).slice(0, 2)) {
      const dl = await fetchJson<{ downloadUrl?: string }>(
        betadashUrl({ download: item.url, type: 'mp3' }),
        30_000,
      )
      if (dl?.downloadUrl) {
        return {
          id: item.id,
          key: songKey(item.title),
          artist: artist.name,
          src: dl.downloadUrl,
          duration: parseDuration(item.duration),
        }
      }
    }
  }
  return null
}

async function findRequestedSong(title: string, artist: string, history: HistoryEntry[], requestQueue: SongRequest[]) {
  const data = await fetchJson<{ items?: SearchItem[] }>(
    betadashUrl({ search: `${title} ${artist}` }),
    15_000,
  )
  const playedIds = new Set([...history.map((entry) => entry.id), ...requestQueue.map((request) => request.id)])
  const playedKeys = new Set([...history.map((entry) => entry.key), ...requestQueue.map((request) => request.key)])
  const titleNeedle = normalize(title)
  const artistNeedle = normalize(artist)
  const candidates = (data?.items ?? [])
    .filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      return seconds >= 120 && seconds <= 420 && !NON_LATIN.test(item.title) && !AI_RULE.test(item.title)
        && !QUALITY_RULE.test(item.title) && !FOREIGN_RULE.test(item.title)
        && !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
    })
    .map((item) => {
      const normalizedTitle = normalize(item.title)
      const score = (normalizedTitle.includes(titleNeedle) ? 2 : 0) + (normalizedTitle.includes(artistNeedle) ? 1 : 0)
      return { item, score }
    })
    .sort((a, b) => b.score - a.score)
  const item = candidates[0]?.item
  if (!item) return null
  const download = await fetchJson<{ downloadUrl?: string }>(
    betadashUrl({ download: item.url, type: 'mp3' }),
    30_000,
  )
  if (!download?.downloadUrl) return null
  return {
    id: item.id,
    key: songKey(item.title),
    src: download.downloadUrl,
    duration: parseDuration(item.duration),
  }
}

function trackEnd(track: Track) {
  return track.startAt + track.duration * 1000
}

function nextStart(state: StationState, now: number) {
  const last = state.tracks.at(-1)
  if (!last) return now
  return Math.max(now, trackEnd(last) - last.fadeOut * 1000)
}

async function fill(state: StationState, now: number, settings: Awaited<ReturnType<typeof getSettings>>) {
  let guard = 0
  while (state.tracks.filter((t) => t.startAt > now).length < 1 && guard++ < 3) {
    const startAt = nextStart(state, now)
    if (isOffAir(startAt)) break
    const previousTrack = state.tracks.at(-1)
    const continuingChristmasPair = settings.christmasEnabled && !settings.tagalogOnlyEnabled && !settings.classicLoveSongsEnabled && previousTrack?.christmasLanguage === 'tagalog'
    const program = settings.tagalogOnlyEnabled
      ? PROGRAMS['sunday-oldies']
      : settings.classicLoveSongsEnabled ? PROGRAMS['classic-love'] : programAt(startAt)
    const fadeIn = state.tracks.at(-1)?.fadeOut ?? 0

    let song = null
    let christmasLanguage: Language | undefined
    if (continuingChristmasPair) {
      song = await findSong(program, state.songCount, state.history, startAt, true, 'english')
      if (song) christmasLanguage = 'english'
    }
    const request = settings.tagalogOnlyEnabled || settings.classicLoveSongsEnabled || continuingChristmasPair
      ? undefined
      : state.requestQueue[0]
    if (!song && request) {
      song = { id: request.id, key: request.key, src: request.src, duration: request.duration, artist: request.artist }
    }
    if (!song && !continuingChristmasPair && !settings.tagalogOnlyEnabled && !settings.classicLoveSongsEnabled && settings.christmasEnabled && isChristmasSlot(state.songCount, startAt)) {
      song = await findSong(program, state.songCount, state.history, startAt, true, 'tagalog')
      if (song) christmasLanguage = 'tagalog'
    }
    if (!song && !request) song = await findSong(program, state.songCount, state.history, startAt)
    if (!song) break
    if (request && song.id === request.id) state.requestQueue.shift()
    // Song lookup can take several seconds; never schedule a fresh start in the past.
    const songStart = Math.max(startAt, Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    state.tracks.push({
      uid: `${song.id}-${songStart}`,
      src: song.src,
      startAt: songStart,
      duration: song.duration,
      fadeIn,
      fadeOut: CROSSFADE_SECONDS,
      christmasLanguage,
    })
    state.history.push({ id: song.id, key: song.key, artist: song.artist, t: songStart })
    state.songCount++
  }
}

async function loadState(now: number) {
  const saved = await readJson<Partial<StationState>>(STATE_PATH, {})
  const state: StationState = {
    ...EMPTY_STATE,
    ...saved,
    requestQueue: Array.isArray(saved.requestQueue) ? saved.requestQueue : [],
  }
  const before = state.tracks.length
  state.tracks = state.tracks.filter((t) => trackEnd(t) >= now - 1000)
  state.history = state.history.filter((h) => h.t > now - SONG_REPEAT_WINDOW_MS)
  return { state, changed: state.tracks.length !== before }
}

export async function enqueueSongRequest(title: string, artist: string) {
  const now = Date.now()
  const { state } = await loadState(now)
  if (state.requestQueue.length >= 10) throw new Error('Puno muna ang song request queue. Subukan ulit mamaya.')
  const resolved = await findRequestedSong(title, artist, state.history, state.requestQueue)
  if (!resolved) throw new Error('Hindi mahanap ang kanta ngayon. Subukan ang ibang title o artist.')
  const request: SongRequest = {
    requestId: crypto.randomUUID(),
    title,
    artist,
    submittedAt: now,
    ...resolved,
  }
  state.requestQueue.push(request)
  await writeJson(STATE_PATH, state)
  return { accepted: true, requestId: request.requestId, position: state.requestQueue.length }
}

export async function getNowPlaying(): Promise<NowResponse> {
  const now = Date.now()
  const [{ state, changed }, settings] = await Promise.all([loadState(now), getSettings()])
  const offAir = isOffAir(now) || !settings.broadcastEnabled

  if (offAir) {
    if (state.tracks.length > 0) {
      state.tracks = []
      await writeJson(STATE_PATH, state)
    }
    return {
      serverTime: Date.now(),
      offAir: true,
      nextOnAir: settings.broadcastEnabled ? nextSignOn(now) : null,
      tracks: [],
    }
  }

  const needsFill = state.tracks.filter((t) => t.startAt > now).length < 1
  if (needsFill && state.fillingUntil < now) {
    state.fillingUntil = now + FILL_LOCK_MS
    await writeJson(STATE_PATH, state)
    await fill(state, now, settings)
    state.fillingUntil = 0
    await writeJson(STATE_PATH, state)
  } else if (changed) {
    await writeJson(STATE_PATH, state)
  }

  return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks }
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const now = Date.now()
  const [{ state }, settings, listenersNow] = await Promise.all([loadState(now), getSettings(), getActiveListenerCount()])
  const hourArtists = new Set(state.history.filter((h) => h.t > now - ARTIST_WINDOW_MS).map((h) => h.artist))
  return {
    ...settings,
    persistenceConfigured: isBlobStorageAvailable(),
    listenersNow,
    songsThisWeek: state.history.length,
    artistsThisHour: hourArtists.size,
    queued: state.tracks.filter((t) => t.startAt > now).length,
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
