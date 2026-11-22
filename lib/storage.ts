import 'server-only'
import { get, put } from '@vercel/blob'
import type { StationSettings } from './types'

const memoryFallback = new Map<string, string>()
const MAX_BASS_BOOST_DB = 12
const BLOB_RETRY_DELAY_MS = 15_000
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'morefm-station'

/** Defaults from the station Supabase project (overridable via Render env). */
const DEFAULT_SUPABASE_URL = 'https://lbzsosywniqvdroimbwd.supabase.co'
const DEFAULT_SUPABASE_KEY = 'sb_publishable_-px7dTEhuIAEx2VakAjWNg_sM3YrjDH'

let retryBlobAfter = 0
let warnedAboutFallback = false
let blobOperational: boolean | null = null
let supabaseBucketUnavailable = false
let warnedAboutMissingSupabaseBucket = false

function supabaseUrl() {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/$/, '')
}

function supabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_KEY
  ).trim()
}

function hasSupabaseCredentials() {
  return !supabaseBucketUnavailable && Boolean(supabaseUrl() && supabaseKey())
}

function isMissingSupabaseBucket(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /NoSuchBucket|Bucket not found/i.test(message)
}

function logStorageFailure(action: 'read' | 'write', pathname: string, error: unknown) {
  if (isMissingSupabaseBucket(error)) {
    supabaseBucketUnavailable = true
    if (!warnedAboutMissingSupabaseBucket) {
      warnedAboutMissingSupabaseBucket = true
      console.warn('[morefm] Supabase Storage bucket is missing; switching to configured Vercel Blob or process-memory fallback')
    }
    return
  }
  console.error(`[morefm] blob ${action} failed`, pathname, error instanceof Error ? error.message : error)
}

function hasVercelBlobCredentials() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  )
}

function hasBlobCredentials() {
  return hasSupabaseCredentials() || hasVercelBlobCredentials()
}

export function isBlobStorageAvailable() {
  return blobOperational ?? hasBlobCredentials()
}

function readMemory<T>(pathname: string, fallback: T): T {
  const text = memoryFallback.get(pathname)
  if (!text) return fallback
  try {
    return JSON.parse(text) as T
  } catch {
    memoryFallback.delete(pathname)
    return fallback
  }
}

function warnMemoryFallback() {
  if (warnedAboutFallback) return
  warnedAboutFallback = true
  console.warn('[morefm] Durable blob unavailable; using process-memory station state until storage recovers')
}

function supabaseObjectUrl(pathname: string) {
  const objectPath = pathname.replace(/^\/+/, '')
  return `${supabaseUrl()}/storage/v1/object/${SUPABASE_BUCKET}/${objectPath}`
}

function supabaseHeaders(extra: Record<string, string> = {}) {
  const key = supabaseKey()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...extra,
  }
}

async function readFromSupabase(pathname: string): Promise<string | null> {
  if (!hasSupabaseCredentials()) return null
  const response = await fetch(supabaseObjectUrl(pathname), {
    method: 'GET',
    headers: supabaseHeaders(),
    cache: 'no-store',
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Supabase storage read failed (${response.status})`)
  return response.text()
}

async function writeToSupabase(pathname: string, text: string) {
  if (!hasSupabaseCredentials()) return false
  const response = await fetch(supabaseObjectUrl(pathname), {
    method: 'POST',
    headers: supabaseHeaders({
      'Content-Type': 'application/json',
      'x-upsert': 'true',
    }),
    body: text,
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Supabase storage write failed (${response.status}) ${detail.slice(0, 200)}`)
  }
  return true
}

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  if (!hasBlobCredentials() || Date.now() < retryBlobAfter) {
    blobOperational = false
    warnMemoryFallback()
    return readMemory(pathname, fallback)
  }

  try {
    if (hasSupabaseCredentials()) {
      const text = await readFromSupabase(pathname)
      if (text == null) {
        blobOperational = true
        return readMemory(pathname, fallback)
      }
      const data = JSON.parse(text) as T
      memoryFallback.set(pathname, text)
      retryBlobAfter = 0
      blobOperational = true
      return data
    }

    const result = await get(pathname, { access: 'private', useCache: false })
    if (!result || !result.stream) {
      blobOperational = true
      return readMemory(pathname, fallback)
    }
    const text = await new Response(result.stream).text()
    const data = JSON.parse(text) as T
    memoryFallback.set(pathname, text)
    retryBlobAfter = 0
    blobOperational = true
    return data
  } catch (error) {
    logStorageFailure('read', pathname, error)
    retryBlobAfter = Date.now() + BLOB_RETRY_DELAY_MS
    blobOperational = false
    warnMemoryFallback()
    return readMemory(pathname, fallback)
  }
}

