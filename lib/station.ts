import 'server-only'
import { getSettings, readJson, STATE_PATH, writeJson } from './storage'
import { getListenerCount } from './listeners'
import { CHRISTMAS_ARTISTS, isChristmasSlot, isGoldenSundayWindow, isOffAir, languageForSlot, manilaMonthKey, MANILA_OFFSET_MS, nextSignOn, programAt, type Artist, type Program } from './schedule'
import type { AdminStatus, NowResponse, Track } from './types'

const API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
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
  lastBreakSongCount: number
  lastGoldenSundayBreakSongCount: number
  seasonalSongCount: number
  seasonalMonthKey: string
}

const EMPTY_STATE: StationState = { tracks: [], songCount: 0, history: [], fillingUntil: 0, lastBreakSongCount: 0, lastGoldenSundayBreakSongCount: 0, seasonalSongCount: 0, seasonalMonthKey: '' }

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
function isAllowed(title: string, artist: Artist) {
  if (NON_LATIN.test(title)) return false
  if (AI_RULE.test(title) || ROCK_RULE.test(title)) return false
  if (QUALITY_RULE.test(title) || FOREIGN_RULE.test(title)) return false
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

async function findSong(program: Program, songCount: number, history: HistoryEntry[], now: number, christmas = false) {
  const language = languageForSlot(program, songCount)
  const playedIds = new Set(history.map((h) => h.id))
  const playedKeys = new Set(history.map((h) => h.key))
  const candidatesArtists = eligibleArtists(christmas ? CHRISTMAS_ARTISTS[language] : program.pools[language], history, now)
  const variants = christmas
    ? language === 'english' ? ['Christmas song', 'Christmas classic'] : ['Tagalog Christmas song', 'Pasko OPM']
    : program.variants[language]

  for (const artist of candidatesArtists.slice(0, 5)) {
    const variant = variants[Math.floor(Math.random() * variants.length)] ?? ''
    const data = await fetchJson<{ items?: SearchItem[] }>(
      `${API_BASE}?search=${encodeURIComponent(`${artist.name} ${variant}`.trim())}`,
      15_000,
    )
    const candidates = (data?.items ?? []).filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      if (seconds < 120 || seconds > 420) return false
      if (!isAllowed(item.title, artist)) return false
      if (christmas && !CHRISTMAS_TITLE_RULE.test(item.title)) return false
      return !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
    })

    for (const item of shuffle(candidates.slice(0, 10)).slice(0, 2)) {
      const dl = await fetchJson<{ downloadUrl?: string }>(
        `${API_BASE}?download=${encodeURIComponent(item.url)}&type=mp3`,
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
    } else if (state.songCount > 0 && state.songCount % 4 === 0 && state.lastBreakSongCount !== state.songCount) {
      state.lastBreakSongCount = state.songCount
      const spots: Array<{ asset: NonNullable<typeof settings.jingle>; kind: 'jingle' | 'commercial' }> = []
      if (settings.jingleEnabled && settings.jingle) spots.push({ asset: settings.jingle, kind: 'jingle' })
      if (settings.commercialEnabled) {
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
    const program = programAt(startAt, settings.signOffHour, settings.signOnHour)
    const fadeIn = state.tracks.at(-1)?.fadeOut ?? 0

    let song = null
    if (isChristmasSlot(state.seasonalSongCount, startAt)) {
      song = await findSong(program, state.songCount, state.history, startAt, true)
    }
    if (!song) song = await findSong(program, state.songCount, state.history, startAt)
    if (!song) break
    // Song lookup can take several seconds; never schedule a fresh start in the past.
    const songStart = Math.max(startAt, Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    state.tracks.push({
      uid: `${song.id}-${songStart}`,
      src: song.src,
      startAt: songStart,
      duration: song.duration,
      fadeIn,
      fadeOut: CROSSFADE_SECONDS,
      kind: 'music',
    })
    state.history.push({ id: song.id, key: song.key, artist: song.artist, t: songStart })
    state.songCount++
    state.seasonalSongCount++
  }
}

async function loadState(now: number) {
  const state: StationState = { ...EMPTY_STATE, ...(await readJson<Partial<StationState>>(STATE_PATH, {})) }
  state.lastBreakSongCount = state.lastBreakSongCount ?? 0
  state.lastGoldenSundayBreakSongCount = state.lastGoldenSundayBreakSongCount ?? 0
  state.seasonalSongCount = state.seasonalSongCount ?? 0
  const monthKey = manilaMonthKey(now)
  if (state.seasonalMonthKey !== monthKey) {
    state.seasonalMonthKey = monthKey
    state.seasonalSongCount = 0
  }
  const before = state.tracks.length
  state.tracks = state.tracks.filter((t) => trackEnd(t) >= now - 1000)
  state.history = state.history.filter((h) => h.t > now - SONG_REPEAT_WINDOW_MS)
  return { state, changed: state.tracks.length !== before }
}

export async function getNowPlaying(): Promise<NowResponse> {
  const now = Date.now()
  const [{ state, changed }, settings] = await Promise.all([loadState(now), getSettings()])
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
  const [{ state }, settings, listenersNow] = await Promise.all([loadState(now), getSettings(), getListenerCount()])
  const hourArtists = new Set(state.history.filter((h) => h.t > now - ARTIST_WINDOW_MS).map((h) => h.artist))
  return {
    ...settings,
    songsThisWeek: state.history.length,
    artistsThisHour: hourArtists.size,
    queued: state.tracks.filter((t) => t.startAt > now).length,
    listenersNow,
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
