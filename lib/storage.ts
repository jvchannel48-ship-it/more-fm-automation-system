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
  return Boolean(supabaseUrl() && supabaseKey())
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
    console.error('[morefm] blob read failed', pathname, error instanceof Error ? error.message : error)
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
    console.error('[morefm] blob write failed', pathname, error instanceof Error ? error.message : error)
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
  }
}
