import 'server-only'
import { after } from 'next/server'
import { getActiveListenerCount, getAverageListenerCount, getSettings, isBlobStorageAvailable, readJson, MESSAGES_PATH, STATE_PATH, NAGA_STATE_PATH, CEBU_STATE_PATH, GENSAN_STATE_PATH, CDO_STATE_PATH, DAVAO_STATE_PATH, ILOILO_STATE_PATH, MASBATE_STATE_PATH, LIVE_DJ_PATH, writeJson } from './storage'
import type { StationId } from './stations'
import {
  dailyAnnouncementScheduleAt,
  languageForSlot,
  manilaDateKey,
  nextSignOn,
  masbateProgramAt,
  nagaProgramAt,
  programAt,
  type Artist,
  type Program,
} from './schedule'
import { effectiveBlockedGenres, isAllowedStationTrack, isBlockedProgramGenre, isOriginalArtistTrack } from './song-filter'
import type { AdminStatus, ListenerMessage, LiveDjState, NowResponse, SongRequest, Track } from './types'
import { buildTimeCheckScript, saveChristopherScript, saveAutoDjScript, estimateChristopherDuration, enqueueChristopherTimeCheck, listChristopherTimeChecks } from './dj-christopher'

const BETADASH_API_BASE = 'https://betadash-api-swordslush-production.up.railway.app/mp3juice/api'
const CROSSFADE_SECONDS = 8
const PRELOAD_AHEAD_TRACKS = 2
const NAGA_FOLLOW_DELAY_MS = 12_000
const ARTIST_WINDOW_MS = 60 * 60 * 1000
const ARTIST_HISTORY_PATH = 'station/artist-history.json'
const AUTO_DISCOVERED_ARTISTS_PATH = 'station/auto-discovered-artists.json'
const PLAYED_SONG_HISTORY_PATH = 'station/played-song-history.json'
const SONG_REPEAT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
interface ArtistHistoryRecord { artist: string; plays: number; lastPlayedAt: number }
async function recordArtistPlay(artist: string, playedAt: number) {
  const saved = await readJson<ArtistHistoryRecord[]>(ARTIST_HISTORY_PATH, [])
  const index = saved.findIndex((entry) => entry.artist.toLowerCase() === artist.toLowerCase())
  if (index >= 0) saved[index] = { ...saved[index], plays: saved[index].plays + 1, lastPlayedAt: Math.max(saved[index].lastPlayedAt, playedAt) }
  else saved.push({ artist, plays: 1, lastPlayedAt: playedAt })
  await writeJson(ARTIST_HISTORY_PATH, saved)
}

async function saveAutoDiscoveredArtist(artist: Artist) {
  const saved = await readJson<Artist[]>(AUTO_DISCOVERED_ARTISTS_PATH, [])
  const exists = saved.some((entry) => normalize(entry.name) === normalize(artist.name))
  if (!exists && saved.length < 500) {
    saved.push({ name: artist.name, match: artist.match, language: artist.language })
    await writeJson(AUTO_DISCOVERED_ARTISTS_PATH, saved)
  }
}
const MAX_ARTIST_PLAYS_PER_HOUR = 1
const FILL_LOCK_MS = 120_000
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
let autoDjFillQueue: Promise<void> = Promise.resolve()
async function withAutoDjFillLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = autoDjFillQueue
  let release!: () => void
  autoDjFillQueue = new Promise<void>((resolve) => { release = resolve })
  await previous
  try { return await operation() } finally { release() }
}
interface StationState {
  tracks: Track[]; songCount: number; history: HistoryEntry[]; fillingUntil: number; requestQueue: SongRequest[]
  failedDzmmWindowStart: number | null; dailyAnnouncementDay: string | null; dailyAnnouncementSongCount: number; dailyAnnouncementPlayed: boolean
  christopherNextAt: number
}
const EMPTY_STATE: StationState = {
  tracks: [], songCount: 0, history: [], fillingUntil: 0, requestQueue: [], failedDzmmWindowStart: null,
  dailyAnnouncementDay: null, dailyAnnouncementSongCount: 0, dailyAnnouncementPlayed: false, christopherNextAt: 0,
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
  const recent = new Set(history.slice(-20).map((h) => h.artist))
  const fresh = allowed.filter((a) => !recent.has(a.name))
  // Relax artist spacing only when the current library has no other eligible artist.
  const relaxed = allowed.length ? allowed : unique.filter((a) => a.name !== lastArtist)
  return shuffle(fresh.length > 0 ? fresh : relaxed.length > 0 ? relaxed : unique)
}
/**
 * Live AutoDJ selector: evaluates a rotating pool against the active program,
 * recent play history, artist diversity, track length and source quality.
 * This is an autonomous rules-based selector (not an external LLM agent).
 */