export async function writeJson(pathname: string, data: unknown) {
  const text = JSON.stringify(data)
  if (text === undefined) throw new Error('Station data could not be serialized as JSON.')
  memoryFallback.set(pathname, text)
  if (!hasBlobCredentials() || Date.now() < retryBlobAfter) {
    blobOperational = false
    warnMemoryFallback()
    return false
  }

  try {
    if (hasSupabaseCredentials()) {
      await writeToSupabase(pathname, text)
      retryBlobAfter = 0
      blobOperational = true
      return true
    }

    await put(pathname, text, {
      access: 'private',
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    })
    retryBlobAfter = 0
    blobOperational = true
    return true
  } catch (error) {
    logStorageFailure('write', pathname, error)
    retryBlobAfter = Date.now() + BLOB_RETRY_DELAY_MS
    blobOperational = false
    warnMemoryFallback()
    return false
  }
}

export const LISTENERS_PATH = 'station/listeners.json'
export const LISTENER_METRICS_PATH = 'station/listener-metrics.json'
const LISTENER_TTL_MS = 60_000
const LISTENER_METRIC_WINDOW_MS = 24 * 60 * 60 * 1000
const LISTENER_ID_PATTERN = /^[a-zA-Z0-9-]{16,80}$/
let listenerQueue: Promise<void> = Promise.resolve()

interface ListenerSnapshot {
  listeners: Record<string, number>
  changed: boolean
}

interface ListenerMetric {
  t: number
  count: number
}

async function recordListenerMetric(count: number, now: number) {
  const saved = await readJson<unknown>(LISTENER_METRICS_PATH, [])
  const metrics = Array.isArray(saved)
    ? saved.filter((item): item is ListenerMetric => Boolean(item) && typeof item === 'object'
      && typeof (item as ListenerMetric).t === 'number'
      && typeof (item as ListenerMetric).count === 'number'
      && Number.isFinite((item as ListenerMetric).t)
      && Number.isFinite((item as ListenerMetric).count))
    : []
  metrics.push({ t: now, count: Math.max(0, Math.round(count)) })
  await writeJson(LISTENER_METRICS_PATH, metrics.filter((item) => item.t >= now - LISTENER_METRIC_WINDOW_MS).slice(-720))
}

async function withListenerLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = listenerQueue
  let release!: () => void
  listenerQueue = new Promise<void>((resolve) => { release = resolve })
  await previous
  try {
    return await operation()
  } finally {
    release()
  }
}

async function readListenerSnapshot(now: number): Promise<ListenerSnapshot> {
  const saved = await readJson<unknown>(LISTENERS_PATH, {})
  const listeners: Record<string, number> = {}
  let changed = false
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [id, lastSeenAt] of Object.entries(saved)) {
      if (LISTENER_ID_PATTERN.test(id) && typeof lastSeenAt === 'number' && Number.isFinite(lastSeenAt) && lastSeenAt >= now - LISTENER_TTL_MS) {
        listeners[id] = lastSeenAt
      } else {
        changed = true
      }
    }
  } else if (saved && typeof saved === 'object') {
    changed = true
  }
  return { listeners, changed }
}

export async function recordListener(id: string, active: boolean) {
  if (!LISTENER_ID_PATTERN.test(id)) throw new Error('Invalid listener ID.')
  return withListenerLock(async () => {
    const now = Date.now()
    const snapshot = await readListenerSnapshot(now)
    if (active) snapshot.listeners[id] = now
    else delete snapshot.listeners[id]
    const persistenceConfigured = await writeJson(LISTENERS_PATH, snapshot.listeners)
    await recordListenerMetric(Object.keys(snapshot.listeners).length, now)
    return { listenersNow: Object.keys(snapshot.listeners).length, persistenceConfigured }
  })
}

export async function getActiveListenerCount() {
  return withListenerLock(async () => {
    const snapshot = await readListenerSnapshot(Date.now())
    if (snapshot.changed) await writeJson(LISTENERS_PATH, snapshot.listeners)
    return Object.keys(snapshot.listeners).length
  })
}

export async function getAverageListenerCount() {
  const now = Date.now()
  const saved = await readJson<unknown>(LISTENER_METRICS_PATH, [])
  const metrics = Array.isArray(saved)
    ? saved.filter((item): item is ListenerMetric => Boolean(item) && typeof item === 'object'
      && typeof (item as ListenerMetric).t === 'number'
      && typeof (item as ListenerMetric).count === 'number'
      && Number.isFinite((item as ListenerMetric).t)
      && Number.isFinite((item as ListenerMetric).count)
      && (item as ListenerMetric).t >= now - LISTENER_METRIC_WINDOW_MS)
    : []
  if (metrics.length === 0) return 0
  return Math.round(metrics.reduce((total, item) => total + item.count, 0) / metrics.length)
}

