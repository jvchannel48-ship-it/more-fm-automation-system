import 'server-only'
import { after } from 'next/server'
import { getActiveListenerCount, getAverageListenerCount, getSettings, isBlobStorageAvailable, readJson, STATE_PATH, NAGA_STATE_PATH, CEBU_STATE_PATH, writeJson } from './storage'
import type { StationId } from './stations'
import {
  isOffAir,
  DZMM_STREAM_URL,
  LOVE_CONNECT_IDENT_DURATION_SECONDS,
  dailyAnnouncementScheduleAt,
  dzmmWindowAt,
  languageForSlot,
  manilaDateKey,
  manilaTime,
  nextSignOn,
  nagaProgramAt,
  programAt,
  type Artist,
  type Program,
} from './schedule'
import { isOriginalArtistTrack } from './song-filter'
import type { AdminStatus, NowResponse, SongRequest, Track } from './types'

const BETADASH_API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const CROSSFADE_SECONDS = 8
const SONG_REPEAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const ARTIST_WINDOW_MS = 60 * 60 * 1000
const MAX_ARTIST_PLAYS_PER_HOUR = 2
const FILL_LOCK_MS = 120_000
const EVENING_TRANSITION_SRC = '/audio/dzmm-evening-transition.mp3'
const EVENING_TRANSITION_SECONDS = 12.2
const LOVE_CONNECT_IDENT_SRC = '/audio/dzmm-love-connect-10pm.mp3'
const TRANSITION_LOOKAHEAD_MS = 120_000
const SATURDAY_ANNOUNCEMENT_SRC = '/audio/rj-fm-daily-announcement.mp3'
const SATURDAY_ANNOUNCEMENT_SECONDS = 13.636
const WEEKDAY_ANNOUNCEMENT_SRC = '/audio/rj-fm-weekday-announcement.mp3'
const WEEKDAY_ANNOUNCEMENT_SECONDS = 5.407
const SATURDAY_ANNOUNCEMENT_TITLE = 'RJ FM Saturday announcement'
const WEEKDAY_ANNOUNCEMENT_TITLE = 'RJ FM weekday announcement'

interface HistoryEntry { id: string; key: string; artist: string; t: number }
interface StationState {
  tracks: Track[]; songCount: number; history: HistoryEntry[]; fillingUntil: number; requestQueue: SongRequest[]
  failedDzmmWindowStart: number | null; dailyAnnouncementDay: string | null; dailyAnnouncementSongCount: number; dailyAnnouncementPlayed: boolean
}
const EMPTY_STATE: StationState = {
  tracks: [], songCount: 0, history: [], fillingUntil: 0, requestQueue: [], failedDzmmWindowStart: null,
  dailyAnnouncementDay: null, dailyAnnouncementSongCount: 0, dailyAnnouncementPlayed: false,
}
interface SearchItem { id: string; title: string; url: string; duration: string; genre?: string }