async function findSong(program: Program, songCount: number, history: HistoryEntry[], now: number, blockedGenres: string[], station: StationId = 'main') {
  if (isBlockedProgram(program, blockedGenres)) return null
  const language = languageForSlot(program, songCount)
  const playedIds = new Set(history.map((h) => h.id))
  const playedKeys = new Set(history.map((h) => h.key))
  const discoveredArtists = await readJson<Artist[]>(AUTO_DISCOVERED_ARTISTS_PATH, [])
  const pool = [...program.pools[language], ...discoveredArtists.filter((artist) => artist.language === language)]
  const candidatesArtists = eligibleArtists(pool, history, now)
  const variants = program.variants[language]
  if (candidatesArtists.length === 0 || variants.length === 0) return null

  // Search many artists in parallel batches. If the first artists have no valid
  // results, keep searching the remaining library instead of ending the fill.
  const batchSize = 12
  const maxArtistsPerFill = Math.min(candidatesArtists.length, 12)
  const triedIds = new Set<string>()
  for (let offset = 0; offset < maxArtistsPerFill; offset += batchSize) {
    const batch = candidatesArtists.slice(offset, offset + batchSize)
    const results = await Promise.all(batch.map(async (artist, index) => {
      const variantIndex = (songCount + offset + index + Math.floor(now / 60_000)) % variants.length
      const primary = variants[variantIndex] ?? ''
      const secondary = variants[(variantIndex + 1) % variants.length] ?? ''
      const queries = [...new Set([primary, secondary].map((value) => `${artist.name} ${value}`.trim()))]
      const responses = await Promise.all(queries.map((query) =>
        fetchJson<{ items?: SearchItem[] }>(betadashUrl({ search: query }), 7_000),
      ))
      return responses.flatMap((response) => response?.items ?? []).map((item) => ({ item, artist }))
    }))

    const shortlist: Array<{ item: SearchItem; artist: Artist; score: number }> = []
    for (const { item, artist } of results.flat()) {
      if (!item?.id || triedIds.has(item.id)) continue
      triedIds.add(item.id)
      const seconds = parseDuration(item.duration ?? '')
      if (seconds < 120 || seconds > 420) continue
      if (!isOriginalArtistTrack(item.title, artist)) continue
      const metadata = [item.genre, item.channel, item.channelTitle, item.uploader, item.description, item.artist].filter(Boolean).join(' ')
      if (!isAllowedStationTrack({ title: item.title, genre: metadata, blockedGenres })) continue
      if (matchesBlockedGenre(`${item.genre ?? ''} ${item.title}`, blockedGenres)) continue
      if (playedIds.has(item.id) || playedKeys.has(songKey(item.title))) continue

      const normalizedMetadata = normalize([item.artist, item.channelTitle, item.channel, item.uploader].filter(Boolean).join(' '))
      const normalizedTitle = normalize(item.title)
      const durationScore = Math.max(0, 24 - Math.abs(seconds - 240) / 6)
      const sourceScore = /official audio|official music|topic$/.test(normalizedMetadata + ' ' + normalizedTitle) ? 12 : 0
      const cleanTitleScore = /official audio|audio only/.test(normalizedTitle) ? 6 : 0
      const artistCreditScore = normalizedMetadata.includes(normalize(artist.name)) ? 10 : 0
      const artistHistory = history.filter((entry) => entry.artist === artist.name).length
      const freshnessScore = Math.max(0, 12 - artistHistory * 2)
      shortlist.push({ item, artist, score: durationScore + sourceScore + cleanTitleScore + artistCreditScore + freshnessScore + Math.random() * 3 })
    }

    shortlist.sort((a, b) => b.score - a.score)
    // Probe the three best sources in parallel so a slow/broken source cannot
    // hold the station queue for multiple sequential 12-second timeouts.
    const downloadProbes = shortlist.slice(0, 3).map(async ({ item, artist }) => {
      const download = await fetchJson<{ downloadUrl?: string }>(betadashUrl({ download: item.url, type: 'mp3' }), 8_000)
      if (!download?.downloadUrl) throw new Error('No downloadable source')
      return {
        id: item.id,
        key: songKey(item.title),
        artist: artist.name,
        title: item.title,
        src: download.downloadUrl,
        duration: parseDuration(item.duration),
      }
    })
    const playable = await Promise.any(downloadProbes).catch(() => null)
    if (playable) {
      await saveAutoDiscoveredArtist({ name: playable.artist, match: playable.artist.toLowerCase(), language })
      return playable
    }
  }
  return null
}
async function findRequestedSong(title: string, artist: string, history: HistoryEntry[], requestQueue: SongRequest[], blockedGenres: string[]) {
  const queries = [...new Set([
    `${title} ${artist}`,
    `"${title}" ${artist}`,
    `${artist} ${title} official audio`,
    `${title} ${artist} mp3`,
    `${title} ${artist} lyrics`,
  ])]
  const results = await Promise.all(queries.map((search) =>
    fetchJson<{ items?: SearchItem[] }>(betadashUrl({ search }), 12_000),
  ))
  const items = [...new Map(results.flatMap((result) => result?.items ?? []).filter((item) => item?.id && item?.url).map((item) => [item.id, item])).values()]
  const playedIds = new Set([...history.map((e) => e.id), ...requestQueue.map((r) => r.id).filter((id): id is string => Boolean(id))])
  const playedKeys = new Set([...history.map((e) => e.key), ...requestQueue.map((r) => r.key).filter((key): key is string => Boolean(key))])
  const titleNeedle = normalize(title)
  const artistNeedle = normalize(artist)
  const candidates = items.filter((item) => {
    const seconds = parseDuration(item.duration ?? '')
    const officialAttribution = [item.artist, item.channelTitle, item.channel, item.uploader].filter(Boolean).join(' ')
    const metadata = normalize(officialAttribution)
    const normalizedTitle = normalize(item.title)
    const artistMatches = isOriginalArtistTrack(item.title, { name: artist, match: artist })
      || (Boolean(officialAttribution) && isOriginalArtistTrack(`${item.title} - ${officialAttribution}`, { name: artist, match: artist }))
      || (artistNeedle.length >= 3 && metadata.includes(artistNeedle))
    return seconds >= 90 && seconds <= 900
      && normalizedTitle.includes(titleNeedle)
      && artistMatches
      && isAllowedStationTrack({ title: item.title, genre: [item.genre, item.channel, item.channelTitle, item.uploader, item.description, item.artist].filter(Boolean).join(' '), blockedGenres })
      && !matchesBlockedGenre(`${item.genre ?? ''} ${item.title}`, blockedGenres)
      && !playedIds.has(item.id)
      && !playedKeys.has(songKey(item.title))
  }).map((item) => {
    const metadata = normalize([item.artist, item.channelTitle, item.channel, item.uploader].filter(Boolean).join(' '))
    const normalizedTitle = normalize(item.title)
    const score = (normalizedTitle.startsWith(titleNeedle) ? 6 : 0)
      + (normalizedTitle.includes(titleNeedle) ? 3 : 0)
      + (metadata.includes(artistNeedle) ? 5 : 0)
      + (/official audio|topic$/.test(metadata + ' ' + normalizedTitle) ? 2 : 0)
    return { item, score }
  }).sort((a, b) => b.score - a.score)
  for (const { item } of candidates.slice(0, 8)) {
    const download = await fetchJson<{ downloadUrl?: string }>(betadashUrl({ download: item.url, type: 'mp3' }), 12_000)
    if (download?.downloadUrl) {
      return { id: item.id, key: songKey(item.title), title: item.title, artist, src: download.downloadUrl, duration: parseDuration(item.duration) }
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
function buildNagaFollowTracks(mainState: StationState, now: number, nationwideEnabled: boolean, christopherEnabled = true): Track[] {
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
  for (const voice of mainState.tracks.filter((track) => track.kind === 'dj-mic' && ((christopherEnabled && track.uid.startsWith('dj-christopher-timecheck-')) || track.uid.startsWith('dj-autodj-message-main-')))) {
    const songsBeforeVoice = manilaMusic.filter((track) => track.startAt < voice.startAt).length
    const identsBeforeVoice = nationwideEnabled && ident ? Math.floor((offset + songsBeforeVoice) / 2) : 0
    const identDelay = identsBeforeVoice * (CROSSFADE_SECONDS + ident!.duration - NATIONWIDE_IDENT_FADE_SECONDS) * 1000
    const startAt = voice.startAt + NAGA_FOLLOW_DELAY_MS + identDelay
    if (startAt + voice.duration * 1000 >= now - 2_000) out.push({ ...voice, uid: `naga-follow-${voice.uid}`, startAt })
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
async function fill(state: StationState, now: number, sundayScheduleEnabled: boolean, blockedGenres: string[], station: StationId = 'main', nationwideEnabled = true, djChristopherEnabled = false, _djChristopherIntervalMinutes = 40) {
  const savedNetworkHistory = await readJson<HistoryEntry[]>(PLAYED_SONG_HISTORY_PATH, [])
  const networkHistory = savedNetworkHistory.filter((entry) => entry.t > now - SONG_REPEAT_WINDOW_MS)
  const localHistoryIds = new Set(state.history.map((entry) => entry.id))
  const selectionHistory = [...state.history, ...networkHistory.filter((entry) => !localHistoryIds.has(entry.id))]
  let guard = 0
  // Add one future track per request so search retries stay within the API time budget.
  while (state.tracks.filter((t) => t.startAt > now).length < PRELOAD_AHEAD_TRACKS && guard++ < 1) {
    const startAt = nextStart(state, now)
    const program = station === 'naga'
      ? nagaProgramAt(startAt)
      : station === 'masbate'
        ? masbateProgramAt(startAt)
        : programAt(startAt, sundayScheduleEnabled)
    const fadeIn = state.tracks.at(-1)?.fadeOut ?? 0
    const stationIdent = NATIONWIDE_IDENT_BY_STATION[station]
    const identAfterSong = nationwideEnabled && Boolean(stationIdent) && (state.songCount + 1) % 8 === 0
    const request = state.requestQueue[0]
    const resolvedRequest = request?.src && request.id && request.key && request.duration
      ? { id: request.id, key: request.key, title: request.title, src: request.src, duration: request.duration, artist: request.artist }
      : request
        ? await findRequestedSong(request.title, request.artist, selectionHistory, state.requestQueue.slice(1), blockedGenres)
        : null
    const song = resolvedRequest
      ? resolvedRequest
      : await findSong(program, state.songCount, selectionHistory, startAt, blockedGenres, station)
    if (!song) break
    if (request && resolvedRequest) {
      Object.assign(request, resolvedRequest)
      state.requestQueue.shift()
    }
    let songStart = Math.max(startAt, Date.now() - (state.tracks.length === 0 ? 0 : 60_000))
    const songFadeIn = fadeIn
    state.tracks.push({ uid: `${song.id}-${songStart}`, src: song.src, startAt: songStart, duration: song.duration, fadeIn: songFadeIn, fadeOut: identAfterSong ? 0 : CROSSFADE_SECONDS, kind: 'music', title: song.title, artist: song.artist })
    const playedEntry = { id: song.id, key: song.key, artist: song.artist, t: songStart }
    state.history.push(playedEntry)
    networkHistory.push(playedEntry)
    selectionHistory.push(playedEntry)
    await writeJson(PLAYED_SONG_HISTORY_PATH, networkHistory)
    await recordArtistPlay(song.artist, songStart)
    state.songCount++
    let timeCheckEndAt = songStart + song.duration * 1000
    if (djChristopherEnabled && state.songCount % 2 === 0) {
      const philippinesParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).formatToParts(new Date(timeCheckEndAt))
      const philippinesHour = philippinesParts.find((part) => part.type === 'hour')?.value ?? '12'
      const philippinesMinute = philippinesParts.find((part) => part.type === 'minute')?.value ?? '00'
      const philippinesTime = `${philippinesHour}:${philippinesMinute}`
      const timeCheckText = buildTimeCheckScript(`RJ FM time check is ${philippinesTime}`)
      const scriptId = await saveChristopherScript(timeCheckText)
      const timeCheckDuration = estimateChristopherDuration(timeCheckText)
      const previousMusic = [...state.tracks].reverse().find((track) => track.kind === 'music' && trackEnd(track) >= timeCheckEndAt - 1000)
      if (previousMusic) previousMusic.fadeOut = Math.min(previousMusic.fadeOut || CROSSFADE_SECONDS, 3)
      state.tracks.push({
        uid: `dj-christopher-timecheck-${station}-${state.songCount}-${scriptId}`,
        src: `/api/dj-christopher?id=${scriptId}`,
        startAt: timeCheckEndAt,
        duration: timeCheckDuration,
        fadeIn: 0.5,
        fadeOut: 2.5,
        kind: 'dj-mic',
        title: 'DJ Christopher · RJ FM Time Check',
        artist: 'DJ Christopher',
      })
      timeCheckEndAt += timeCheckDuration * 1000
    }
    // Auto DJ, not Christopher, reads each listener song-request message once per station.
    const listenerMessages = await readJson<ListenerMessage[]>(MESSAGES_PATH, [])
    const pendingMessage = listenerMessages.find((message) =>
      /(song request|request(?:ing)? (?:a )?song|please play|play me|can you play|request:)/i.test(message.body)
      && !message.spokenAt?.[station]
    )
    if (pendingMessage) {
      const messageText = `Auto DJ has a song request message from ${pendingMessage.fromName}: ${pendingMessage.body}`
      const messageId = await saveAutoDjScript(messageText)
      const messageDuration = estimateChristopherDuration(messageText)
      state.tracks.push({
        uid: `dj-autodj-message-${station}-${pendingMessage.id}-${messageId}`,
        src: `/api/dj-christopher?id=${messageId}&speaker=autodj`,
        startAt: timeCheckEndAt,
        duration: messageDuration,
        fadeIn: 0.5,
        fadeOut: 2.5,
        kind: 'dj-mic',
        title: 'Auto DJ · Listener Song Request',
        artist: 'RJ FM Auto DJ',
      })
      timeCheckEndAt += messageDuration * 1000
      await writeJson(MESSAGES_PATH, listenerMessages.map((message) => message.id === pendingMessage.id
        ? { ...message, spokenAt: { ...message.spokenAt, [station]: Date.now() } }
        : message))
    }
    if (identAfterSong && stationIdent) {
      // Station ident follows Christopher's completed voice break.
      const identStartAt = timeCheckEndAt
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
    christopherNextAt: typeof saved.christopherNextAt === 'number' ? saved.christopherNextAt : 0,
  }
  const today = manilaDateKey(now)
  if (state.dailyAnnouncementDay !== today) { state.dailyAnnouncementDay = today; state.dailyAnnouncementSongCount = 0; state.dailyAnnouncementPlayed = false }
  const announcementSchedule = dailyAnnouncementScheduleAt(now)
  if (!announcementSchedule || now >= announcementSchedule.expiresAt) state.dailyAnnouncementPlayed = true
  const before = state.tracks.length
  state.tracks = state.tracks.filter((t) => {
    if (t.uid.startsWith('dj-christopher-request-')) return false
    if (t.uid.includes('dj-christopher-')) return trackEnd(t) >= now - 1000
    if (t.kind !== 'dj-mic' || t.uid.startsWith('dzmm-transition-') || t.uid.startsWith('dzmm-love-connect-')) return trackEnd(t) >= now - 1000
    const schedule = dailyAnnouncementScheduleAt(now)
    const isActive = t.startAt <= now && trackEnd(t) > now
    return Boolean((schedule && now >= schedule.availableFrom && now < schedule.expiresAt || isActive) && trackEnd(t) >= now - 1000)
  })
  state.history = state.history.filter((h) => h.t > now - 30 * 24 * 60 * 60 * 1000)
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
export async function enqueueSongRequest(title: string, artist: string, beforeEnqueue?: () => Promise<void>, station: StationId = 'main', location = '') {
  return withSongRequestLock(async () => {
    const now = Date.now()
    const statePath = statePathFor(station === 'naga' ? 'main' : station)
    const [{ state }, settings] = await Promise.all([loadState(now, statePath), getSettings()])
    const duplicateIndex = state.requestQueue.findIndex((item) => normalize(item.title) === normalize(title) && normalize(item.artist) === normalize(artist))
    if (duplicateIndex >= 0) {
      return { accepted: true, duplicate: true, requestId: state.requestQueue[duplicateIndex].requestId, position: duplicateIndex + 1, resolved: Boolean(state.requestQueue[duplicateIndex].src) }
    }
    if (state.requestQueue.length >= 10) throw new Error('The request queue is full. Please try again later.')
    await beforeEnqueue?.()
    const request: SongRequest = {
      requestId: crypto.randomUUID(),
      title,
      artist,
      location: location.trim().slice(0, 80),
      submittedAt: now,
    }
    state.requestQueue.push(request)
    // The Auto DJ owns request resolution and playback. If the source is not
    // available yet, keep the accepted request pending and retry on later fills.
    state.tracks = state.tracks.filter((track) => track.startAt <= now && trackEnd(track) > now)
    state.fillingUntil = 0
    await writeJson(statePath, state)
    return { accepted: true, autoDjQueued: true, requestId: request.requestId, position: state.requestQueue.length, resolved: false }
  })
}
export async function getNowPlaying(options: { skipFill?: boolean; station?: StationId } = {}): Promise<NowResponse> {
  const station: StationId = options.station ?? 'main'
  const now = Date.now()
  const liveDj = await getLiveDj()
  if (station === 'cebu' || station === 'naga' || station === 'gensan' || station === 'cdo' || station === 'davao' || station === 'iloilo' || station === 'masbate') {
    const statePath = statePathFor(station)
    const [{ state, changed }, settings, mainSnap] = await Promise.all([loadState(now, statePath), getSettings(), loadState(now, STATE_PATH)])
    if (!settings.djChristopherEnabled) {
      const kept = state.tracks.filter((track) => track.uid.includes('timecheck') || (!track.uid.startsWith('dj-christopher-') && !track.uid.includes('dj-christopher-')))
      if (kept.length !== state.tracks.length || state.christopherNextAt !== 0) {
        state.tracks = kept
        state.christopherNextAt = 0
        await writeJson(statePath, state)
      }
    }
    // All RJ FM stations remain on-air 24/7; no DZMM live handoffs are scheduled.
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
        await fill(mainSnap.state, now, settings.sundayScheduleEnabled, genresForSettings(settings), 'main', settings.rjFmNationwideEnabled, settings.djChristopherEnabled, settings.djChristopherIntervalMinutes)
        mainSnap.state.fillingUntil = 0
        await writeJson(STATE_PATH, mainSnap.state)
      }
      const followed = buildNagaFollowTracks(mainSnap.state, now, settings.rjFmNationwideEnabled, settings.djChristopherEnabled)
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

    const mainLiveKeys = new Set(mainSnap.state.tracks.filter((track) => track.kind === 'music' && track.startAt <= now && trackEnd(track) > now).map((track) => songKey(track.title ?? '')))
    if (mainLiveKeys.size) {
      state.history = [...state.history, ...[...mainLiveKeys].map((key) => ({ id: `block-main-${key}`, key, artist: 'main-live', t: now }))].slice(-80)
    }
    const needsFill = state.tracks.filter((track) => track.startAt > now).length < PRELOAD_AHEAD_TRACKS
    if (needsFill && state.fillingUntil < now && !options.skipFill) {
      state.fillingUntil = now + FILL_LOCK_MS
      await writeJson(statePath, state)
      await withAutoDjFillLock(async () => {
        try {
          await fill(state, now, settings.sundayScheduleEnabled, genresForSettings(settings), station, settings.rjFmNationwideEnabled, settings.djChristopherEnabled, settings.djChristopherIntervalMinutes)
        } finally {
          state.fillingUntil = 0
          await writeJson(statePath, state)
        }
      })
    } else if (changed) { await writeJson(statePath, state) }
    return { serverTime: Date.now(), offAir: false, nextOnAir: null, tracks: state.tracks.map(toClientTrack), bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
  }
  const [{ state, changed }, settings] = await Promise.all([loadState(now), getSettings()])
  if (!settings.djChristopherEnabled) {
    const kept = state.tracks.filter((track) => !track.uid.startsWith('dj-christopher-'))
    if (kept.length !== state.tracks.length || state.christopherNextAt !== 0) {
      state.tracks = kept
      state.christopherNextAt = 0
      await writeJson(STATE_PATH, state)
    }
  }
  const offAir = !settings.broadcastEnabled
  if (offAir) {
    if (state.tracks.length > 0) { state.tracks = []; await writeJson(STATE_PATH, state) }
    return { serverTime: Date.now(), offAir: true, nextOnAir: settings.broadcastEnabled ? nextSignOn(now) : null, tracks: [], bassBoostDb: settings.bassBoostDb, autoDeletePlayedCache: settings.autoDeletePlayedCache, transmitterWatts: settings.transmitterWatts, liveDj }
  }
  const withoutDzmm = state.tracks.filter((track) =>
    track.kind !== 'live'
    && !track.uid.startsWith('dzmm-')
    && !track.uid.startsWith('dj-christopher-dzmm-timecheck-'),
  )
  if (withoutDzmm.length !== state.tracks.length) {
    state.tracks = withoutDzmm
    await writeJson(STATE_PATH, state)
  }
  if (!options.skipFill && state.fillingUntil < now) {
    state.fillingUntil = now + FILL_LOCK_MS
    await writeJson(STATE_PATH, state)
    await fill(state, now, settings.sundayScheduleEnabled, genresForSettings(settings), 'main', settings.rjFmNationwideEnabled, settings.djChristopherEnabled, settings.djChristopherIntervalMinutes)
    state.fillingUntil = 0
    await writeJson(STATE_PATH, state)
  } else if (changed) await writeJson(STATE_PATH, state)
  const hasCurrentMusic = state.tracks.some((track) => track.kind === 'music' && track.startAt <= now && trackEnd(track) > now)
  const hasUpcomingMusic = state.tracks.some((track) => track.kind === 'music' && track.startAt > now)
  if (!hasCurrentMusic && !hasUpcomingMusic) await fill(state, now, settings.sundayScheduleEnabled, genresForSettings(settings), 'main', settings.rjFmNationwideEnabled, settings.djChristopherEnabled, settings.djChristopherIntervalMinutes)
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
/** Read the current/upcoming music title without triggering AutoDJ queue generation. */
export async function getStationNowPlayingTitle(station: StationId): Promise<string> {
  const now = Date.now()
  const { state } = await loadState(now, statePathFor(station))
  const music = state.tracks.filter((track) => track.kind === 'music').sort((a, b) => a.startAt - b.startAt)
  const current = music.find((track) => track.startAt <= now && trackEnd(track) > now)
  return current?.title ?? music.find((track) => track.startAt > now)?.title ?? 'Music rotation preparing'
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
  const [settings, listenersNow, averageListeners, { state }, artistHistory] = await Promise.all([
    getSettings(), getActiveListenerCount(), getAverageListenerCount(), loadState(now), readJson<ArtistHistoryRecord[]>(ARTIST_HISTORY_PATH, []),
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
    artistHistory: artistHistory.sort((a, b) => b.lastPlayedAt - a.lastPlayedAt),
  }
}

export async function createAdminTimeCheck(prompt: string, mode: 'after3' | 'dzmm') {
  const { state } = await loadState(Date.now())
  return enqueueChristopherTimeCheck(prompt, mode, state.songCount)
}
export async function getAdminTimeChecks() {
  return listChristopherTimeChecks()
}