export const STATION_LISTENERS_PATH = 'station/station-listeners.json'
export const STATION_LISTENER_METRICS_PATH = 'station/station-listener-metrics.json'
interface StationListenerMetric { t: number; station: string; count: number }
interface StationListenerEntry { t: number; station: string }

/** Station-scoped heartbeat analytics; no personal identity or song title is stored. */
export async function recordStationListener(id: string, station: string, active: boolean) {
  if (!LISTENER_ID_PATTERN.test(id)) throw new Error('Invalid listener ID.')
  return withListenerLock(async () => {
    const now = Date.now()
    const saved = await readJson<Record<string, StationListenerEntry>>(STATION_LISTENERS_PATH, {})
    const listeners = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}
    if (active) listeners[id] = { t: now, station }
    else if (listeners[id]?.station === station) delete listeners[id]
    const activeEntries = Object.values(listeners).filter((entry) => entry && typeof entry.t === 'number' && entry.t >= now - LISTENER_TTL_MS)
    const current = activeEntries.filter((entry) => entry.station === station).length
    await writeJson(STATION_LISTENERS_PATH, Object.fromEntries(Object.entries(listeners).filter(([, entry]) => entry && typeof entry.t === 'number' && entry.t >= now - LISTENER_TTL_MS)))
    const metricSaved = await readJson<unknown>(STATION_LISTENER_METRICS_PATH, [])
    const metrics = Array.isArray(metricSaved) ? metricSaved.filter((item): item is StationListenerMetric => Boolean(item) && typeof item === 'object' && typeof (item as StationListenerMetric).t === 'number' && typeof (item as StationListenerMetric).station === 'string' && typeof (item as StationListenerMetric).count === 'number') : []
    metrics.push({ t: now, station, count: current })
    await writeJson(STATION_LISTENER_METRICS_PATH, metrics.filter((item) => item.t >= now - LISTENER_METRIC_WINDOW_MS).slice(-2000))
    return { listenersNow: activeEntries.length, stationListenersNow: current }
  })
}

/** Unique active devices across the whole network, with one current station per device. */
export async function getActiveStationListenerCounts() {
  return withListenerLock(async () => {
    const now = Date.now()
    const saved = await readJson<unknown>(STATION_LISTENERS_PATH, {})
    const entries = saved && typeof saved === 'object' && !Array.isArray(saved)
      ? Object.entries(saved as Record<string, StationListenerEntry>)
      : []
    const active = entries.filter(([, entry]) => entry && typeof entry.t === 'number'
      && Number.isFinite(entry.t) && entry.t >= now - LISTENER_TTL_MS)
    const counts: Record<string, number> = {}
    for (const [, entry] of active) counts[entry.station] = (counts[entry.station] ?? 0) + 1
    if (active.length !== entries.length) {
      await writeJson(STATION_LISTENERS_PATH, Object.fromEntries(active))
    }
    return { totalListenersNow: active.length, stationCounts: counts }
  })
}

