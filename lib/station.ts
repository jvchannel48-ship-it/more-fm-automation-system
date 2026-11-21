import 'server-only'
import { after } from 'next/server'
import { getActiveListenerCount, getAverageListenerCount, getSettings, isBlobStorageAvailable, readJson, STATE_PATH, NAGA_STATE_PATH, CEBU_STATE_PATH, GENSAN_STATE_PATH, CDO_STATE_PATH, DAVAO_STATE_PATH, ILOILO_STATE_PATH, MASBATE_STATE_PATH, LIVE_DJ_PATH, writeJson } from './storage'
import { STATIONS, type StationId } from './stations'
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
  nextSignOnAtHour,
  isOffAirHours,
  masbateProgramAt,
  nagaProgramAt,
  programAt,
  type Artist,
  type Program,
} from './schedule'
import { effectiveBlockedGenres, isAllowedStationTrack, isBlockedProgramGenre, isOriginalArtistTrack } from './song-filter'
import type { AdminStatus, LiveDjState, NowResponse, SongRequest, Track } from './types'

const BETADASH_API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const CROSSFADE_SECONDS = 8
const ANNOUNCEMENT_CROSSFADE_SECONDS = 5
const PRELOAD_AHEAD_TRACKS = 2
const NAGA_FOLLOW_DELAY_MS = 12_000
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
const NATIONWIDE_IDENT_FADE_SECONDS = 1.5
const NATIONWIDE_IDENT_BY_STATION: Partial<Record<StationId, { src: string; duration: number; title: string }>> = {
  main: { src: '/audio/rjfmmanila.mp3', duration: 6.03, title: 'RJ FM Manila' },
  naga: { src: '/audio/rjfmnagacity.mp3', duration: 5.96, title: 'RJ FM Naga City' },
  cebu: { src: '/audio/rjfmcebu.mp3', duration: 5.64, title: 'RJ FM Cebu' },
  gensan: { src: '/audio/rjfmgeneralsantos.mp3', duration: 6.43, title: 'RJ FM General Santos' },
  cdo: { src: '/audio/rjfmcagayanDeoro.mp3', duration: 6.61, title: 'RJ FM Cagayan de Oro' },
  davao: { src: '/audio/rjfmdavao.mp3', duration: 5.88, title: 'RJ FM Davao' },
  iloilo: { src: '/audio/rjfmiloilo.mp3', duration: 6.27, title: 'RJ FM Iloilo' },
  masbate: { src: '/audio/rjfmmasbate.mp3', duration: 5.49, title: 'RJ FM Masbate' },
}

interface HistoryEntry { id: string; key: string; artist: string; t: number }
interface StationState {
  tracks: Track[]; songCount: number; history: HistoryEntry[]; fillingUntil: number; requestQueue: SongRequest[]
  failedDzmmWindowStart: number | null; dailyAnnouncementDay: string | null; dailyAnnouncementSongCount: number; dailyAnnouncementPlayed: boolean
}
const EMPTY_STATE: StationState = {
  tracks: [], songCount: 0, history: [], fillingUntil: 0, requestQueue: [], failedDzmmWindowStart: null,
  dailyAnnouncementDay: null, dailyAnnouncementSongCount: 0, dailyAnnouncementPlayed: false,
}