function parseDuration(value: string): number {
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return 0
  return parts.reduce((acc, n) => acc * 60 + n, 0)
}
function toClientTrack(track: Track): Track {
  const isLocalPublicAsset = track.src.startsWith('/') && !track.src.startsWith('//')
  return { ...track, src: isLocalPublicAsset ? track.src : `/api/audio?src=${encodeURIComponent(track.src)}` }
}
function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
}
function matchesBlockedGenre(value: string, blockedGenres: string[]) {
  const normalized = normalize(value)
  return blockedGenres.some((genre) => {
    const needle = normalize(genre)
    return needle && (normalized === needle || normalized.includes(` ${needle} `) || normalized.startsWith(`${needle} `) || normalized.endsWith(` ${needle}`))
  })
}
function isBlockedProgram(program: Program, blockedGenres: string[]) {
  return matchesBlockedGenre(program.id.replaceAll('-', ' '), blockedGenres)
}
function songKey(title: string) {
  return normalize(title.replace(/\(.*?\)|\[.*?\]/g, ' '))
    .replace(/\b(official|music|video|lyric|lyrics|audio|remastered|remaster|hd|hq|4k|with|mv|live|acoustic|unplugged|radio|edit|single|version|alternate|alt|session|performance)\b/g, ' ')
    .split(' ').filter(Boolean).sort().join(' ')
}
function shuffle<T>(list: T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}
async function fetchJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch { return null }
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
  const allowed = unique.filter((a) => a.name !== lastArtist && (hourCounts.get(a.name) ?? 0) < MAX_ARTIST_PLAYS_PER_HOUR)
  const recent = new Set(history.slice(-12).map((h) => h.artist))
  const fresh = allowed.filter((a) => !recent.has(a.name))
  return shuffle(fresh.length >= 3 ? fresh : allowed)
}
async function findSong(program: Program, songCount: number, history: HistoryEntry[], now: number, blockedGenres: string[], station: StationId = 'main') {
  if (isBlockedProgram(program, blockedGenres)) return null
  const language = languageForSlot(program, songCount)
  const playedIds = new Set(history.map((h) => h.id))
  const playedKeys = new Set(history.map((h) => h.key))
  const pool = program.pools[language]
  const candidatesArtists = eligibleArtists(pool, history, now)
  const variants = program.variants[language]
  for (const artist of candidatesArtists.slice(0, 5)) {
    const variant = variants[Math.floor(Math.random() * variants.length)] ?? ''
    const data = await fetchJson<{ items?: SearchItem[] }>(betadashUrl({ search: `${artist.name} ${variant}`.trim() }), 15_000)
    const candidates = (data?.items ?? []).filter((item) => {
      const seconds = parseDuration(item.duration ?? '')
      if (seconds < 120 || seconds > 420) return false
      const allowDancePop = station === 'naga' && program.id === 'disco'
      if (!isOriginalArtistTrack(item.title, artist, { allowDancePop })) return false
      if (matchesBlockedGenre(`${item.genre ?? ''} ${item.title}`, blockedGenres)) return false
      return !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
    })
    for (const item of shuffle(candidates.slice(0, 10)).slice(0, 2)) {
      const dl = await fetchJson<{ downloadUrl?: string }>(betadashUrl({ download: item.url, type: 'mp3' }), 30_000)
      if (dl?.downloadUrl) return { id: item.id, key: songKey(item.title), title: item.title, artist: artist.name, src: dl.downloadUrl, duration: parseDuration(item.duration) }
    }
  }
  return null
}
async function findRequestedSong(title: string, artist: string, history: HistoryEntry[], requestQueue: SongRequest[]) {
  const data = await fetchJson<{ items?: SearchItem[] }>(betadashUrl({ search: `${title} ${artist}` }), 15_000)
  const playedIds = new Set([...history.map((e) => e.id), ...requestQueue.map((r) => r.id)])
  const playedKeys = new Set([...history.map((e) => e.key), ...requestQueue.map((r) => r.key)])
  const titleNeedle = normalize(title)
  const artistNeedle = normalize(artist)
  const candidates = (data?.items ?? []).filter((item) => {
    const seconds = parseDuration(item.duration ?? '')
    return seconds >= 120 && seconds <= 420 && isOriginalArtistTrack(item.title, { name: artist, match: artist }) && !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
  }).map((item) => {
    const normalizedTitle = normalize(item.title)
    const score = (normalizedTitle.includes(titleNeedle) ? 2 : 0) + (normalizedTitle.includes(artistNeedle) ? 1 : 0)
    return { item, score }
  }).sort((a, b) => b.score - a.score)
  const item = candidates[0]?.item
  if (!item) return null
  const download = await fetchJson<{ downloadUrl?: string }>(betadashUrl({ download: item.url, type: 'mp3' }), 30_000)
  if (!download?.downloadUrl) return null
  return { id: item.id, key: songKey(item.title), src: download.downloadUrl, duration: parseDuration(item.duration) }
}
function trackEnd(track: Track) { return track.startAt + track.duration * 1000 }
function nextStart(state: StationState, now: number) {
  const last = state.tracks.at(-1)
  if (!last) return now
  return Math.max(now, trackEnd(last) - last.fadeOut * 1000)
}
async function fill(state: StationState, now: number, sundayScheduleEnabled: boolean, blockedGenres: string[], station: StationId = 'main') {
  let guard = 0
  while (state.tracks.filter((t) => t.startAt > now).length < 1 && guard++ < 3) {
    const startAt = nextStart(state, now)
    if (isOffAir(startAt)) break
    const program = station === 'naga' ? nagaProgramAt(startAt) : programAt(startAt, sundayScheduleEnabled)
    const fadeIn = state.tracks.at(-1)?.fadeOut ?? 0
    const request = state.requestQueue[0]
    const song = request
      ? { id: request.id, key: request.key, title: request.title, src: request.src, duration: request.duration, artist: request.artist }
      : await findSong(program, state.songCount, state.history, startAt, blockedGenres, station)
    if (!song) break
    if (request) state.requestQueue.shift()
    const songStart = Math.max(startAt, Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    state.tracks.push({ uid: `${song.id}-${songStart}`, src: song.src, startAt: songStart, duration: song.duration, fadeIn, fadeOut: CROSSFADE_SECONDS, kind: 'music', title: song.title, artist: song.artist })
    state.history.push({ id: song.id, key: song.key, artist: song.artist, t: songStart })
    state.songCount++
    const announcementSchedule = dailyAnnouncementScheduleAt(songStart)
    const inAnnouncementWindow = announcementSchedule && songStart >= announcementSchedule.availableFrom && songStart < announcementSchedule.expiresAt
    if (inAnnouncementWindow) state.dailyAnnouncementSongCount++
    const announcementSeconds = announcementSchedule?.kind === 'saturday' ? SATURDAY_ANNOUNCEMENT_SECONDS : WEEKDAY_ANNOUNCEMENT_SECONDS
    const announcementEndAt = songStart + song.duration * 1000 + announcementSeconds * 1000
    if (!state.dailyAnnouncementPlayed && announcementSchedule && state.dailyAnnouncementSongCount >= announcementSchedule.songsRequired && inAnnouncementWindow && announcementEndAt <= announcementSchedule.expiresAt) {
      state.tracks.push({ uid: `rj-fm-daily-announcement-${state.dailyAnnouncementDay}`, src: announcementSchedule.kind === 'saturday' ? SATURDAY_ANNOUNCEMENT_SRC : WEEKDAY_ANNOUNCEMENT_SRC, startAt: songStart + song.duration * 1000, duration: announcementSeconds, fadeIn: 0, fadeOut: CROSSFADE_SECONDS, kind: 'dj-mic', title: announcementSchedule.kind === 'saturday' ? SATURDAY_ANNOUNCEMENT_TITLE : WEEKDAY_ANNOUNCEMENT_TITLE, artist: 'RJ FM' })
      state.dailyAnnouncementPlayed = true
    }
  }
}
async function loadState(now: number, path = STATE_PATH) {
  const saved = await readJson<Partial<StationState>>(path, {})
  const state: StationState = {
    ...EMPTY_STATE, ...saved,
    failedDzmmWindowStart: typeof saved.failedDzmmWindowStart === 'number' ? saved.failedDzmmWindowStart : null,
    requestQueue: Array.isArray(saved.requestQueue) ? saved.requestQueue : [],
    dailyAnnouncementDay: typeof saved.dailyAnnouncementDay === 'string' ? saved.dailyAnnouncementDay : null,
    dailyAnnouncementSongCount: typeof saved.dailyAnnouncementSongCount === 'number' ? saved.dailyAnnouncementSongCount : 0,
    dailyAnnouncementPlayed: saved.dailyAnnouncementPlayed === true,
  }
  const today = manilaDateKey(now)
  if (state.dailyAnnouncementDay !== today) { state.dailyAnnouncementDay = today; state.dailyAnnouncementSongCount = 0; state.dailyAnnouncementPlayed = false }
  const announcementSchedule = dailyAnnouncementScheduleAt(now)
  if (!announcementSchedule || now >= announcementSchedule.expiresAt) state.dailyAnnouncementPlayed = true
  const before = state.tracks.length
  state.tracks = state.tracks.filter((t) => {
    if (t.kind !== 'dj-mic' || t.uid.startsWith('dzmm-transition-') || t.uid.startsWith('dzmm-love-connect-')) return trackEnd(t) >= now - 1000
    const schedule = dailyAnnouncementScheduleAt(now)
    const isActive = t.startAt <= now && trackEnd(t) > now
    return Boolean((schedule && now >= schedule.availableFrom && now < schedule.expiresAt || isActive) && trackEnd(t) >= now - 1000)
  })
  state.history = state.history.filter((h) => h.t > now - SONG_REPEAT_WINDOW_MS)
  return { state, changed: state.tracks.length !== before }
}
let songRequestQueue: Promise<void> = Promise.resolve()
async function withSongRequestLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = songRequestQueue
  let release!: () => void
  songRequestQueue = new Promise<void>((resolve) => { release = resolve })
  await previous
  try { return await operation() } finally { release() }
}
export async function enqueueSongRequest(title: string, artist: string, beforeEnqueue?: () => Promise<void>) {
  return withSongRequestLock(async () => {
    const now = Date.now()
    const { state } = await loadState(now)
    if (state.requestQueue.length >= 10) throw new Error('The request queue is full. Please try again later.')
    const resolved = await findRequestedSong(title, artist, state.history, state.requestQueue)
    if (!resolved) throw new Error("We couldn't find that song right now. Please try a different title or artist.")
    await beforeEnqueue?.()
    const request: SongRequest = { requestId: crypto.randomUUID(), title, artist, submittedAt: now, ...resolved }
    state.requestQueue.push(request)
    await writeJson(STATE_PATH, state)
    return { accepted: true, requestId: request.requestId, position: state.requestQueue.length }
  })
}
export async function getNowPlaying(options: { skipFill?: boolean; station?: StationId } = {}): Promise<NowResponse> {
  const station: StationId = options.station ?? 'main'
  const now = Date.now()
  if (station === 'cebu' || station === 'naga') {
    // Independent music queues — never mirror main (different songs).
    const statePath = station === 'naga' ? NAGA_STATE_PATH : CEBU_STATE_PATH
    const [{ state, changed }, settings, mainSnap] = await Promise.all([
      loadState(now, statePath),
      getSettings(),
      loadState(now, STATE_PATH),
    ])
    const offAir = isOffAir(now) || !settings.broadcastEnabled
    if (offAir) {
      if (state.tracks.length > 0) { state.tracks = []; await writeJson(statePath, state) }
      return { serverTime: Date.now(), offAir: true, nextOnAir: settings.broadcastEnabled ? nextSignOn(now) : null, tracks: [], bassBoostDb: settings.bassBoostDb }
    }
    state.tracks = state.tracks.filter((track) => track.kind !== 'live' && !track.uid.startsWith('dzmm-'))
    // Block titles currently on main so the two stations do not play the same song.
    const mainLiveKeys = new Set(
      mainSnap.state.tracks
        .filter((track) => track.kind === 'music' && track.startAt <= now && trackEnd(track) > now)
        .map((track) => songKey(track.title ?? '')),
    )
    if (mainLiveKeys.size) {
      state.history = [
        ...state.history,
        ...[...mainLiveKeys].map((key) => ({ id: `block-main-${key}`, key, artist: 'main-live', t: now })),
      ].slice(-80)
    }
    const needsFill = state.tracks.filter((track) => track.startAt > now).length < 1
    if (needsFill && state.fillingUntil < now && !options.skipFill) {
      state.fillingUntil = now + FILL_LOCK_MS
      await writeJson(statePath, state)
      await fill(state, now, settings.sundayScheduleEnabled, settings.blockedGenres, station)
      state.fillingUntil = 0
      await writeJson(statePath, state)
    } else if (changed) { await writeJson(statePath, state) }
    return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb }
  }
  const [{ state, changed }, settings] = await Promise.all([loadState(now), getSettings()])
  const offAir = isOffAir(now) || !settings.broadcastEnabled
  if (offAir) {
    if (state.tracks.length > 0) { state.tracks = []; await writeJson(STATE_PATH, state) }
    return { serverTime: Date.now(), offAir: true, nextOnAir: settings.broadcastEnabled ? nextSignOn(now) : null, tracks: [], bassBoostDb: settings.bassBoostDb }
  }
  const scheduledDzmm = dzmmWindowAt(now)
  const upcomingDzmm = dzmmWindowAt(now + TRANSITION_LOOKAHEAD_MS)
  const dzmmWindow = scheduledDzmm ?? (upcomingDzmm && upcomingDzmm.startAt > now && upcomingDzmm.startAt - now <= TRANSITION_LOOKAHEAD_MS ? upcomingDzmm : null)
  if (dzmmWindow && state.failedDzmmWindowStart !== dzmmWindow.startAt) {
    const liveUid = `dzmm-${dzmmWindow.startAt}`
    const transitionStartAt = dzmmWindow.endAt - CROSSFADE_SECONDS * 1000
    const isEveningHandoff = manilaTime(dzmmWindow.startAt).hour === 18
    const isLoveConnectHandoff = manilaTime(dzmmWindow.startAt).hour === 22
    const transitionTrack: Track | null = isEveningHandoff
      ? { uid: `dzmm-transition-${dzmmWindow.startAt}`, src: EVENING_TRANSITION_SRC, startAt: dzmmWindow.startAt - EVENING_TRANSITION_SECONDS * 1000, duration: EVENING_TRANSITION_SECONDS, fadeIn: 0, fadeOut: 0, kind: 'dj-mic', title: 'DZMM evening transition announcement', artist: 'RJ FM 93.5 station announcement' }
      : isLoveConnectHandoff
        ? { uid: `dzmm-love-connect-${dzmmWindow.startAt}`, src: LOVE_CONNECT_IDENT_SRC, startAt: dzmmWindow.startAt, duration: LOVE_CONNECT_IDENT_DURATION_SECONDS, fadeIn: 0, fadeOut: 0, kind: 'dj-mic', title: 'Love Connect', artist: 'Coach Vanessa Antonio' }
        : null
    const announcementStartAt = transitionTrack?.startAt ?? transitionStartAt
    const liveTrack: Track = { uid: liveUid, src: DZMM_STREAM_URL, startAt: dzmmWindow.liveStartAt, duration: (dzmmWindow.endAt - dzmmWindow.liveStartAt) / 1000, fadeIn: 0, fadeOut: CROSSFADE_SECONDS, kind: 'live', title: 'DZMM Radyo Patrol 630', artist: 'DZMM live broadcast' }
    const transitionMusic = state.tracks.filter((track) => track.kind === 'music' && track.startAt < announcementStartAt && trackEnd(track) > now && now < announcementStartAt).map((track) => ({ ...track, duration: Math.max(1, (announcementStartAt - track.startAt) / 1000), fadeOut: 0 }))
    const nextTracks = [...transitionMusic, ...(transitionTrack ? [transitionTrack] : []), liveTrack].sort((a, b) => a.startAt - b.startAt)
    const tracksChanged = nextTracks.length !== state.tracks.length || nextTracks.some((track, index) => { const current = state.tracks[index]; return current?.uid !== track.uid || current?.src !== track.src || current?.fadeOut !== track.fadeOut || current?.startAt !== track.startAt })
    if (tracksChanged) state.tracks = nextTracks
    const hasHandoffTrack = state.tracks.some((track) => track.kind === 'music' && track.startAt >= transitionStartAt)
    if (!hasHandoffTrack && state.fillingUntil < now) {
      const fillLock = now + FILL_LOCK_MS
      state.fillingUntil = fillLock
      await writeJson(STATE_PATH, state)
      after(async () => {
        try {
          const { state: latest } = await loadState(Date.now())
          if (latest.fillingUntil !== fillLock) return
          if (latest.failedDzmmWindowStart !== dzmmWindow.startAt && latest.tracks.some((track) => track.uid === liveUid) && !latest.tracks.some((track) => track.kind === 'music' && track.startAt >= transitionStartAt)) {
            const requests = latest.requestQueue
            latest.requestQueue = []
            try { await fill(latest, transitionStartAt, settings.sundayScheduleEnabled, settings.blockedGenres, 'main') } finally { latest.requestQueue = requests }
          }
          const { state: current } = await loadState(Date.now())
          if (current.fillingUntil !== fillLock || current.failedDzmmWindowStart === dzmmWindow.startAt) return
          latest.requestQueue = current.requestQueue
          const ready = latest.tracks.some((track) => track.kind === 'music' && track.startAt >= transitionStartAt)
          latest.fillingUntil = 0
          if (!ready) latest.failedDzmmWindowStart = dzmmWindow.startAt
          await writeJson(STATE_PATH, latest)
        } catch {
          const { state: retryState } = await loadState(Date.now())
          if (retryState.fillingUntil === fillLock) {
            retryState.fillingUntil = 0
            retryState.failedDzmmWindowStart = dzmmWindow.startAt
            await writeJson(STATE_PATH, retryState)
          }
        }
      })
    } else if (tracksChanged) { await writeJson(STATE_PATH, state) }
  }
  const inLive = state.tracks.some((t) => t.kind === 'live' && t.startAt <= now && trackEnd(t) > now)
  const needsFill = !inLive && state.tracks.filter((t) => t.startAt > now).length < 1
  if (needsFill && state.fillingUntil < now && !options.skipFill) {
    state.fillingUntil = now + FILL_LOCK_MS
    await writeJson(STATE_PATH, state)
    await fill(state, now, settings.sundayScheduleEnabled, settings.blockedGenres, 'main')
    state.fillingUntil = 0
    await writeJson(STATE_PATH, state)
  } else if (changed) { await writeJson(STATE_PATH, state) }
  return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb }
}
export async function getAdminStatus(): Promise<AdminStatus> {
  const now = Date.now()
  const [{ state }, settings, listenersNow, averageListeners] = await Promise.all([loadState(now), getSettings(), getActiveListenerCount(), getAverageListenerCount()])
  const hourArtists = new Set(state.history.filter((h) => h.t > now - ARTIST_WINDOW_MS).map((h) => h.artist))
  return { ...settings, persistenceConfigured: isBlobStorageAvailable(), listenersNow, averageListeners, songsThisWeek: state.history.length, artistsThisHour: hourArtists.size, queued: state.tracks.filter((t) => t.startAt > now).length }
}
export async function refreshQueue() {
  const now = Date.now()
  for (const path of [STATE_PATH, NAGA_STATE_PATH, CEBU_STATE_PATH]) {
    const { state } = await loadState(now, path)
    state.tracks = state.tracks.filter((track) => track.startAt <= now)
    state.fillingUntil = 0
    await writeJson(path, state)
  }
}
export async function recoverFailedTrack(uid: string, options: { station?: StationId } = {}): Promise<NowResponse> {
  const station: StationId = options.station ?? 'main'
  if (station === 'cebu' || station === 'naga') return getNowPlaying({ station })
  const now = Date.now()
  const [{ state }, settings] = await Promise.all([loadState(now), getSettings()])
  const failed = state.tracks.find((track) => track.uid === uid)
  if (!failed) return getNowPlaying({ station })
  const activeTracks = state.tracks.filter((track) => track.uid !== uid && track.startAt <= now && trackEnd(track) > now)
  const currentWindow = dzmmWindowAt(now)
  const failedLiveWindow = failed.kind === 'live' && currentWindow && uid === `dzmm-${currentWindow.startAt}`
  const fallback = state.tracks.filter((track) => track.uid !== uid && track.kind === 'music' && track.startAt > now).sort((a, b) => a.startAt - b.startAt)[0]
  if (failedLiveWindow && currentWindow) state.failedDzmmWindowStart = currentWindow.startAt
  state.tracks = activeTracks.filter((track) => !failedLiveWindow || track.kind !== 'live')
  if (state.tracks.length === 0 && fallback) state.tracks.push({ ...fallback, startAt: now, fadeIn: 1 })
  state.fillingUntil = 0
  const hasCurrentMusic = state.tracks.some((track) => track.kind === 'music' && track.startAt <= now && trackEnd(track) > now)
  const hasUpcomingMusic = state.tracks.some((track) => track.kind === 'music' && track.startAt > now)
  if (!hasCurrentMusic && !hasUpcomingMusic) await fill(state, now, settings.sundayScheduleEnabled, settings.blockedGenres, 'main')
  await writeJson(STATE_PATH, state)
  return getNowPlaying({ skipFill: true, station })
}
