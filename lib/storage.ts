import 'server-only'
import { get, put } from '@vercel/blob'
import type { StationSettings } from './types'

const memoryFallback = new Map<string, string>()
const BLOB_RETRY_DELAY_MS = 15_000
let retryBlobAfter = 0
let warnedAboutFallback = false
let blobOperational: boolean | null = null

function hasBlobCredentials() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  )
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
  console.warn('[morefm] Vercel Blob unavailable; using process-memory station state until storage recovers')
}

export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  if (!hasBlobCredentials() || Date.now() < retryBlobAfter) {
    blobOperational = false
    warnMemoryFallback()
    return readMemory(pathname, fallback)
  }

  try {
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
  } catch {
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
  } catch {
    retryBlobAfter = Date.now() + BLOB_RETRY_DELAY_MS
    blobOperational = false
    warnMemoryFallback()
    return false
  }
}

export const LISTENERS_PATH = 'station/listeners.json'
const LISTENER_TTL_MS = 60_000
const LISTENER_ID_PATTERN = /^[a-zA-Z0-9-]{16,80}$/
let listenerQueue: Promise<void> = Promise.resolve()

interface ListenerSnapshot {
  listeners: Record<string, number>
  changed: boolean
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

export const SETTINGS_PATH = 'station/settings.json'
export const STATE_PATH = 'station/state-v2.json'

export const DEFAULT_SETTINGS: StationSettings = {
  broadcastEnabled: true,
  sundayScheduleEnabled: true,
}

export async function getSettings(): Promise<StationSettings> {
  const saved = await readJson<Partial<StationSettings>>(SETTINGS_PATH, {})
  return {
    broadcastEnabled: typeof saved.broadcastEnabled === 'boolean' ? saved.broadcastEnabled : true,
    sundayScheduleEnabled: typeof saved.sundayScheduleEnabled === 'boolean' ? saved.sundayScheduleEnabled : true,
  }
}