async function getLiveDj(): Promise<LiveDjState | null> {
  const state = await readJson<LiveDjState>(LIVE_DJ_PATH, { active: false, name: '', updatedAt: 0 })
  if (!state.active) return { ...state, active: false }
  if (state.updatedAt && Date.now() - state.updatedAt > 30 * 60 * 1000) {
    const cleared = { active: false, name: state.name, updatedAt: Date.now() }
    await writeJson(LIVE_DJ_PATH, cleared)
    return cleared
  }
  return state
}
interface SearchItem { id: string; title: string; url: string; duration: string; genre?: string; channel?: string; channelTitle?: string; uploader?: string; description?: string; artist?: string }

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
function genresForSettings(settings: { blockedGenres: string[]; discoEnabled?: boolean }) {
  return effectiveBlockedGenres(settings.blockedGenres, { discoEnabled: settings.discoEnabled !== false })
}
function matchesBlockedGenre(value: string, blockedGenres: string[]) {
  const normalized = normalize(value)
  return blockedGenres.some((genre) => {
    const needle = normalize(genre)
    return needle && (normalized === needle || normalized.includes(` ${needle} `) || normalized.startsWith(`${needle} `) || normalized.endsWith(` ${needle}`))
  })
}
function isBlockedProgram(program: Program, blockedGenres: string[]) {
  return isBlockedProgramGenre(program.id, blockedGenres)
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
      const allowDancePop = ['main', 'naga', 'cebu', 'davao', 'iloilo'].includes(station) && program.id === 'disco'
      if (!isOriginalArtistTrack(item.title, artist, { allowDancePop })) return false
      if (!isAllowedStationTrack({ title: item.title, genre: [item.genre, item.channel, item.channelTitle, item.uploader, item.description, item.artist].filter(Boolean).join(' '), blockedGenres })) return false
      if (matchesBlockedGenre(`${item.genre ?? ''} ${item.title}`, blockedGenres)) return false
      return !playedIds.has(item.id) && !playedKeys.has(songKey(item.title))
    })
    for (const item of shuffle(candidates.slice(0, 10)).slice(0, 2)) {
      const dl = await fetchJson<{ downloadUrl?: string }>(betadashUrl({ download: item.url, type: 'mp3' }), 30_000)
      if (dl?.downloadUrl) return { id: item.id, key: songKey(item.title), artist: artist.name, title: item.title, src: dl.downloadUrl, duration: parseDuration(item.duration) }
    }
  }
  return null
}
async function findRequestedSong(title: string, artist: string, history: HistoryEntry[], requestQueue: SongRequest[], blockedGenres: string[]) {
  const queries = [...new Set([
    `${title} ${artist}`,
    `"${title}" ${artist}`,
    `${artist} ${title} official audio`,
  ])]
  const results = await Promise.all(queries.map((search) =>
    fetchJson<{ items?: SearchItem[] }>(betadashUrl({ search }), 15_000),
  ))
  const items = [...new Map(results.flatMap((result) => result?.items ?? []).map((item) => [item.id, item])).values()]
  const playedIds = new Set([...history.map((e) => e.id), ...requestQueue.map((r) => r.id)])
  const playedKeys = new Set([...history.map((e) => e.key), ...requestQueue.map((r) => r.key)])
  const titleNeedle = normalize(title)
  const artistNeedle = normalize(artist)
  const candidates = items.filter((item) => {
    const seconds = parseDuration(item.duration ?? '')
    const officialAttribution = [item.artist, item.channelTitle, item.channel, item.uploader]
      .filter(Boolean).join(' ')
    const hasOriginalArtistCredit = isOriginalArtistTrack(item.title, { name: artist, match: artist })
      || (Boolean(officialAttribution) && isOriginalArtistTrack(`${item.title} - ${officialAttribution}`, { name: artist, match: artist }))
    return seconds >= 120 && seconds <= 420
      && normalize(item.title).includes(titleNeedle)
      && hasOriginalArtistCredit
      && isAllowedStationTrack({ title: item.title, genre: [item.genre, item.channel, item.channelTitle, item.uploader, item.description, item.artist].filter(Boolean).join(' '), blockedGenres })
      && !playedIds.has(item.id)
      && !playedKeys.has(songKey(item.title))
  }).map((item) => {
    const metadata = normalize([item.artist, item.channelTitle, item.channel, item.uploader].filter(Boolean).join(' '))
    const normalizedTitle = normalize(item.title)
    const score = (normalizedTitle.startsWith(titleNeedle) ? 4 : 0)
      + (normalizedTitle.includes(titleNeedle) ? 2 : 0)
      + (metadata.includes(artistNeedle) ? 4 : 0)
    return { item, score }
  }).sort((a, b) => b.score - a.score)
  for (const { item } of candidates) {
    const download = await fetchJson<{ downloadUrl?: string }>(betadashUrl({ download: item.url, type: 'mp3' }), 30_000)
    if (download?.downloadUrl) {
      return { id: item.id, key: songKey(item.title), src: download.downloadUrl, duration: parseDuration(item.duration) }
    }
  }
  return null
}
function trackEnd(track: Track) { return track.startAt + track.duration * 1000 }
function nextStart(state: StationState, now: number) {
  const last = state.tracks.at(-1)
  if (!last) return now
  // A station ID / announcement must finish before the next song begins.
  // Do not apply the normal music crossfade to voice clips.
  const nextAt = last.kind === 'dj-mic'
    ? trackEnd(last)
    : trackEnd(last) - last.fadeOut * 1000
  return Math.max(now, nextAt)
}