export async function getStationListenerStats() {
  const now = Date.now()
  const saved = await readJson<unknown>(STATION_LISTENERS_PATH, {})
  const entries = saved && typeof saved === 'object' && !Array.isArray(saved) ? Object.values(saved as Record<string, StationListenerEntry>) : []
  const metricsSaved = await readJson<unknown>(STATION_LISTENER_METRICS_PATH, [])
  const metrics = Array.isArray(metricsSaved) ? metricsSaved.filter((item): item is StationListenerMetric => Boolean(item) && typeof item === 'object' && typeof (item as StationListenerMetric).t === 'number' && typeof (item as StationListenerMetric).station === 'string' && typeof (item as StationListenerMetric).count === 'number' && (item as StationListenerMetric).t >= now - LISTENER_METRIC_WINDOW_MS) : []
  return metrics
}

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = 'station/state-v2.json'
export const LIVE_DJ_PATH = 'station/live-dj.json'
export const MESSAGES_PATH = 'station/listener-messages.json'
/** RJ FM 105.5 Cebu — independent music queue. */
export const CEBU_STATE_PATH = 'station/state-cebu-v2.json'
export const GENSAN_STATE_PATH = 'station/state-gensan-v2.json'
export const CDO_STATE_PATH = 'station/state-cdo-v2.json'
export const NAGA_STATE_PATH = 'station/state-naga-v2.json'
export const ILOILO_STATE_PATH = 'station/state-iloilo-v2.json'
export const DAVAO_STATE_PATH = 'station/state-davao-v2.json'
export const MASBATE_STATE_PATH = 'station/state-masbate-v2.json'
export const CALABANGA_STATE_PATH = 'station/state-calabanga-v2.json'

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  sundayScheduleEnabled: true,
  newTagalogOpmEnabled: true,
  bassBoostDb: MAX_BASS_BOOST_DB,
  transmitterWatts: 25000,
  blockedGenres: [],
  discoEnabled: true,
  rjOfficialAutoEnabled: false,
  rjOfficialAutoMessage: '',
  rjFmNationwideEnabled: true,
  songRequestsEnabled: true,
  autoDeletePlayedCache: true,
  djChristopherEnabled: true,
  djChristopherIntervalMinutes: 40,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    sundayScheduleEnabled: typeof saved.sundayScheduleEnabled === 'boolean' ? saved.sundayScheduleEnabled : true,
    newTagalogOpmEnabled: typeof saved.newTagalogOpmEnabled === 'boolean' ? saved.newTagalogOpmEnabled : true,
    bassBoostDb: typeof saved.bassBoostDb === 'number' && Number.isFinite(saved.bassBoostDb) && saved.bassBoostDb > 0
      ? Math.min(MAX_BASS_BOOST_DB, saved.bassBoostDb)
      : MAX_BASS_BOOST_DB,
    transmitterWatts: saved.transmitterWatts === 5000 ? 5000 : 25000,
    blockedGenres: Array.isArray(saved.blockedGenres)
      ? [...new Set(saved.blockedGenres.filter((genre): genre is string => typeof genre === 'string').map((genre) => genre.trim().toLowerCase()).filter(Boolean))].slice(0, 30)
      : [],
    discoEnabled: typeof saved.discoEnabled === 'boolean' ? saved.discoEnabled : true,
    rjOfficialAutoEnabled: typeof saved.rjOfficialAutoEnabled === 'boolean' ? saved.rjOfficialAutoEnabled : false,
    rjOfficialAutoMessage: typeof saved.rjOfficialAutoMessage === 'string' ? saved.rjOfficialAutoMessage.trim().slice(0, 500) : '',
    rjFmNationwideEnabled: typeof saved.rjFmNationwideEnabled === 'boolean' ? saved.rjFmNationwideEnabled : true,
    songRequestsEnabled: typeof saved.songRequestsEnabled === 'boolean' ? saved.songRequestsEnabled : true,
    autoDeletePlayedCache: typeof saved.autoDeletePlayedCache === 'boolean' ? saved.autoDeletePlayedCache : true,
    djChristopherEnabled: true,
    djChristopherIntervalMinutes: typeof saved.djChristopherIntervalMinutes === 'number' && Number.isFinite(saved.djChristopherIntervalMinutes) ? Math.min(60, Math.max(30, saved.djChristopherIntervalMinutes)) : 40,
  }
}


/** Returns the actual stored object sizes from the configured Supabase bucket. */
export async function getStorageUsage(): Promise<{ available: boolean; usedBytes: number; objectCount: number; provider: string; error?: string }> {
  if (!hasSupabaseCredentials()) {
    return { available: false, usedBytes: 0, objectCount: 0, provider: hasVercelBlobCredentials() ? 'Vercel Blob' : 'Not configured', error: 'Exact bucket usage is not available for this storage provider.' }
  }
  try {
    let offset = 0
    let usedBytes = 0
    let objectCount = 0
    const limit = 1000
    while (true) {
      const response = await fetch(`${supabaseUrl()}/storage/v1/object/list/${SUPABASE_BUCKET}`, {
        method: 'POST',
        headers: supabaseHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ prefix: '', limit, offset, sortBy: { column: 'name', order: 'asc' } }),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`Storage usage query failed (${response.status})`)
      const entries = await response.json() as Array<{ name?: string; id?: string | null; metadata?: { size?: number | string; contentLength?: number | string } }>
      if (!Array.isArray(entries)) throw new Error('Unexpected storage usage response.')
      for (const entry of entries) {
        if (!entry.name || entry.id === null) continue
        const size = Number(entry.metadata?.size ?? entry.metadata?.contentLength ?? 0)
        if (Number.isFinite(size) && size >= 0) usedBytes += size
        objectCount += 1
      }
      if (entries.length < limit) break
      offset += limit
    }
    return { available: true, usedBytes, objectCount, provider: 'Supabase Storage' }
  } catch (error) {
    return { available: false, usedBytes: 0, objectCount: 0, provider: 'Supabase Storage', error: error instanceof Error ? error.message : 'Storage usage could not be read.' }
  }
}