/** RJ FM Naga follows Manila music: same songs, starting shortly after Manila finishes each track. */
function buildNagaFollowTracks(mainState: StationState, now: number, nationwideEnabled: boolean): Track[] {
  const manilaMusic = mainState.tracks.filter((track) => track.kind === 'music' && track.src).sort((a, b) => a.startAt - b.startAt)
  const out: Track[] = []
  const ident = NATIONWIDE_IDENT_BY_STATION.naga
  const offset = Math.max(0, mainState.songCount - manilaMusic.length)
  let shiftMs = 0
  let nextFadeIn: number | null = null
  for (let index = 0; index < manilaMusic.length; index++) {
    const track = manilaMusic[index]
    const startAt = track.startAt + NAGA_FOLLOW_DELAY_MS + shiftMs
    const addIdent = nationwideEnabled && Boolean(ident) && (offset + index + 1) % 2 === 0
    if (startAt + track.duration * 1000 >= now - 2_000) out.push({ uid: `naga-follow-${track.uid}`, src: track.src, startAt, duration: track.duration, fadeIn: nextFadeIn ?? Math.min(CROSSFADE_SECONDS, track.fadeIn || CROSSFADE_SECONDS), fadeOut: addIdent ? 0 : Math.min(CROSSFADE_SECONDS, track.fadeOut || CROSSFADE_SECONDS), kind: 'music', title: track.title, artist: track.artist })
    if (addIdent && ident) {
      const identStartAt = startAt + track.duration * 1000
      if (identStartAt + ident.duration * 1000 >= now - 2_000) out.push({ uid: `rjfm-nationwide-naga-${track.uid}`, src: ident.src, startAt: identStartAt, duration: ident.duration, fadeIn: 0.25, fadeOut: NATIONWIDE_IDENT_FADE_SECONDS, kind: 'dj-mic', title: ident.title, artist: 'RJ FM Nationwide' })
      shiftMs += (CROSSFADE_SECONDS + ident.duration - NATIONWIDE_IDENT_FADE_SECONDS) * 1000
      nextFadeIn = NATIONWIDE_IDENT_FADE_SECONDS
    } else nextFadeIn = null
  }
  return out.sort((a, b) => a.startAt - b.startAt)
}

function statePathFor(station: StationId) {
  switch (station) {
    case 'naga': return NAGA_STATE_PATH
    case 'cebu': return CEBU_STATE_PATH
    case 'gensan': return GENSAN_STATE_PATH
    case 'cdo': return CDO_STATE_PATH
    case 'davao': return DAVAO_STATE_PATH
    case 'iloilo': return ILOILO_STATE_PATH
    case 'masbate': return MASBATE_STATE_PATH
    default: return STATE_PATH
  }
}
async function fill(state: StationState, now: number, sundayScheduleEnabled: boolean, blockedGenres: string[], station: StationId = 'main', nationwideEnabled = true) {
  let guard = 0
  while (state.tracks.filter((t) => t.startAt > now).length < PRELOAD_AHEAD_TRACKS && guard++ < 6) {
    const startAt = nextStart(state, now)
    if (isOffAir(startAt)) break
    const program = station === 'naga'
      ? nagaProgramAt(startAt)
      : station === 'masbate'
        ? masbateProgramAt(startAt)
        : programAt(startAt, sundayScheduleEnabled)
    const fadeIn = state.tracks.at(-1)?.fadeOut ?? 0
    const stationIdent = NATIONWIDE_IDENT_BY_STATION[station]
    const identAfterSong = nationwideEnabled && Boolean(stationIdent) && (state.songCount + 1) % 2 === 0
    const request = state.requestQueue[0]
    const song = request
      ? { id: request.id, key: request.key, title: request.title, src: request.src, duration: request.duration, artist: request.artist }
      : await findSong(program, state.songCount, state.history, startAt, blockedGenres, station)
    if (!song) break
    if (request) state.requestQueue.shift()
    const songStart = Math.max(startAt, Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    state.tracks.push({ uid: `${song.id}-${songStart}`, src: song.src, startAt: songStart, duration: song.duration, fadeIn, fadeOut: identAfterSong ? 0 : CROSSFADE_SECONDS, kind: 'music', title: song.title, artist: song.artist })
    state.history.push({ id: song.id, key: song.key, artist: song.artist, t: songStart })
    state.songCount++
    const announcementSchedule = dailyAnnouncementScheduleAt(songStart)
    const inAnnouncementWindow = announcementSchedule && songStart >= announcementSchedule.availableFrom && songStart < announcementSchedule.expiresAt
    if (inAnnouncementWindow) state.dailyAnnouncementSongCount++
    const announcementSeconds = announcementSchedule?.kind === 'saturday' ? SATURDAY_ANNOUNCEMENT_SECONDS : WEEKDAY_ANNOUNCEMENT_SECONDS
    const announcementEndAt = songStart + song.duration * 1000 + announcementSeconds * 1000
    let announcementAdded = false
    if (!state.dailyAnnouncementPlayed && announcementSchedule && state.dailyAnnouncementSongCount >= announcementSchedule.songsRequired && inAnnouncementWindow && announcementEndAt <= announcementSchedule.expiresAt) {
      const prev = state.tracks.at(-1)
      if (prev && prev.kind === 'music') prev.fadeOut = Math.min(prev.fadeOut || CROSSFADE_SECONDS, 3)
      const voxStart = songStart + song.duration * 1000
      const voxFadeOut = Math.min(ANNOUNCEMENT_CROSSFADE_SECONDS, Math.max(2, announcementSeconds * 0.4))
      state.tracks.push({
        uid: `rj-fm-daily-announcement-${state.dailyAnnouncementDay}`,
        src: announcementSchedule.kind === 'saturday' ? SATURDAY_ANNOUNCEMENT_SRC : WEEKDAY_ANNOUNCEMENT_SRC,
        startAt: voxStart,
        duration: announcementSeconds,
        fadeIn: 0.4,
        fadeOut: voxFadeOut,
        kind: 'dj-mic',
        title: announcementSchedule.kind === 'saturday' ? SATURDAY_ANNOUNCEMENT_TITLE : WEEKDAY_ANNOUNCEMENT_TITLE,
        artist: 'RJ FM',
      })
      state.dailyAnnouncementPlayed = true
      announcementAdded = true
    }
    if (identAfterSong && stationIdent) {
      // Always air the station ID after every second song. If a scheduled daily
      // announcement also follows this song, let that clip finish before the ID.
      const announcementTrack = announcementAdded ? state.tracks.at(-1) : null
      const identStartAt = announcementTrack && announcementTrack.kind === 'dj-mic'
        ? trackEnd(announcementTrack)
        : songStart + song.duration * 1000
      state.tracks.push({ uid: 'rjfm-nationwide-' + station + '-' + songStart, src: stationIdent.src, startAt: identStartAt, duration: stationIdent.duration, fadeIn: 0.25, fadeOut: NATIONWIDE_IDENT_FADE_SECONDS, kind: 'dj-mic', title: stationIdent.title, artist: 'RJ FM Nationwide' })
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
export async function enqueueSongRequest(title: string, artist: string, beforeEnqueue?: () => Promise<void>, station: StationId = 'main') {
  return withSongRequestLock(async () => {
    const now = Date.now()
    const statePath = statePathFor(station === 'naga' ? 'main' : station)
    const [{ state }, settings] = await Promise.all([loadState(now, statePath), getSettings()])
    if (state.requestQueue.length >= 10) throw new Error('The request queue is full. Please try again later.')
    const resolved = await findRequestedSong(title, artist, state.history, state.requestQueue, genresForSettings(settings))
    if (!resolved) throw new Error("We couldn't find that song right now. Please try a different title or artist.")
    await beforeEnqueue?.()
    const request: SongRequest = { requestId: crypto.randomUUID(), title, artist, submittedAt: now, ...resolved }
    state.requestQueue.push(request)
    await writeJson(statePath, state)
    return { accepted: true, requestId: request.requestId, position: state.requestQueue.length }
  })
}
export async function getNowPlaying(options: { skipFill?: boolean; station?: StationId } = {}): Promise<NowResponse> {
  const station: StationId = options.station ?? 'main'
  const now = Date.now()
  const liveDj = await getLiveDj()
  if (station === 'cebu' || station === 'naga' || station === 'gensan' || station === 'cdo' || station === 'davao' || station === 'iloilo' || station === 'masbate') {
    const statePath = statePathFor(station)
    const stationMeta = STATIONS[station]
    const [{ state, changed }, settings, mainSnap] = await Promise.all([loadState(now, statePath), getSettings(), loadState(now, STATE_PATH)])
    const offAir = isOffAirHours(now, stationMeta.signOffHour, stationMeta.signOnHour)
    if (offAir) {
      if (state.tracks.length > 0) { state.tracks = []; await writeJson(statePath, state) }
      return { serverTime: Date.now(), offAir: true, nextOnAir: nextSignOnAtHour(now, stationMeta.signOnHour), tracks: [], bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
    }
    state.tracks = state.tracks.filter((track) => track.kind !== 'live' && !track.uid.startsWith('dzmm-'))
    if (!settings.rjFmNationwideEnabled) {
      const idents = state.tracks.filter((track) => track.uid.startsWith('rjfm-nationwide-'))
      if (idents.length) {
        for (const ident of idents) {
          const previousMusic = [...state.tracks].filter((track) => track.kind === 'music' && track.startAt < ident.startAt).sort((a, b) => b.startAt - a.startAt)[0]
          const nextMusic = state.tracks.filter((track) => track.kind === 'music' && track.startAt > ident.startAt).sort((a, b) => a.startAt - b.startAt)[0]
          if (previousMusic && nextMusic) { previousMusic.fadeOut = CROSSFADE_SECONDS; nextMusic.startAt = trackEnd(previousMusic) - CROSSFADE_SECONDS * 1000; nextMusic.fadeIn = CROSSFADE_SECONDS }
        }
        state.tracks = state.tracks.filter((track) => !track.uid.startsWith('rjfm-nationwide-'))
        await writeJson(statePath, state)
      }
    }

    if (station === 'naga') {
      const mainHasUpcoming = mainSnap.state.tracks.some((track) => track.startAt > now)
      const mainHasCurrent = mainSnap.state.tracks.some((track) => track.startAt <= now && trackEnd(track) > now)
      if (!mainHasUpcoming && !mainHasCurrent && !options.skipFill) {
        await fill(mainSnap.state, now, settings.sundayScheduleEnabled, genresForSettings(settings), 'main', settings.rjFmNationwideEnabled)
        mainSnap.state.fillingUntil = 0
        await writeJson(STATE_PATH, mainSnap.state)
      }
      const followed = buildNagaFollowTracks(mainSnap.state, now, settings.rjFmNationwideEnabled)
      const prevKey = state.tracks.map((track) => `${track.uid}:${track.startAt}`).join('|')
      const nextKey = followed.map((track) => `${track.uid}:${track.startAt}`).join('|')
      if (prevKey !== nextKey) {
        state.tracks = followed
        state.history = [...state.history, ...followed.filter((track) => track.title).map((track) => ({
          id: track.uid, key: songKey(track.title!), artist: track.artist || 'RJ FM Manila', t: track.startAt,
        }))].slice(-80)
        await writeJson(statePath, state)
      } else if (changed) {
        await writeJson(statePath, state)
      }
      // Naga is a delayed simulcast of Manila, never an independently filled playlist.
      return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
    }

    if (station !== 'naga') {
      const mainLiveKeys = new Set(mainSnap.state.tracks.filter((track) => track.kind === 'music' && track.startAt <= now && trackEnd(track) > now).map((track) => songKey(track.title ?? '')))
      if (mainLiveKeys.size) {
        state.history = [...state.history, ...[...mainLiveKeys].map((key) => ({ id: `block-main-${key}`, key, artist: 'main-live', t: now }))].slice(-80)
      }
    }
    const needsFill = state.tracks.filter((track) => track.startAt > now).length < PRELOAD_AHEAD_TRACKS
    if (needsFill && state.fillingUntil < now && !options.skipFill) {
      state.fillingUntil = now + FILL_LOCK_MS
      await writeJson(statePath, state)
      await fill(state, now, settings.sundayScheduleEnabled, genresForSettings(settings), station, settings.rjFmNationwideEnabled)
      state.fillingUntil = 0
      await writeJson(statePath, state)
    } else if (changed) { await writeJson(statePath, state) }
    return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
  }
  const [{ state, changed }, settings] = await Promise.all([loadState(now), getSettings()])
  const offAir = isOffAir(now) || !settings.broadcastEnabled
  if (offAir) {
    if (state.tracks.length > 0) { state.tracks = []; await writeJson(STATE_PATH, state) }
    return { serverTime: Date.now(), offAir: true, nextOnAir: settings.broadcastEnabled ? nextSignOn(now) : null, tracks: [], bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
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
      ? { uid: `dzmm-transition-${dzmmWindow.startAt}`, src: EVENING_TRANSITION_SRC, startAt: dzmmWindow.startAt - EVENING_TRANSITION_SECONDS * 1000, duration: EVENING_TRANSITION_SECONDS, fadeIn: 0, fadeOut: Math.min(ANNOUNCEMENT_CROSSFADE_SECONDS, EVENING_TRANSITION_SECONDS * 0.35), kind: 'dj-mic', title: 'DZMM evening transition announcement', artist: 'RJ FM 93.5 station announcement' }
      : isLoveConnectHandoff
        ? { uid: `dzmm-love-connect-${dzmmWindow.startAt}`, src: LOVE_CONNECT_IDENT_SRC, startAt: dzmmWindow.startAt, duration: LOVE_CONNECT_IDENT_DURATION_SECONDS, fadeIn: 0, fadeOut: Math.min(3, LOVE_CONNECT_IDENT_DURATION_SECONDS * 0.4), kind: 'dj-mic', title: 'Love Connect', artist: 'Coach Vanessa Antonio' }
        : null
    const announcementStartAt = transitionTrack?.startAt ?? transitionStartAt
    const liveTrack: Track = { uid: liveUid, src: DZMM_STREAM_URL, startAt: dzmmWindow.liveStartAt, duration: (dzmmWindow.endAt - dzmmWindow.liveStartAt) / 1000, fadeIn: 0, fadeOut: CROSSFADE_SECONDS, kind: 'live', title: 'DZMM Radyo Patrol 630', artist: 'DZMM live broadcast' }
    const transitionMusic = state.tracks.filter((track) => track.kind === 'music' && track.startAt < announcementStartAt && trackEnd(track) > now && now < announcementStartAt).map((track) => ({ ...track, duration: Math.max(1, (announcementStartAt - track.startAt) / 1000), fadeOut: 0 }))
    const nextTracks = [...transitionMusic, ...(transitionTrack ? [transitionTrack] : []), liveTrack].sort((a, b) => a.startAt - b.startAt)
    const tracksChanged = nextTracks.length !== state.tracks.length || nextTracks.some((track, index) => { const current = state.tracks[index]; return current?.uid !== track.uid || current?.src !== track.src || current?.fadeOut !== track.fadeOut || current?.startAt !== track.startAt })
    if (tracksChanged) { state.tracks = nextTracks; await writeJson(STATE_PATH, state) }
    return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
  }
  if (state.tracks.some((track) => track.kind === 'live')) {
    state.tracks = state.tracks.filter((track) => track.kind !== 'live')
    await writeJson(STATE_PATH, state)
  }
  if (!options.skipFill && state.fillingUntil < now) {
    state.fillingUntil = now + FILL_LOCK_MS
    await writeJson(STATE_PATH, state)
    await fill(state, now, settings.sundayScheduleEnabled, genresForSettings(settings), 'main', settings.rjFmNationwideEnabled)
    state.fillingUntil = 0
    await writeJson(STATE_PATH, state)
  } else if (changed) await writeJson(STATE_PATH, state)
  const hasCurrentMusic = state.tracks.some((track) => track.kind === 'music' && track.startAt <= now && trackEnd(track) > now)
  const hasUpcomingMusic = state.tracks.some((track) => track.kind === 'music' && track.startAt > now)
  if (!hasCurrentMusic && !hasUpcomingMusic) await fill(state, now, settings.sundayScheduleEnabled, genresForSettings(settings), 'main')
  return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
}
export async function refreshQueue(preserveCurrent = false) {
  const now = Date.now()
  if (preserveCurrent) {
    // Apply new filters to every station's upcoming rotation without interrupting audio already on air.
    const stations: StationId[] = ['main', 'naga', 'cebu', 'gensan', 'cdo', 'davao', 'iloilo', 'masbate']
    await Promise.all(stations.map(async (station) => {
      const path = statePathFor(station)
      const { state } = await loadState(now, path)
      state.tracks = state.tracks.filter((track) => track.startAt <= now && trackEnd(track) > now)
      for (const track of state.tracks) {
        if (track.kind === 'music' && track.fadeOut <= 0) track.fadeOut = CROSSFADE_SECONDS
      }
      state.fillingUntil = 0
      await writeJson(path, state)
    }))
  } else {
    const { state } = await loadState(now)
    state.tracks = []
    state.fillingUntil = 0
    await writeJson(STATE_PATH, state)
  }
  return getNowPlaying()
}
export async function recoverFailedTrack(uid: string, options: { station?: StationId } = {}) {
  const station: StationId = options.station ?? 'main'
  const path = statePathFor(station)
  const now = Date.now()
  const { state } = await loadState(now, path)
  const failed = state.tracks.find((track) => track.uid === uid)
  if (!failed) return getNowPlaying({ skipFill: true, station })
  if (failed.kind === 'live' && uid.startsWith('dzmm-')) {
    const start = Number(uid.slice('dzmm-'.length))
    if (Number.isFinite(start)) state.failedDzmmWindowStart = start
  }
  state.tracks = state.tracks.filter((track) => track.uid !== uid)
  await writeJson(path, state)
  return getNowPlaying({ station })
}
export async function reportPlaybackFailure(uid: string) {
  return recoverFailedTrack(uid, { station: 'main' })
}
export async function getAdminStatus(): Promise<AdminStatus> {
  const now = Date.now()
  const [settings, listenersNow, averageListeners, { state }] = await Promise.all([
    getSettings(), getActiveListenerCount(), getAverageListenerCount(), loadState(now),
  ])
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const hourAgo = now - ARTIST_WINDOW_MS
  return {
    ...settings,
    persistenceConfigured: isBlobStorageAvailable(),
    listenersNow,
    averageListeners,
    songsThisWeek: state.history.filter((entry) => entry.t >= weekAgo).length,
    artistsThisHour: new Set(state.history.filter((entry) => entry.t >= hourAgo).map((entry) => entry.artist)).size,
    queued: state.requestQueue.length,
  }
}
